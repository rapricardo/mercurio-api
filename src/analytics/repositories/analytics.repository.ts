import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';
import { EventAggregation, TopEventData, UserActivityData } from '../types/analytics.types';
import { EventDetailItem } from '../dto/response.dto';

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get overview metrics aggregations
   */
  async getOverviewMetrics(
    tenantId: bigint,
    workspaceId: bigint,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalEvents: number;
    uniqueVisitors: number;
    totalSessions: number;
    conversions: number;
    topEvent: string | null;
    avgSessionDuration: number;
    bounceRate: number;
  }> {
    const [metrics, topEvent, sessionMetrics] = await Promise.all([
      // Basic counts
      this.prisma.$queryRaw<[{
        total_events: number;
        unique_visitors: number;
        total_sessions: number;
        conversions: number;
      }]>`
        SELECT 
          COUNT(*)::int as total_events,
          COUNT(DISTINCT anonymous_id)::int as unique_visitors,
          COUNT(DISTINCT session_id)::int as total_sessions,
          COUNT(DISTINCT CASE WHEN lead_id IS NOT NULL THEN anonymous_id END)::int as conversions
        FROM event
        WHERE tenant_id = ${tenantId}
          AND workspace_id = ${workspaceId}
          AND timestamp >= ${startDate}
          AND timestamp <= ${endDate}
      `,

      // Top event
      this.prisma.$queryRaw<[{ event_name: string; count: number }]>`
        SELECT event_name, COUNT(*)::int as count
        FROM event
        WHERE tenant_id = ${tenantId}
          AND workspace_id = ${workspaceId}
          AND timestamp >= ${startDate}
          AND timestamp <= ${endDate}
        GROUP BY event_name
        ORDER BY count DESC
        LIMIT 1
      `,

      // Session duration and bounce rate
      this.prisma.$queryRaw<[{
        avg_session_duration: number;
        bounce_rate: number;
      }]>`
        WITH session_stats AS (
          SELECT 
            s.session_id,
            COUNT(e.id)::int as event_count,
            EXTRACT(EPOCH FROM (MAX(e.timestamp) - MIN(e.timestamp)))::decimal as duration
          FROM session s
          LEFT JOIN event e ON s.session_id = e.session_id 
            AND e.tenant_id = s.tenant_id 
            AND e.workspace_id = s.workspace_id
            AND e.timestamp >= ${startDate}
            AND e.timestamp <= ${endDate}
          WHERE s.tenant_id = ${tenantId}
            AND s.workspace_id = ${workspaceId}
            AND s.started_at >= ${startDate}
            AND s.started_at <= ${endDate}
          GROUP BY s.session_id
        )
        SELECT 
          COALESCE(AVG(CASE WHEN event_count > 1 THEN duration END), 0)::decimal as avg_session_duration,
          (COUNT(CASE WHEN event_count = 1 THEN 1 END)::decimal / NULLIF(COUNT(*), 0) * 100)::decimal as bounce_rate
        FROM session_stats
      `,
    ]);

    // Safely handle potentially empty results
    const baseMetrics = (Array.isArray(metrics) && metrics.length > 0 && metrics[0]) ? metrics[0] : {
      total_events: 0,
      unique_visitors: 0,
      total_sessions: 0,
      conversions: 0,
    };

    const topEventName = (Array.isArray(topEvent) && topEvent.length > 0 && topEvent[0]) ? topEvent[0].event_name : null;
    const sessionStats = (Array.isArray(sessionMetrics) && sessionMetrics.length > 0 && sessionMetrics[0]) ? sessionMetrics[0] : {
      avg_session_duration: 0,
      bounce_rate: 0,
    };

    return {
      totalEvents: baseMetrics.total_events,
      uniqueVisitors: baseMetrics.unique_visitors,
      totalSessions: baseMetrics.total_sessions,
      conversions: baseMetrics.conversions,
      topEvent: topEventName,
      avgSessionDuration: Number(sessionStats.avg_session_duration),
      bounceRate: Number(sessionStats.bounce_rate),
    };
  }

  /**
   * Get time-series aggregations
   */
  async getTimeSeriesData(
    tenantId: bigint,
    workspaceId: bigint,
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week',
    metrics: string[],
  ): Promise<EventAggregation[]> {
    const metricSelections = this.buildMetricSelections(metrics);
    
    // Build the complete query as a string and use $queryRawUnsafe to avoid Prisma template literal issues
    const querySQL = `
      SELECT 
        date_trunc('${granularity}', e.timestamp) as period,
        ${metricSelections}
      FROM event e
      WHERE e.tenant_id = ${tenantId}
        AND e.workspace_id = ${workspaceId}
        AND e.timestamp >= '${startDate.toISOString()}'
        AND e.timestamp <= '${endDate.toISOString()}'
      GROUP BY date_trunc('${granularity}', e.timestamp)
      ORDER BY date_trunc('${granularity}', e.timestamp) ASC
    `;
    
    // Use $queryRawUnsafe to avoid Prisma template literal parsing issues
    const result = await this.prisma.$queryRawUnsafe<EventAggregation[]>(querySQL);

    // Handle potentially empty results with proper default values
    return Array.isArray(result) ? result : [];
  }

  /**
   * Get top events with ranking
   */
  async getTopEvents(
    tenantId: bigint,
    workspaceId: bigint,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<TopEventData[]> {
    const result = await this.prisma.$queryRaw<TopEventData[]>`
      WITH event_stats AS (
        SELECT 
          event_name,
          COUNT(*)::int as count,
          COUNT(DISTINCT anonymous_id)::int as unique_visitors,
          (COUNT(*)::decimal / COUNT(DISTINCT anonymous_id))::decimal(10,2) as avg_per_visitor
        FROM event
        WHERE tenant_id = ${tenantId}
          AND workspace_id = ${workspaceId}
          AND timestamp >= ${startDate}
          AND timestamp <= ${endDate}
        GROUP BY event_name
      ),
      total_events AS (
        SELECT SUM(count)::int as total FROM event_stats
      ),
      ranked_events AS (
        SELECT 
          event_name,
          count,
          unique_visitors,
          avg_per_visitor,
          ROW_NUMBER() OVER (ORDER BY count DESC) as rank,
          (count::decimal / NULLIF(total.total, 0) * 100)::decimal(5,2) as percentage
        FROM event_stats, total_events total
      )
      SELECT 
        rank::int,
        event_name,
        count::int,
        unique_visitors::int,
        avg_per_visitor::decimal as avg_per_visitor,
        percentage::decimal as percentage
      FROM ranked_events
      ORDER BY rank ASC
      LIMIT ${limit}
    `;

    // Handle potentially empty results
    return Array.isArray(result) ? result : [];
  }

  /**
   * Get user activity levels
   */
  async getUserActivityLevels(
    tenantId: bigint,
    workspaceId: bigint,
    startDate: Date,
    endDate: Date,
  ): Promise<UserActivityData[]> {
    const result = await this.prisma.$queryRaw<UserActivityData[]>`
      WITH session_activity AS (
        SELECT 
          s.anonymous_id,
          COUNT(e.id)::int as events_per_session
        FROM session s
        LEFT JOIN event e ON s.session_id = e.session_id 
          AND e.tenant_id = s.tenant_id 
          AND e.workspace_id = s.workspace_id
          AND e.timestamp >= ${startDate}
          AND e.timestamp <= ${endDate}
        WHERE s.tenant_id = ${tenantId}
          AND s.workspace_id = ${workspaceId}
          AND s.started_at >= ${startDate}
          AND s.started_at <= ${endDate}
        GROUP BY s.anonymous_id, s.session_id
      ),
      activity_classification AS (
        SELECT 
          anonymous_id,
          events_per_session,
          CASE 
            WHEN events_per_session >= 10 THEN 'high_activity'
            WHEN events_per_session >= 3 THEN 'medium_activity'
            ELSE 'low_activity'
          END as activity_level
        FROM session_activity
      ),
      activity_summary AS (
        SELECT 
          activity_level,
          COUNT(DISTINCT anonymous_id)::int as visitors,
          AVG(events_per_session)::decimal(10,2) as avg_events_per_session
        FROM activity_classification
        GROUP BY activity_level
      ),
      total_visitors AS (
        SELECT COUNT(DISTINCT anonymous_id)::int as total FROM activity_classification
      )
      SELECT 
        activity_level,
        visitors::int,
        (visitors::decimal / NULLIF(total.total, 0) * 100)::decimal(5,2) as percentage,
        avg_events_per_session::decimal
      FROM activity_summary, total_visitors total
      ORDER BY 
        CASE activity_level
          WHEN 'high_activity' THEN 1
          WHEN 'medium_activity' THEN 2
          WHEN 'low_activity' THEN 3
        END
    `;

    // Handle potentially empty results with safe mapping
    if (!Array.isArray(result) || result.length === 0) {
      return [
        { activity_level: 'high_activity', visitors: 0, percentage: 0, avg_events_per_session: 0 },
        { activity_level: 'medium_activity', visitors: 0, percentage: 0, avg_events_per_session: 0 },
        { activity_level: 'low_activity', visitors: 0, percentage: 0, avg_events_per_session: 0 },
      ];
    }

    return result.map(row => ({
      activity_level: row.activity_level as 'high_activity' | 'medium_activity' | 'low_activity',
      visitors: row.visitors || 0,
      percentage: Number(row.percentage) || 0,
      avg_events_per_session: Number(row.avg_events_per_session) || 0,
    }));
  }

  /**
   * Get user summary statistics
   */
  async getUserSummary(
    tenantId: bigint,
    workspaceId: bigint,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalVisitors: number;
    identifiedLeads: number;
    returningVisitors: number;
    newVisitors: number;
  }> {
    const result = await this.prisma.$queryRaw<[{
      total_visitors: number;
      identified_leads: number;
      returning_visitors: number;
      new_visitors: number;
    }]>`
      WITH period_visitors AS (
        SELECT DISTINCT anonymous_id
        FROM event
        WHERE tenant_id = ${tenantId}
          AND workspace_id = ${workspaceId}
          AND timestamp >= ${startDate}
          AND timestamp <= ${endDate}
      ),
      identified_visitors AS (
        SELECT DISTINCT anonymous_id
        FROM event
        WHERE tenant_id = ${tenantId}
          AND workspace_id = ${workspaceId}
          AND timestamp >= ${startDate}
          AND timestamp <= ${endDate}
          AND lead_id IS NOT NULL
      ),
      visitor_history AS (
        SELECT 
          pv.anonymous_id,
          CASE WHEN EXISTS (
            SELECT 1 FROM event e 
            WHERE e.anonymous_id = pv.anonymous_id
              AND e.tenant_id = ${tenantId}
              AND e.workspace_id = ${workspaceId}
              AND e.timestamp < ${startDate}
          ) THEN 'returning' ELSE 'new' END as visitor_type
        FROM period_visitors pv
      )
      SELECT 
        COUNT(DISTINCT pv.anonymous_id)::int as total_visitors,
        COUNT(DISTINCT iv.anonymous_id)::int as identified_leads,
        COUNT(CASE WHEN vh.visitor_type = 'returning' THEN vh.anonymous_id END)::int as returning_visitors,
        COUNT(CASE WHEN vh.visitor_type = 'new' THEN vh.anonymous_id END)::int as new_visitors
      FROM period_visitors pv
      LEFT JOIN identified_visitors iv ON pv.anonymous_id = iv.anonymous_id
      LEFT JOIN visitor_history vh ON pv.anonymous_id = vh.anonymous_id
    `;

    // Safely handle potentially empty results
    const summary = (Array.isArray(result) && result.length > 0 && result[0]) ? result[0] : {
      total_visitors: 0,
      identified_leads: 0,
      returning_visitors: 0,
      new_visitors: 0,
    };

    return {
      totalVisitors: summary.total_visitors,
      identifiedLeads: summary.identified_leads,
      returningVisitors: summary.returning_visitors,
      newVisitors: summary.new_visitors,
    };
  }

  /**
   * Get event details with filtering and pagination
   */
  async getEventDetails(
    tenantId: bigint,
    workspaceId: bigint,
    startDate: Date,
    endDate: Date,
    filters: {
      eventName?: string;
      anonymousId?: string;
      leadId?: string;
      sessionId?: string;
      hasLead?: boolean;
    },
    pagination: {
      page: number;
      limit: number;
      sortBy: 'timestamp' | 'event_name';
      sortOrder: 'asc' | 'desc';
    },
  ): Promise<{ events: EventDetailItem[]; totalCount: number }> {
    const offset = (pagination.page - 1) * pagination.limit;
    const whereConditions = this.buildEventFilters(filters);
    const orderClause = `${pagination.sortBy} ${pagination.sortOrder.toUpperCase()}`;

    const eventsQuery = `
        SELECT 
          CONCAT('evt_', id) as event_id,
          event_name,
          timestamp,
          anonymous_id,
          lead_id,
          session_id,
          page,
          utm,
          device,
          geo,
          props
        FROM event
        WHERE tenant_id = ${tenantId}
          AND workspace_id = ${workspaceId}
          AND timestamp >= '${startDate.toISOString()}'
          AND timestamp <= '${endDate.toISOString()}'
          ${whereConditions}
        ORDER BY ${orderClause}
        LIMIT ${pagination.limit}
        OFFSET ${offset}
      `;

    const countQuery = `
        SELECT COUNT(*)::int as count
        FROM event
        WHERE tenant_id = ${tenantId}
          AND workspace_id = ${workspaceId}
          AND timestamp >= '${startDate.toISOString()}'
          AND timestamp <= '${endDate.toISOString()}'
          ${whereConditions}
      `;

    const [events, countResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<EventDetailItem[]>(eventsQuery),
      this.prisma.$queryRawUnsafe<[{ count: number }]>(countQuery),
    ]);

    // Safely handle potentially empty results
    const totalCount = (Array.isArray(countResult) && countResult.length > 0 && countResult[0]) ? countResult[0].count : 0;

    return {
      events: Array.isArray(events) ? events.map(event => this.convertBigIntToString({
        ...event,
        timestamp: new Date(event.timestamp).toISOString(),
      })) : [],
      totalCount,
    };
  }

  /**
   * Helper to convert BigInt values to strings recursively
   */
  private convertBigIntToString(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map(item => this.convertBigIntToString(item));
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = this.convertBigIntToString(value);
      }
      return converted;
    }
    return obj;
  }

  private getTimeFormat(granularity: string): string {
    switch (granularity) {
      case 'hour':
        return 'YYYY-MM-DD HH24:00:00';
      case 'day':
        return 'YYYY-MM-DD';
      case 'week':
        return 'IYYY-IW';
      default:
        return 'YYYY-MM-DD';
    }
  }

  private buildMetricSelections(metrics: string[]): string {
    const selections: string[] = [];

    if (metrics.includes('events')) {
      selections.push('COUNT(*)::int as total_events');
    }
    if (metrics.includes('visitors')) {
      selections.push('COUNT(DISTINCT e.anonymous_id)::int as unique_visitors');
    }
    if (metrics.includes('sessions')) {
      selections.push('COUNT(DISTINCT e.session_id)::int as total_sessions');
    }
    if (metrics.includes('conversions')) {
      selections.push('COUNT(DISTINCT CASE WHEN e.lead_id IS NOT NULL THEN e.anonymous_id END)::int as conversions');
    }

    // Se nenhuma métrica foi especificada, usar uma métrica padrão
    if (selections.length === 0) {
      selections.push('COUNT(*)::int as total_events');
    }

    return selections.join(', ');
  }

  private buildCoalesceSelections(metrics: string[]): string {
    const selections: string[] = [];

    if (metrics.includes('events')) {
      selections.push('COALESCE(event_aggregations.total_events, 0) as total_events');
    }
    if (metrics.includes('visitors')) {
      selections.push('COALESCE(event_aggregations.unique_visitors, 0) as unique_visitors');
    }
    if (metrics.includes('sessions')) {
      selections.push('COALESCE(event_aggregations.total_sessions, 0) as total_sessions');
    }
    if (metrics.includes('conversions')) {
      selections.push('COALESCE(event_aggregations.conversions, 0) as conversions');
    }

    // Se nenhuma métrica foi especificada, usar uma métrica padrão
    if (selections.length === 0) {
      selections.push('COALESCE(event_aggregations.total_events, 0) as total_events');
    }

    return selections.join(', ');
  }

  private buildEventFilters(filters: {
    eventName?: string;
    anonymousId?: string;
    leadId?: string;
    sessionId?: string;
    hasLead?: boolean;
  }): string {
    const conditions: string[] = [];

    if (filters.eventName) {
      conditions.push(`AND event_name = '${filters.eventName}'`);
    }
    if (filters.anonymousId) {
      conditions.push(`AND anonymous_id = '${filters.anonymousId}'`);
    }
    if (filters.leadId) {
      conditions.push(`AND lead_id = '${filters.leadId}'`);
    }
    if (filters.sessionId) {
      conditions.push(`AND session_id = '${filters.sessionId}'`);
    }
    if (filters.hasLead !== undefined) {
      conditions.push(
        filters.hasLead ? 'AND lead_id IS NOT NULL' : 'AND lead_id IS NULL'
      );
    }

    return conditions.join(' ');
  }
}
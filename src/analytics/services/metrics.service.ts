import { Injectable, Logger } from '@nestjs/common'
import { AnalyticsRepository } from '../repositories/analytics.repository'
import { PeriodUtils } from '../utils/period.utils'
import {
  OverviewMetricsResponse,
  MetricComparison,
  TopEventsResponse,
  UserAnalyticsResponse,
  ActivityLevel,
  ConversionFunnel,
} from '../dto/response.dto'
import { PeriodQueryDto, TopEventsQueryDto, UserAnalyticsQueryDto } from '../dto/query.dto'
import { PeriodType } from '../types/analytics.types'

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name)

  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  /**
   * Calculate overview metrics with comparisons
   */
  async calculateOverviewMetrics(
    tenantId: bigint,
    workspaceId: bigint,
    query: PeriodQueryDto
  ): Promise<OverviewMetricsResponse> {
    const { start: startDate, end: endDate } = PeriodUtils.calculatePeriod(
      query.period,
      query.startDate,
      query.endDate,
      query.timezone
    )

    // Get current period metrics
    const currentMetrics = await this.analyticsRepository.getOverviewMetrics(
      tenantId,
      workspaceId,
      startDate,
      endDate
    )

    // Get previous period for comparison
    const { start: previousStart, end: previousEnd } = PeriodUtils.calculatePreviousPeriod(
      query.period,
      startDate,
      endDate
    )

    const previousMetrics = await this.analyticsRepository.getOverviewMetrics(
      tenantId,
      workspaceId,
      previousStart,
      previousEnd
    )

    // Calculate conversion rate
    const conversionRate =
      currentMetrics.uniqueVisitors > 0
        ? (currentMetrics.conversions / currentMetrics.uniqueVisitors) * 100
        : 0

    // Build response
    const response: OverviewMetricsResponse = {
      period: PeriodUtils.createPeriodInfo(query.period, startDate, endDate, query.timezone),
      metrics: {
        total_events: currentMetrics.totalEvents,
        unique_visitors: currentMetrics.uniqueVisitors,
        total_sessions: currentMetrics.totalSessions,
        conversion_rate: Number(conversionRate.toFixed(2)),
        bounce_rate: Number(currentMetrics.bounceRate.toFixed(2)),
        avg_session_duration: Number(currentMetrics.avgSessionDuration.toFixed(1)),
        top_event: currentMetrics.topEvent || 'N/A',
      },
      comparisons: {
        total_events: this.calculateComparison(
          currentMetrics.totalEvents,
          previousMetrics.totalEvents
        ),
        unique_visitors: this.calculateComparison(
          currentMetrics.uniqueVisitors,
          previousMetrics.uniqueVisitors
        ),
        total_sessions: this.calculateComparison(
          currentMetrics.totalSessions,
          previousMetrics.totalSessions
        ),
      },
    }

    return response
  }

  /**
   * Calculate top events with trends
   */
  async calculateTopEvents(
    tenantId: bigint,
    workspaceId: bigint,
    query: TopEventsQueryDto
  ): Promise<TopEventsResponse> {
    const { start: startDate, end: endDate } = PeriodUtils.calculatePeriod(
      query.period,
      query.startDate,
      query.endDate,
      query.timezone
    )

    // Get current period top events
    const currentEvents = await this.analyticsRepository.getTopEvents(
      tenantId,
      workspaceId,
      startDate,
      endDate,
      query.limit
    )

    // Get previous period for trend calculation
    const { start: previousStart, end: previousEnd } = PeriodUtils.calculatePreviousPeriod(
      query.period,
      startDate,
      endDate
    )

    const previousEvents = await this.analyticsRepository.getTopEvents(
      tenantId,
      workspaceId,
      previousStart,
      previousEnd,
      (query.limit || 10) * 2 // Get more to ensure we have comparison data
    )

    // Calculate total events for percentage calculations
    const totalEvents = currentEvents.reduce((sum, event) => sum + event.count, 0)

    // Build response with trends
    const eventsWithTrends = currentEvents.map((event) => {
      const previousEvent = previousEvents.find((pe) => pe.event_name === event.event_name)
      const trend = previousEvent
        ? this.calculateTrend(event.count, previousEvent.count)
        : { change_pct: 0, direction: 'stable' as const }

      return {
        rank: event.rank,
        event_name: event.event_name,
        count: event.count,
        percentage: Number(event.percentage),
        unique_visitors: event.unique_visitors,
        avg_per_visitor: Number(event.avg_per_visitor),
        trend,
      }
    })

    return {
      period: PeriodUtils.createPeriodInfo(query.period, startDate, endDate, query.timezone),
      total_events: totalEvents,
      events: eventsWithTrends,
    }
  }

  /**
   * Calculate user analytics with activity levels
   */
  async calculateUserAnalytics(
    tenantId: bigint,
    workspaceId: bigint,
    query: UserAnalyticsQueryDto
  ): Promise<UserAnalyticsResponse> {
    const { start: startDate, end: endDate } = PeriodUtils.calculatePeriod(
      query.period,
      query.startDate,
      query.endDate,
      query.timezone
    )

    // Get user summary statistics
    const userSummary = await this.analyticsRepository.getUserSummary(
      tenantId,
      workspaceId,
      startDate,
      endDate
    )

    // Get activity levels
    const activityData = await this.analyticsRepository.getUserActivityLevels(
      tenantId,
      workspaceId,
      startDate,
      endDate
    )

    // Calculate identification rate
    const identificationRate =
      userSummary.totalVisitors > 0
        ? (userSummary.identifiedLeads / userSummary.totalVisitors) * 100
        : 0

    // Build activity levels response
    const activityLevels: ActivityLevel[] = activityData.map((activity) => ({
      level: activity.activity_level,
      description: this.getActivityDescription(activity.activity_level),
      visitors: activity.visitors,
      percentage: activity.percentage,
      avg_events_per_session: activity.avg_events_per_session,
    }))

    // Build conversion funnel
    const conversionFunnel: ConversionFunnel = {
      visitors: userSummary.totalVisitors,
      sessions_created: userSummary.totalVisitors, // Simplified: assume 1 session per visitor
      events_generated: userSummary.totalVisitors, // Simplified: would need actual event count
      leads_identified: userSummary.identifiedLeads,
      conversion_stages: [
        {
          stage: 'visitor',
          count: userSummary.totalVisitors,
          percentage: 100.0,
        },
        {
          stage: 'engaged',
          count: Math.floor(userSummary.totalVisitors * 0.6), // Simplified estimation
          percentage: 60.0,
        },
        {
          stage: 'identified',
          count: userSummary.identifiedLeads,
          percentage: Number(identificationRate.toFixed(2)),
        },
      ],
    }

    return {
      period: PeriodUtils.createPeriodInfo(query.period, startDate, endDate, query.timezone),
      summary: {
        total_visitors: userSummary.totalVisitors,
        identified_leads: userSummary.identifiedLeads,
        identification_rate: Number(identificationRate.toFixed(2)),
        returning_visitors: userSummary.returningVisitors,
        new_visitors: userSummary.newVisitors,
      },
      activity_levels: activityLevels,
      conversion_funnel: conversionFunnel,
    }
  }

  private calculateComparison(current: number, previous: number): MetricComparison {
    const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0

    let direction: 'up' | 'down' | 'stable' = 'stable'
    if (Math.abs(changePct) >= 1) {
      direction = changePct > 0 ? 'up' : 'down'
    }

    return {
      value: current,
      change_pct: Number(changePct.toFixed(1)),
      previous,
      direction,
    }
  }

  private calculateTrend(
    current: number,
    previous: number
  ): {
    change_pct: number
    direction: 'up' | 'down' | 'stable'
  } {
    const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0

    let direction: 'up' | 'down' | 'stable' = 'stable'
    if (Math.abs(changePct) >= 5) {
      // 5% threshold for trend significance
      direction = changePct > 0 ? 'up' : 'down'
    }

    return {
      change_pct: Number(changePct.toFixed(1)),
      direction,
    }
  }

  private getActivityDescription(level: string): string {
    switch (level) {
      case 'high_activity':
        return '10+ events per session'
      case 'medium_activity':
        return '3-9 events per session'
      case 'low_activity':
        return '1-2 events per session'
      default:
        return 'Unknown activity level'
    }
  }
}

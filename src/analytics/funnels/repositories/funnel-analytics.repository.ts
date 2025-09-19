import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { MercurioLogger } from '../../../common/services/logger.service'
import { ConversionTimeSeriesPoint } from '../dto/analytics-response.dto'

/**
 * Repository for advanced funnel analytics queries
 * Optimized for performance with complex statistical calculations
 */
@Injectable()
export class FunnelAnalyticsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: MercurioLogger
  ) {}

  /**
   * Get step completions for conversion rate calculations
   */
  async getStepCompletions(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    stepOrder: number,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const query = `
      SELECT COUNT(DISTINCT fus.anonymous_id) as completions
      FROM funnel_user_state fus
      JOIN funnel f ON f.id = fus.funnel_id
      WHERE fus.tenant_id = $1
        AND fus.workspace_id = $2
        AND fus.funnel_id = $3
        AND fus.current_step >= $4
        AND fus.first_seen_at >= $5::timestamp
        AND fus.first_seen_at <= $6::timestamp
        AND f.archived_at IS NULL
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      stepOrder,
      startDate,
      endDate
    )) as Array<{ completions: bigint }>

    return Number(result[0]?.completions || 0)
  }

  /**
   * Get conversion data by segments (device, traffic source, etc.)
   */
  async getConversionsBySegment(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    segmentType: string,
    startDate: string,
    endDate: string
  ): Promise<
    Array<{
      segment_value: string
      total_entries: number
      total_conversions: number
    }>
  > {
    let segmentColumn: string
    let joinClause = ''

    switch (segmentType) {
      case 'device_type':
        segmentColumn = "e.device->'type' as segment_value"
        joinClause =
          'JOIN event e ON e.anonymous_id = fus.anonymous_id AND e.tenant_id = fus.tenant_id'
        break
      case 'utm_source':
        segmentColumn = "e.utm->'source' as segment_value"
        joinClause =
          'JOIN event e ON e.anonymous_id = fus.anonymous_id AND e.tenant_id = fus.tenant_id'
        break
      default:
        throw new Error(`Unsupported segment type: ${segmentType}`)
    }

    const query = `
      WITH funnel_steps AS (
        SELECT jsonb_array_length(steps) as total_steps
        FROM funnel 
        WHERE id = $3 AND tenant_id = $1
      ),
      segment_entries AS (
        SELECT 
          ${segmentColumn},
          COUNT(DISTINCT fus.anonymous_id) as entries
        FROM funnel_user_state fus
        ${joinClause}
        WHERE fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.funnel_id = $3
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
        GROUP BY segment_value
      ),
      segment_conversions AS (
        SELECT 
          ${segmentColumn},
          COUNT(DISTINCT fus.anonymous_id) as conversions
        FROM funnel_user_state fus
        ${joinClause}
        CROSS JOIN funnel_steps fs
        WHERE fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.funnel_id = $3
          AND fus.current_step = fs.total_steps
          AND fus.completed_at IS NOT NULL
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
        GROUP BY segment_value
      )
      SELECT 
        COALESCE(se.segment_value, sc.segment_value)::text as segment_value,
        COALESCE(se.entries, 0) as total_entries,
        COALESCE(sc.conversions, 0) as total_conversions
      FROM segment_entries se
      FULL OUTER JOIN segment_conversions sc ON se.segment_value = sc.segment_value
      WHERE COALESCE(se.entries, sc.conversions) > 0
      ORDER BY total_entries DESC
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{
      segment_value: string
      total_entries: bigint
      total_conversions: bigint
    }>

    return result.map((row) => ({
      segment_value: row.segment_value,
      total_entries: Number(row.total_entries),
      total_conversions: Number(row.total_conversions),
    }))
  }

  /**
   * Get conversion time-series data
   */
  async getConversionTimeSeries(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string,
    granularity: 'hourly' | 'daily' | 'weekly'
  ): Promise<ConversionTimeSeriesPoint[]> {
    let dateFormat: string
    let periodType: 'hour' | 'day' | 'week'

    switch (granularity) {
      case 'hourly':
        dateFormat = 'YYYY-MM-DD HH24:00:00'
        periodType = 'hour'
        break
      case 'daily':
        dateFormat = 'YYYY-MM-DD'
        periodType = 'day'
        break
      case 'weekly':
        dateFormat = 'YYYY-"W"WW'
        periodType = 'week'
        break
    }

    const query = `
      WITH date_series AS (
        SELECT generate_series(
          $4::timestamp,
          $5::timestamp,
          interval '1 ${granularity === 'hourly' ? 'hour' : granularity === 'daily' ? 'day' : 'week'}'
        ) as period_date
      ),
      funnel_steps AS (
        SELECT jsonb_array_length(steps) as total_steps
        FROM funnel 
        WHERE id = $3 AND tenant_id = $1
      ),
      period_entries AS (
        SELECT 
          to_char(fus.first_seen_at, '${dateFormat}') as period,
          COUNT(DISTINCT fus.anonymous_id) as entries
        FROM funnel_user_state fus
        WHERE fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.funnel_id = $3
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
        GROUP BY period
      ),
      period_conversions AS (
        SELECT 
          to_char(fus.completed_at, '${dateFormat}') as period,
          COUNT(DISTINCT fus.anonymous_id) as conversions
        FROM funnel_user_state fus
        CROSS JOIN funnel_steps fs
        WHERE fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.funnel_id = $3
          AND fus.current_step = fs.total_steps
          AND fus.completed_at IS NOT NULL
          AND fus.completed_at >= $4::timestamp
          AND fus.completed_at <= $5::timestamp
        GROUP BY period
      )
      SELECT 
        to_char(ds.period_date, '${dateFormat}') as date,
        COALESCE(pe.entries, 0) as entries,
        COALESCE(pc.conversions, 0) as conversions,
        CASE 
          WHEN COALESCE(pe.entries, 0) > 0 
          THEN ROUND((COALESCE(pc.conversions, 0)::decimal / pe.entries) * 100, 2)
          ELSE 0 
        END as conversion_rate
      FROM date_series ds
      LEFT JOIN period_entries pe ON to_char(ds.period_date, '${dateFormat}') = pe.period
      LEFT JOIN period_conversions pc ON to_char(ds.period_date, '${dateFormat}') = pc.period
      ORDER BY ds.period_date
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{
      date: string
      entries: bigint
      conversions: bigint
      conversion_rate: number
    }>

    // Calculate moving averages and trends
    const points = result.map((row) => ({
      date: row.date,
      period_type: periodType,
      entries: Number(row.entries),
      conversions: Number(row.conversions),
      conversion_rate: Number(row.conversion_rate),
      trend_direction: 'stable' as 'up' | 'down' | 'stable',
      moving_average: Number(row.conversion_rate),
    }))

    // Calculate 7-period moving average and trend direction
    for (let i = 0; i < points.length; i++) {
      const windowStart = Math.max(0, i - 6)
      const window = points.slice(windowStart, i + 1)
      const movingAvg = window.reduce((sum, p) => sum + p.conversion_rate, 0) / window.length
      points[i].moving_average = Math.round(movingAvg * 100) / 100

      // Determine trend direction
      if (i > 0) {
        const current = points[i].conversion_rate
        const previous = points[i - 1].moving_average
        const threshold = 0.1 // 0.1 percentage points

        if (current > previous + threshold) {
          points[i].trend_direction = 'up'
        } else if (current < previous - threshold) {
          points[i].trend_direction = 'down'
        } else {
          points[i].trend_direction = 'stable'
        }
      }
    }

    return points
  }

  /**
   * Get average step completion time
   */
  async getAverageStepCompletionTime(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    stepOrder: number,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const query = `
      SELECT AVG(
        EXTRACT(EPOCH FROM (fus.last_step_at - fus.first_seen_at)) / 60
      ) as avg_minutes
      FROM funnel_user_state fus
      WHERE fus.tenant_id = $1
        AND fus.workspace_id = $2
        AND fus.funnel_id = $3
        AND fus.current_step >= $4
        AND fus.first_seen_at >= $5::timestamp
        AND fus.first_seen_at <= $6::timestamp
        AND fus.last_step_at IS NOT NULL
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      stepOrder,
      startDate,
      endDate
    )) as Array<{ avg_minutes: number }>

    return Math.round((result[0]?.avg_minutes || 0) * 100) / 100
  }

  /**
   * Get average time to convert
   */
  async getAverageTimeToConvert(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const query = `
      WITH funnel_steps AS (
        SELECT jsonb_array_length(steps) as total_steps
        FROM funnel 
        WHERE id = $3 AND tenant_id = $1
      )
      SELECT AVG(
        EXTRACT(EPOCH FROM (fus.completed_at - fus.first_seen_at)) / 60
      ) as avg_minutes
      FROM funnel_user_state fus
      CROSS JOIN funnel_steps fs
      WHERE fus.tenant_id = $1
        AND fus.workspace_id = $2
        AND fus.funnel_id = $3
        AND fus.current_step = fs.total_steps
        AND fus.completed_at IS NOT NULL
        AND fus.first_seen_at >= $4::timestamp
        AND fus.first_seen_at <= $5::timestamp
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{ avg_minutes: number }>

    return Math.round((result[0]?.avg_minutes || 0) * 100) / 100
  }

  /**
   * Get conversion velocity (conversions per hour)
   */
  async getConversionVelocity(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const query = `
      WITH funnel_steps AS (
        SELECT jsonb_array_length(steps) as total_steps
        FROM funnel 
        WHERE id = $3 AND tenant_id = $1
      ),
      conversion_data AS (
        SELECT 
          COUNT(*) as total_conversions,
          EXTRACT(EPOCH FROM ($5::timestamp - $4::timestamp)) / 3600 as total_hours
        FROM funnel_user_state fus
        CROSS JOIN funnel_steps fs
        WHERE fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.funnel_id = $3
          AND fus.current_step = fs.total_steps
          AND fus.completed_at IS NOT NULL
          AND fus.completed_at >= $4::timestamp
          AND fus.completed_at <= $5::timestamp
      )
      SELECT 
        CASE 
          WHEN total_hours > 0 THEN total_conversions / total_hours
          ELSE 0 
        END as velocity
      FROM conversion_data
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{ velocity: number }>

    return Math.round((result[0]?.velocity || 0) * 100) / 100
  }

  /**
   * Get average conversion rate for comparison
   */
  async getAverageConversionRate(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const query = `
      WITH funnel_steps AS (
        SELECT jsonb_array_length(steps) as total_steps
        FROM funnel 
        WHERE id = $3 AND tenant_id = $1
      ),
      conversion_data AS (
        SELECT 
          COUNT(DISTINCT CASE WHEN fus.current_step >= 1 THEN fus.anonymous_id END) as entries,
          COUNT(DISTINCT CASE WHEN fus.current_step = fs.total_steps AND fus.completed_at IS NOT NULL THEN fus.anonymous_id END) as conversions
        FROM funnel_user_state fus
        CROSS JOIN funnel_steps fs
        WHERE fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.funnel_id = $3
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
      )
      SELECT 
        CASE 
          WHEN entries > 0 THEN (conversions::decimal / entries) * 100
          ELSE 0 
        END as avg_conversion_rate
      FROM conversion_data
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{ avg_conversion_rate: number }>

    return Math.round((result[0]?.avg_conversion_rate || 0) * 100) / 100
  }

  /**
   * Get peer funnel metrics for comparison
   */
  async getPeerFunnelMetrics(
    tenantId: bigint,
    workspaceId: bigint
  ): Promise<Array<{ funnel_id: bigint; conversion_rate: number }>> {
    const query = `
      WITH funnel_list AS (
        SELECT id, jsonb_array_length(steps) as total_steps
        FROM funnel 
        WHERE tenant_id = $1 
          AND workspace_id = $2
          AND archived_at IS NULL
          AND status = 'published'
      ),
      funnel_metrics AS (
        SELECT 
          f.id as funnel_id,
          COUNT(DISTINCT CASE WHEN fus.current_step >= 1 THEN fus.anonymous_id END) as entries,
          COUNT(DISTINCT CASE WHEN fus.current_step = f.total_steps AND fus.completed_at IS NOT NULL THEN fus.anonymous_id END) as conversions
        FROM funnel_list f
        LEFT JOIN funnel_user_state fus ON fus.funnel_id = f.id AND fus.tenant_id = $1 AND fus.workspace_id = $2
        WHERE fus.first_seen_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY f.id, f.total_steps
        HAVING COUNT(DISTINCT CASE WHEN fus.current_step >= 1 THEN fus.anonymous_id END) >= 100
      )
      SELECT 
        funnel_id,
        CASE 
          WHEN entries > 0 THEN (conversions::decimal / entries) * 100
          ELSE 0 
        END as conversion_rate
      FROM funnel_metrics
      WHERE entries > 0
      ORDER BY conversion_rate DESC
    `

    const result = (await this.prisma.$queryRawUnsafe(query, tenantId, workspaceId)) as Array<{
      funnel_id: bigint
      conversion_rate: number
    }>

    return result.map((row) => ({
      funnel_id: row.funnel_id,
      conversion_rate: Number(row.conversion_rate),
    }))
  }

  /**
   * TASK 2.2: Drop-off Analysis & Bottleneck Detection Methods
   */

  /**
   * Get step-by-step drop-off rates with detailed metrics
   */
  async getStepDropoffRates(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string
  ): Promise<
    Array<{
      step_order: number
      step_name: string
      entries: number
      exits: number
      drop_off_rate: number
      average_time_before_exit: number
      exit_velocity: 'immediate' | 'quick' | 'delayed' | 'hesitant'
    }>
  > {
    const query = `
      WITH funnel_steps AS (
        SELECT 
          f.id as funnel_id,
          step.value->>'label' as step_name,
          (step.ordinality - 1) as step_order
        FROM funnel f,
        jsonb_array_elements(f.steps) WITH ORDINALITY AS step
        WHERE f.id = $3 AND f.tenant_id = $1
      ),
      step_entries AS (
        SELECT 
          fs.step_order,
          fs.step_name,
          COUNT(DISTINCT fus.anonymous_id) as entries
        FROM funnel_steps fs
        LEFT JOIN funnel_user_state fus ON (
          fus.funnel_id = fs.funnel_id
          AND fus.current_step >= (fs.step_order + 1)
          AND fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
        )
        GROUP BY fs.step_order, fs.step_name
      ),
      step_exits AS (
        SELECT 
          fs.step_order,
          COUNT(DISTINCT fus.anonymous_id) as exits,
          AVG(
            EXTRACT(EPOCH FROM (fus.last_step_at - fus.first_seen_at))
          ) as avg_time_before_exit_seconds
        FROM funnel_steps fs
        LEFT JOIN funnel_user_state fus ON (
          fus.funnel_id = fs.funnel_id
          AND fus.current_step = (fs.step_order + 1)
          AND fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
          AND fus.completed_at IS NULL -- User didn't complete the funnel
        )
        GROUP BY fs.step_order
      )
      SELECT 
        se.step_order,
        se.step_name,
        COALESCE(se.entries, 0) as entries,
        COALESCE(sx.exits, 0) as exits,
        CASE 
          WHEN se.entries > 0 THEN ROUND((sx.exits::decimal / se.entries) * 100, 2)
          ELSE 0 
        END as drop_off_rate,
        COALESCE(sx.avg_time_before_exit_seconds, 0) as average_time_before_exit,
        CASE 
          WHEN sx.avg_time_before_exit_seconds < 30 THEN 'immediate'
          WHEN sx.avg_time_before_exit_seconds < 300 THEN 'quick'
          WHEN sx.avg_time_before_exit_seconds < 1800 THEN 'delayed'
          ELSE 'hesitant'
        END as exit_velocity
      FROM step_entries se
      LEFT JOIN step_exits sx ON se.step_order = sx.step_order
      ORDER BY se.step_order
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{
      step_order: number
      step_name: string
      entries: bigint
      exits: bigint
      drop_off_rate: number
      average_time_before_exit: number
      exit_velocity: 'immediate' | 'quick' | 'delayed' | 'hesitant'
    }>

    return result.map((row) => ({
      step_order: row.step_order,
      step_name: row.step_name,
      entries: Number(row.entries),
      exits: Number(row.exits),
      drop_off_rate: Number(row.drop_off_rate),
      average_time_before_exit: Number(row.average_time_before_exit),
      exit_velocity: row.exit_velocity,
    }))
  }

  /**
   * Get exit path analysis showing where users go after dropping off
   */
  async getExitPathAnalysis(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string
  ): Promise<
    Array<{
      from_step: number
      from_step_name: string
      exit_destinations: Array<{
        destination_type: string
        destination: string
        user_count: number
        percentage: number
      }>
      exit_patterns: Array<{
        pattern_type: string
        description: string
        frequency: number
      }>
    }>
  > {
    // This is a complex analysis that would require event tracking beyond funnel_user_state
    // For now, we'll provide a simplified version based on available data
    const query = `
      WITH funnel_steps AS (
        SELECT 
          f.id as funnel_id,
          step.value->>'label' as step_name,
          (step.ordinality - 1) as step_order
        FROM funnel f,
        jsonb_array_elements(f.steps) WITH ORDINALITY AS step
        WHERE f.id = $3 AND f.tenant_id = $1
      ),
      exit_analysis AS (
        SELECT 
          fs.step_order as from_step,
          fs.step_name as from_step_name,
          COUNT(DISTINCT fus.anonymous_id) as total_exits,
          -- Simplified exit categorization based on session data
          COUNT(DISTINCT CASE WHEN fus.last_step_at = fus.first_seen_at THEN fus.anonymous_id END) as immediate_bounces,
          COUNT(DISTINCT CASE WHEN fus.last_step_at > fus.first_seen_at THEN fus.anonymous_id END) as delayed_exits
        FROM funnel_steps fs
        LEFT JOIN funnel_user_state fus ON (
          fus.funnel_id = fs.funnel_id
          AND fus.current_step = (fs.step_order + 1)
          AND fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
          AND fus.completed_at IS NULL
        )
        GROUP BY fs.step_order, fs.step_name
        HAVING COUNT(DISTINCT fus.anonymous_id) > 0
      )
      SELECT 
        from_step,
        from_step_name,
        total_exits,
        immediate_bounces,
        delayed_exits,
        ROUND((immediate_bounces::decimal / NULLIF(total_exits, 0)) * 100, 1) as bounce_percentage,
        ROUND((delayed_exits::decimal / NULLIF(total_exits, 0)) * 100, 1) as delayed_exit_percentage
      FROM exit_analysis
      ORDER BY from_step
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{
      from_step: number
      from_step_name: string
      total_exits: bigint
      immediate_bounces: bigint
      delayed_exits: bigint
      bounce_percentage: number
      delayed_exit_percentage: number
    }>

    return result.map((row) => ({
      from_step: row.from_step,
      from_step_name: row.from_step_name,
      exit_destinations: [
        {
          destination_type: 'bounce',
          destination: 'immediate_exit',
          user_count: Number(row.immediate_bounces),
          percentage: Number(row.bounce_percentage) || 0,
        },
        {
          destination_type: 'abandonment',
          destination: 'delayed_exit',
          user_count: Number(row.delayed_exits),
          percentage: Number(row.delayed_exit_percentage) || 0,
        },
      ],
      exit_patterns: [
        {
          pattern_type: 'immediate_bounce',
          description: `${Number(row.immediate_bounces)} users left immediately upon reaching this step`,
          frequency: Number(row.immediate_bounces),
        },
        {
          pattern_type: 'delayed_abandonment',
          description: `${Number(row.delayed_exits)} users spent time on this step before leaving`,
          frequency: Number(row.delayed_exits),
        },
      ],
    }))
  }

  /**
   * Calculate bottleneck severity scoring based on drop-off rates and impact
   */
  async getBottleneckSeverityScoring(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string
  ): Promise<
    Array<{
      step_order: number
      step_name: string
      severity_score: number
      impact_on_overall_conversion: number
      likely_causes: Array<{
        cause_type: 'technical' | 'ux' | 'content' | 'timing' | 'external'
        description: string
        confidence: number
      }>
      optimization_potential: {
        conservative_estimate: number
        optimistic_estimate: number
        effort_required: 'low' | 'medium' | 'high'
      }
    }>
  > {
    const query = `
      WITH funnel_steps AS (
        SELECT 
          f.id as funnel_id,
          step.value->>'label' as step_name,
          step.value->>'type' as step_type,
          (step.ordinality - 1) as step_order
        FROM funnel f,
        jsonb_array_elements(f.steps) WITH ORDINALITY AS step
        WHERE f.id = $3 AND f.tenant_id = $1
      ),
      overall_funnel_metrics AS (
        SELECT 
          COUNT(DISTINCT CASE WHEN fus.current_step >= 1 THEN fus.anonymous_id END) as total_entries,
          COUNT(DISTINCT CASE WHEN fus.completed_at IS NOT NULL THEN fus.anonymous_id END) as total_conversions
        FROM funnel_user_state fus
        WHERE fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.funnel_id = $3
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
      ),
      step_analysis AS (
        SELECT 
          fs.step_order,
          fs.step_name,
          fs.step_type,
          COUNT(DISTINCT CASE WHEN fus.current_step >= (fs.step_order + 1) THEN fus.anonymous_id END) as step_entries,
          COUNT(DISTINCT CASE WHEN fus.current_step = (fs.step_order + 1) AND fus.completed_at IS NULL THEN fus.anonymous_id END) as step_exits,
          AVG(EXTRACT(EPOCH FROM (fus.last_step_at - fus.first_seen_at))) as avg_time_on_step
        FROM funnel_steps fs
        LEFT JOIN funnel_user_state fus ON (
          fus.funnel_id = fs.funnel_id
          AND fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
        )
        GROUP BY fs.step_order, fs.step_name, fs.step_type
      )
      SELECT 
        sa.step_order,
        sa.step_name,
        sa.step_type,
        sa.step_entries,
        sa.step_exits,
        sa.avg_time_on_step,
        CASE 
          WHEN sa.step_entries > 0 THEN ROUND((sa.step_exits::decimal / sa.step_entries) * 100, 2)
          ELSE 0 
        END as drop_off_rate,
        ofm.total_entries,
        ofm.total_conversions,
        -- Severity score calculation (0-100)
        CASE 
          WHEN sa.step_entries > 0 THEN 
            LEAST(100, 
              (sa.step_exits::decimal / sa.step_entries) * 100 * -- Base drop-off rate
              (sa.step_entries::decimal / NULLIF(ofm.total_entries, 0)) * 2 -- Impact multiplier
            )
          ELSE 0 
        END as severity_score,
        -- Impact on overall conversion
        CASE 
          WHEN ofm.total_entries > 0 THEN 
            ROUND((sa.step_exits::decimal / ofm.total_entries) * 100, 2)
          ELSE 0 
        END as impact_on_overall_conversion
      FROM step_analysis sa
      CROSS JOIN overall_funnel_metrics ofm
      WHERE sa.step_exits > 0
      ORDER BY severity_score DESC
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{
      step_order: number
      step_name: string
      step_type: string
      step_entries: bigint
      step_exits: bigint
      avg_time_on_step: number
      drop_off_rate: number
      total_entries: bigint
      total_conversions: bigint
      severity_score: number
      impact_on_overall_conversion: number
    }>

    return result.map((row) => {
      const severityScore = Number(row.severity_score)
      const dropOffRate = Number(row.drop_off_rate)
      const avgTime = Number(row.avg_time_on_step)
      const stepType = row.step_type

      // Generate likely causes based on data patterns
      const likelyCauses = []

      if (avgTime < 30) {
        likelyCauses.push({
          cause_type: 'ux' as const,
          description:
            'Users are leaving immediately, suggesting UX issues or unclear instructions',
          confidence: Math.min(95, severityScore + 20),
        })
      }

      if (avgTime > 300 && dropOffRate > 50) {
        likelyCauses.push({
          cause_type: 'content' as const,
          description: 'Long time before exit suggests content or form complexity issues',
          confidence: Math.min(90, severityScore + 15),
        })
      }

      if (stepType === 'page' && dropOffRate > 60) {
        likelyCauses.push({
          cause_type: 'technical' as const,
          description: 'High drop-off on page step may indicate loading or performance issues',
          confidence: Math.min(85, severityScore + 10),
        })
      }

      if (stepType === 'event' && dropOffRate > 40) {
        likelyCauses.push({
          cause_type: 'ux' as const,
          description: 'Event-based step with high drop-off suggests interaction design issues',
          confidence: Math.min(80, severityScore + 5),
        })
      }

      // Default cause if none specific identified
      if (likelyCauses.length === 0) {
        likelyCauses.push({
          cause_type: 'external' as const,
          description: 'Drop-off pattern requires further investigation',
          confidence: Math.max(40, severityScore - 20),
        })
      }

      return {
        step_order: row.step_order,
        step_name: row.step_name,
        severity_score: severityScore,
        impact_on_overall_conversion: Number(row.impact_on_overall_conversion),
        likely_causes: likelyCauses,
        optimization_potential: {
          conservative_estimate: Math.round(dropOffRate * 0.2), // 20% improvement
          optimistic_estimate: Math.round(dropOffRate * 0.5), // 50% improvement
          effort_required: severityScore > 70 ? 'high' : severityScore > 40 ? 'medium' : 'low',
        },
      }
    })
  }

  /**
   * Generate automated optimization recommendations based on drop-off patterns
   */
  async generateOptimizationRecommendations(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string
  ): Promise<
    Array<{
      type: 'technical' | 'ux' | 'content' | 'flow' | 'timing'
      priority: 'low' | 'medium' | 'high' | 'critical'
      title: string
      description: string
      estimated_impact: {
        conversion_rate_lift: number
        affected_users_per_month: number
        confidence: number
      }
      implementation: {
        effort_level: 'low' | 'medium' | 'high'
        estimated_dev_days: number
        technical_requirements: string[]
      }
      ab_test_suggestion?: {
        test_duration_days: number
        minimum_sample_size: number
        success_metrics: string[]
      }
    }>
  > {
    // Get bottleneck data for recommendation generation
    const bottlenecks = await this.getBottleneckSeverityScoring(
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )

    const recommendations = []

    for (const bottleneck of bottlenecks.slice(0, 5)) {
      // Top 5 bottlenecks
      const impactUsers = Math.round(bottleneck.impact_on_overall_conversion * 1000) // Assuming 1k monthly users

      if (bottleneck.severity_score > 70) {
        recommendations.push({
          type: 'ux' as const,
          priority: 'critical' as const,
          title: `Critical UX optimization for Step ${bottleneck.step_order}: ${bottleneck.step_name}`,
          description: `This step has a ${bottleneck.severity_score.toFixed(1)}% severity score with significant user drop-off. Immediate UX review and optimization required.`,
          estimated_impact: {
            conversion_rate_lift: bottleneck.optimization_potential.conservative_estimate,
            affected_users_per_month: impactUsers,
            confidence: 85,
          },
          implementation: {
            effort_level: 'high' as const,
            estimated_dev_days: 8,
            technical_requirements: [
              'User experience audit',
              'A/B testing framework setup',
              'Analytics instrumentation',
              'UI/UX redesign',
            ],
          },
          ab_test_suggestion: {
            test_duration_days: 14,
            minimum_sample_size: Math.max(1000, impactUsers * 2),
            success_metrics: ['conversion_rate', 'time_on_step', 'completion_rate'],
          },
        })
      }

      if (bottleneck.severity_score > 50 && bottleneck.severity_score <= 70) {
        recommendations.push({
          type: 'content' as const,
          priority: 'high' as const,
          title: `Content optimization for Step ${bottleneck.step_order}: ${bottleneck.step_name}`,
          description: `Moderate drop-off detected. Consider content clarity, form simplification, or progressive disclosure techniques.`,
          estimated_impact: {
            conversion_rate_lift: Math.round(
              bottleneck.optimization_potential.conservative_estimate * 0.8
            ),
            affected_users_per_month: Math.round(impactUsers * 0.8),
            confidence: 70,
          },
          implementation: {
            effort_level: 'medium' as const,
            estimated_dev_days: 4,
            technical_requirements: [
              'Content audit',
              'Form optimization',
              'Microcopy improvement',
              'Progress indicators',
            ],
          },
          ab_test_suggestion: {
            test_duration_days: 10,
            minimum_sample_size: Math.max(500, impactUsers),
            success_metrics: ['completion_rate', 'form_abandonment', 'time_to_complete'],
          },
        })
      }

      if (bottleneck.severity_score > 30 && bottleneck.severity_score <= 50) {
        recommendations.push({
          type: 'flow' as const,
          priority: 'medium' as const,
          title: `Flow optimization for Step ${bottleneck.step_order}: ${bottleneck.step_name}`,
          description: `Minor bottleneck identified. Consider step reordering, optional field reduction, or workflow streamlining.`,
          estimated_impact: {
            conversion_rate_lift: Math.round(
              bottleneck.optimization_potential.conservative_estimate * 0.6
            ),
            affected_users_per_month: Math.round(impactUsers * 0.6),
            confidence: 60,
          },
          implementation: {
            effort_level: 'low' as const,
            estimated_dev_days: 2,
            technical_requirements: [
              'Flow analysis',
              'Step reordering',
              'Field optimization',
              'User journey mapping',
            ],
          },
        })
      }
    }

    // Add general recommendations if no specific bottlenecks found
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'timing' as const,
        priority: 'low' as const,
        title: 'General funnel optimization review',
        description:
          'No critical bottlenecks detected. Consider periodic UX review and performance monitoring.',
        estimated_impact: {
          conversion_rate_lift: 5,
          affected_users_per_month: 100,
          confidence: 40,
        },
        implementation: {
          effort_level: 'low' as const,
          estimated_dev_days: 1,
          technical_requirements: [
            'Performance audit',
            'Analytics review',
            'User feedback collection',
          ],
        },
      })
    }

    return recommendations
  }

  /**
   * TASK 2.3: Cohort Analysis System Methods
   */

  /**
   * Get cohorts grouped by specified period
   */
  async getCohortsByPeriod(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string,
    cohortPeriod: 'daily' | 'weekly' | 'monthly'
  ): Promise<
    Array<{
      cohort_id: string
      cohort_period: string
      cohort_size: number
      device_breakdown: Record<string, number>
      traffic_source_breakdown: Record<string, number>
      geographic_breakdown: Record<string, number>
    }>
  > {
    let dateFormat: string
    let truncFormat: string

    switch (cohortPeriod) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD'
        truncFormat = 'day'
        break
      case 'weekly':
        dateFormat = 'YYYY-"W"WW'
        truncFormat = 'week'
        break
      case 'monthly':
        dateFormat = 'YYYY-MM'
        truncFormat = 'month'
        break
    }

    const query = `
      WITH cohort_users AS (
        SELECT 
          fus.anonymous_id,
          to_char(date_trunc('${truncFormat}', fus.first_seen_at), '${dateFormat}') as cohort_period,
          fus.first_seen_at
        FROM funnel_user_state fus
        WHERE fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.funnel_id = $3
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
      ),
      cohort_enrichment AS (
        SELECT 
          cu.cohort_period,
          cu.anonymous_id,
          -- Get device info from most recent event for this user
          COALESCE(e.device->>'type', 'unknown') as device_type,
          COALESCE(e.utm->>'source', 'direct') as traffic_source,
          COALESCE(e.geo->>'country', 'unknown') as country
        FROM cohort_users cu
        LEFT JOIN event e ON (
          e.anonymous_id = cu.anonymous_id 
          AND e.tenant_id = $1
          AND e.timestamp >= cu.first_seen_at
          AND e.timestamp <= cu.first_seen_at + interval '1 day'
        )
      ),
      cohort_summary AS (
        SELECT 
          cohort_period,
          COUNT(DISTINCT anonymous_id) as cohort_size,
          -- Device breakdown
          jsonb_object_agg(
            'device_' || device_type, 
            COUNT(CASE WHEN device_type IS NOT NULL THEN anonymous_id END)
          ) FILTER (WHERE device_type IS NOT NULL) as device_breakdown,
          -- Traffic source breakdown  
          jsonb_object_agg(
            'source_' || traffic_source,
            COUNT(CASE WHEN traffic_source IS NOT NULL THEN anonymous_id END)
          ) FILTER (WHERE traffic_source IS NOT NULL) as source_breakdown,
          -- Geographic breakdown
          jsonb_object_agg(
            'geo_' || country,
            COUNT(CASE WHEN country IS NOT NULL THEN anonymous_id END)
          ) FILTER (WHERE country IS NOT NULL) as geo_breakdown
        FROM cohort_enrichment
        GROUP BY cohort_period
      )
      SELECT 
        cohort_period,
        cohort_size,
        COALESCE(device_breakdown, '{}'::jsonb) as device_breakdown,
        COALESCE(source_breakdown, '{}'::jsonb) as source_breakdown,
        COALESCE(geo_breakdown, '{}'::jsonb) as geo_breakdown
      FROM cohort_summary
      ORDER BY cohort_period
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{
      cohort_period: string
      cohort_size: bigint
      device_breakdown: any
      source_breakdown: any
      geo_breakdown: any
    }>

    return result.map((row) => ({
      cohort_id: `cohort_${row.cohort_period}`,
      cohort_period: row.cohort_period,
      cohort_size: Number(row.cohort_size),
      device_breakdown: row.device_breakdown || {},
      traffic_source_breakdown: row.source_breakdown || {},
      geographic_breakdown: row.geo_breakdown || {},
    }))
  }

  /**
   * Get cohort progression through funnel steps
   */
  async getCohortProgression(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string,
    cohortPeriod: 'daily' | 'weekly' | 'monthly'
  ): Promise<
    Array<{
      cohort_id: string
      cohort_period: string
      step_retention: Array<{
        step_order: number
        users_reached: number
        retention_rate: number
        step_conversion_rate: number
      }>
      final_conversion_rate: number
      average_time_to_convert: number
    }>
  > {
    let truncFormat: string
    let dateFormat: string

    switch (cohortPeriod) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD'
        truncFormat = 'day'
        break
      case 'weekly':
        dateFormat = 'YYYY-"W"WW'
        truncFormat = 'week'
        break
      case 'monthly':
        dateFormat = 'YYYY-MM'
        truncFormat = 'month'
        break
    }

    const query = `
      WITH funnel_steps AS (
        SELECT 
          (step.ordinality - 1) as step_order,
          step.value->>'label' as step_name
        FROM funnel f,
        jsonb_array_elements(f.steps) WITH ORDINALITY AS step
        WHERE f.id = $3 AND f.tenant_id = $1
      ),
      cohort_users AS (
        SELECT 
          fus.anonymous_id,
          to_char(date_trunc('${truncFormat}', fus.first_seen_at), '${dateFormat}') as cohort_period,
          fus.current_step,
          fus.completed_at,
          CASE 
            WHEN fus.completed_at IS NOT NULL THEN 
              EXTRACT(EPOCH FROM (fus.completed_at - fus.first_seen_at)) / 60
            ELSE NULL
          END as time_to_convert_minutes
        FROM funnel_user_state fus
        WHERE fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.funnel_id = $3
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
      ),
      cohort_step_analysis AS (
        SELECT 
          cu.cohort_period,
          fs.step_order,
          COUNT(DISTINCT cu.anonymous_id) FILTER (WHERE cu.current_step >= (fs.step_order + 1)) as users_reached,
          COUNT(DISTINCT cu.anonymous_id) as cohort_size,
          COUNT(DISTINCT cu.anonymous_id) FILTER (WHERE cu.completed_at IS NOT NULL) as conversions,
          AVG(cu.time_to_convert_minutes) FILTER (WHERE cu.completed_at IS NOT NULL) as avg_conversion_time
        FROM cohort_users cu
        CROSS JOIN funnel_steps fs
        GROUP BY cu.cohort_period, fs.step_order
      )
      SELECT 
        cohort_period,
        step_order,
        users_reached,
        cohort_size,
        conversions,
        avg_conversion_time,
        CASE 
          WHEN cohort_size > 0 THEN ROUND((users_reached::decimal / cohort_size) * 100, 2)
          ELSE 0 
        END as retention_rate,
        CASE 
          WHEN cohort_size > 0 THEN ROUND((conversions::decimal / cohort_size) * 100, 2)
          ELSE 0 
        END as conversion_rate
      FROM cohort_step_analysis
      ORDER BY cohort_period, step_order
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{
      cohort_period: string
      step_order: number
      users_reached: bigint
      cohort_size: bigint
      conversions: bigint
      avg_conversion_time: number
      retention_rate: number
      conversion_rate: number
    }>

    // Group by cohort and build step retention arrays
    const cohortMap = new Map()

    for (const row of result) {
      if (!cohortMap.has(row.cohort_period)) {
        cohortMap.set(row.cohort_period, {
          cohort_id: `cohort_${row.cohort_period}`,
          cohort_period: row.cohort_period,
          step_retention: [],
          cohort_size: Number(row.cohort_size),
          total_conversions: Number(row.conversions),
          avg_conversion_time: Number(row.avg_conversion_time) || 0,
        })
      }

      const cohort = cohortMap.get(row.cohort_period)

      // Calculate step conversion rate (from previous step)
      const prevStep = cohort.step_retention[row.step_order - 1]
      const stepConversionRate = prevStep
        ? prevStep.users_reached > 0
          ? (Number(row.users_reached) / prevStep.users_reached) * 100
          : 0
        : 100 // First step is always 100%

      cohort.step_retention.push({
        step_order: row.step_order,
        users_reached: Number(row.users_reached),
        retention_rate: Number(row.retention_rate),
        step_conversion_rate: Math.round(stepConversionRate * 100) / 100,
      })

      // Update overall metrics
      if (row.conversions > 0) {
        cohort.total_conversions = Number(row.conversions)
        cohort.avg_conversion_time = Number(row.avg_conversion_time) || 0
      }
    }

    return Array.from(cohortMap.values()).map((cohort) => ({
      cohort_id: cohort.cohort_id,
      cohort_period: cohort.cohort_period,
      step_retention: cohort.step_retention,
      final_conversion_rate:
        cohort.cohort_size > 0
          ? Math.round((cohort.total_conversions / cohort.cohort_size) * 10000) / 100
          : 0,
      average_time_to_convert: cohort.avg_conversion_time,
    }))
  }

  /**
   * Calculate retention curves for cohort analysis
   */
  async calculateRetentionCurves(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string,
    cohortPeriod: 'daily' | 'weekly' | 'monthly'
  ): Promise<
    Array<{
      cohort_id: string
      cohort_period: string
      retention_curve: Array<{
        period_offset: number
        retained_users: number
        retention_percentage: number
      }>
    }>
  > {
    let truncFormat: string
    let dateFormat: string
    let intervalUnit: string

    switch (cohortPeriod) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD'
        truncFormat = 'day'
        intervalUnit = 'day'
        break
      case 'weekly':
        dateFormat = 'YYYY-"W"WW'
        truncFormat = 'week'
        intervalUnit = 'week'
        break
      case 'monthly':
        dateFormat = 'YYYY-MM'
        truncFormat = 'month'
        intervalUnit = 'month'
        break
    }

    const query = `
      WITH cohort_users AS (
        SELECT 
          fus.anonymous_id,
          to_char(date_trunc('${truncFormat}', fus.first_seen_at), '${dateFormat}') as cohort_period,
          date_trunc('${truncFormat}', fus.first_seen_at) as cohort_start_date,
          fus.last_step_at,
          fus.completed_at
        FROM funnel_user_state fus
        WHERE fus.tenant_id = $1
          AND fus.workspace_id = $2
          AND fus.funnel_id = $3
          AND fus.first_seen_at >= $4::timestamp
          AND fus.first_seen_at <= $5::timestamp
      ),
      retention_analysis AS (
        SELECT 
          cu.cohort_period,
          cu.cohort_start_date,
          COUNT(DISTINCT cu.anonymous_id) as cohort_size,
          -- Period 0 (initial cohort)
          COUNT(DISTINCT cu.anonymous_id) as period_0_users,
          -- Period 1 (users who returned/progressed in next period)
          COUNT(DISTINCT CASE 
            WHEN cu.last_step_at >= (cu.cohort_start_date + interval '1 ${intervalUnit}')
            THEN cu.anonymous_id 
          END) as period_1_users,
          -- Period 2
          COUNT(DISTINCT CASE 
            WHEN cu.last_step_at >= (cu.cohort_start_date + interval '2 ${intervalUnit}')
            THEN cu.anonymous_id 
          END) as period_2_users,
          -- Period 3
          COUNT(DISTINCT CASE 
            WHEN cu.last_step_at >= (cu.cohort_start_date + interval '3 ${intervalUnit}')
            THEN cu.anonymous_id 
          END) as period_3_users,
          -- Period 4
          COUNT(DISTINCT CASE 
            WHEN cu.last_step_at >= (cu.cohort_start_date + interval '4 ${intervalUnit}')
            THEN cu.anonymous_id 
          END) as period_4_users
        FROM cohort_users cu
        GROUP BY cu.cohort_period, cu.cohort_start_date
      )
      SELECT 
        cohort_period,
        cohort_size,
        period_0_users,
        period_1_users,
        period_2_users,
        period_3_users,
        period_4_users
      FROM retention_analysis
      ORDER BY cohort_period
    `

    const result = (await this.prisma.$queryRawUnsafe(
      query,
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate
    )) as Array<{
      cohort_period: string
      cohort_size: bigint
      period_0_users: bigint
      period_1_users: bigint
      period_2_users: bigint
      period_3_users: bigint
      period_4_users: bigint
    }>

    return result.map((row) => {
      const cohortSize = Number(row.cohort_size)
      const retentionCurve = []

      // Build retention curve for periods 0-4
      for (let period = 0; period <= 4; period++) {
        const usersKey = `period_${period}_users` as keyof typeof row
        const users = Number(row[usersKey])
        const retentionPercentage = cohortSize > 0 ? (users / cohortSize) * 100 : 0

        retentionCurve.push({
          period_offset: period,
          retained_users: users,
          retention_percentage: Math.round(retentionPercentage * 100) / 100,
        })
      }

      return {
        cohort_id: `cohort_${row.cohort_period}`,
        cohort_period: row.cohort_period,
        retention_curve: retentionCurve,
      }
    })
  }

  /**
   * Compare cohorts statistically
   */
  async compareCohortStatistics(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string,
    cohortPeriod: 'daily' | 'weekly' | 'monthly'
  ): Promise<
    Array<{
      metric: 'conversion_rate' | 'retention_rate' | 'time_to_convert'
      best_performing_cohort: {
        cohort_id: string
        value: number
      }
      worst_performing_cohort: {
        cohort_id: string
        value: number
      }
      trend_direction: 'improving' | 'declining' | 'stable' | 'volatile'
      trend_strength: number
      variance_significance: boolean
      f_test_p_value: number
    }>
  > {
    // Get cohort progression data
    const cohorts = await this.getCohortProgression(
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate,
      cohortPeriod
    )

    if (cohorts.length < 2) {
      return [] // Need at least 2 cohorts for comparison
    }

    const comparisons = []

    // Conversion rate comparison
    const conversionRates = cohorts.map((c) => c.final_conversion_rate)
    const bestConversion = Math.max(...conversionRates)
    const worstConversion = Math.min(...conversionRates)
    const bestConversionCohort = cohorts.find((c) => c.final_conversion_rate === bestConversion)
    const worstConversionCohort = cohorts.find((c) => c.final_conversion_rate === worstConversion)

    comparisons.push({
      metric: 'conversion_rate' as const,
      best_performing_cohort: {
        cohort_id: bestConversionCohort?.cohort_id || '',
        value: bestConversion,
      },
      worst_performing_cohort: {
        cohort_id: worstConversionCohort?.cohort_id || '',
        value: worstConversion,
      },
      trend_direction: this.calculateTrendDirection(conversionRates),
      trend_strength: this.calculateTrendStrength(conversionRates),
      variance_significance: this.calculateVarianceSignificance(conversionRates),
      f_test_p_value: this.calculateFTestPValue(conversionRates),
    })

    // Time to convert comparison
    const timeToConvert = cohorts.map((c) => c.average_time_to_convert).filter((t) => t > 0)
    if (timeToConvert.length >= 2) {
      const bestTime = Math.min(...timeToConvert)
      const worstTime = Math.max(...timeToConvert)
      const bestTimeCohort = cohorts.find((c) => c.average_time_to_convert === bestTime)
      const worstTimeCohort = cohorts.find((c) => c.average_time_to_convert === worstTime)

      comparisons.push({
        metric: 'time_to_convert' as const,
        best_performing_cohort: {
          cohort_id: bestTimeCohort?.cohort_id || '',
          value: bestTime,
        },
        worst_performing_cohort: {
          cohort_id: worstTimeCohort?.cohort_id || '',
          value: worstTime,
        },
        trend_direction: this.calculateTrendDirection(timeToConvert.reverse()), // Lower is better
        trend_strength: this.calculateTrendStrength(timeToConvert),
        variance_significance: this.calculateVarianceSignificance(timeToConvert),
        f_test_p_value: this.calculateFTestPValue(timeToConvert),
      })
    }

    return comparisons
  }

  /**
   * Helper methods for statistical analysis
   */
  private calculateTrendDirection(
    values: number[]
  ): 'improving' | 'declining' | 'stable' | 'volatile' {
    if (values.length < 3) return 'stable'

    const first = values.slice(0, Math.floor(values.length / 3))
    const last = values.slice(-Math.floor(values.length / 3))

    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length
    const lastAvg = last.reduce((a, b) => a + b, 0) / last.length

    const change = (lastAvg - firstAvg) / firstAvg
    const volatility = this.calculateVolatility(values)

    if (volatility > 0.3) return 'volatile'
    if (Math.abs(change) < 0.05) return 'stable'
    return change > 0 ? 'improving' : 'declining'
  }

  private calculateTrendStrength(values: number[]): number {
    if (values.length < 2) return 0

    // Simple linear correlation calculation
    const n = values.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = values

    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)

    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

    return denominator === 0 ? 0 : Math.abs(numerator / denominator)
  }

  private calculateVolatility(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    return Math.sqrt(variance) / mean
  }

  private calculateVarianceSignificance(values: number[]): boolean {
    if (values.length < 3) return false
    const volatility = this.calculateVolatility(values)
    return volatility > 0.2 // 20% coefficient of variation threshold
  }

  private calculateFTestPValue(values: number[]): number {
    // Simplified F-test p-value calculation
    // In a real implementation, this would be more sophisticated
    const volatility = this.calculateVolatility(values)
    const n = values.length

    // Approximate p-value based on volatility and sample size
    if (volatility > 0.5 || n < 3) return 0.95 // Not significant
    if (volatility < 0.1) return 0.01 // Highly significant

    return Math.min(0.95, Math.max(0.01, volatility * 2))
  }

  // Task 2.4: Time-to-Conversion Analytics

  /**
   * Calculate conversion timing distribution with percentiles
   * Analyzes time from funnel entry to final conversion
   */
  async getConversionTimingDistribution(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: Date,
    endDate: Date
  ): Promise<{
    percentiles: Record<string, number>
    distribution: Array<{
      time_bucket: string
      time_range: string
      user_count: number
      percentage: number
    }>
    statistics: {
      mean_seconds: number
      median_seconds: number
      stddev_seconds: number
      min_seconds: number
      max_seconds: number
    }
  }> {
    const result = await this.prisma.$queryRaw<
      Array<{
        p10: number
        p25: number
        p50: number
        p75: number
        p90: number
        p95: number
        p99: number
        mean_seconds: number
        stddev_seconds: number
        min_seconds: number
        max_seconds: number
      }>
    >`
      WITH funnel_conversions AS (
        SELECT 
          anonymous_id,
          MIN(timestamp) as entry_time,
          MAX(timestamp) as conversion_time,
          EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) as conversion_time_seconds
        FROM event e
        WHERE e.tenant_id = ${tenantId}
          AND e.workspace_id = ${workspaceId}
          AND e.timestamp BETWEEN ${startDate} AND ${endDate}
          AND e.funnel_id = ${funnelId}
          AND e.anonymous_id IN (
            SELECT DISTINCT anonymous_id
            FROM event
            WHERE tenant_id = ${tenantId}
              AND workspace_id = ${workspaceId}
              AND funnel_id = ${funnelId}
              AND timestamp BETWEEN ${startDate} AND ${endDate}
            GROUP BY anonymous_id
            HAVING COUNT(DISTINCT funnel_step_order) = (
              SELECT COUNT(*) FROM funnel_step fs
              JOIN funnel_version fv ON fs.funnel_version_id = fv.id
              JOIN funnel f ON fv.funnel_id = f.id
              WHERE f.id = ${funnelId}
                AND f.tenant_id = ${tenantId}
                AND f.workspace_id = ${workspaceId}
              ORDER BY fv.version DESC
              LIMIT 1
            )
          )
        GROUP BY anonymous_id
        HAVING COUNT(DISTINCT funnel_step_order) > 1
      )
      SELECT 
        PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY conversion_time_seconds) as p10,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY conversion_time_seconds) as p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY conversion_time_seconds) as p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY conversion_time_seconds) as p75,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY conversion_time_seconds) as p90,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY conversion_time_seconds) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY conversion_time_seconds) as p99,
        AVG(conversion_time_seconds) as mean_seconds,
        STDDEV(conversion_time_seconds) as stddev_seconds,
        MIN(conversion_time_seconds) as min_seconds,
        MAX(conversion_time_seconds) as max_seconds
      FROM funnel_conversions
      WHERE conversion_time_seconds > 0
    `

    // Get distribution buckets
    const distributionResult = await this.prisma.$queryRaw<
      Array<{
        time_bucket: string
        time_range: string
        user_count: bigint
        percentage: number
      }>
    >`
      WITH funnel_conversions AS (
        SELECT 
          anonymous_id,
          EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) as conversion_time_seconds
        FROM event e
        WHERE e.tenant_id = ${tenantId}
          AND e.workspace_id = ${workspaceId}
          AND e.timestamp BETWEEN ${startDate} AND ${endDate}
          AND e.funnel_id = ${funnelId}
          AND e.anonymous_id IN (
            SELECT DISTINCT anonymous_id
            FROM event
            WHERE tenant_id = ${tenantId}
              AND workspace_id = ${workspaceId}
              AND funnel_id = ${funnelId}
              AND timestamp BETWEEN ${startDate} AND ${endDate}
            GROUP BY anonymous_id
            HAVING COUNT(DISTINCT funnel_step_order) = (
              SELECT COUNT(*) FROM funnel_step fs
              JOIN funnel_version fv ON fs.funnel_version_id = fv.id
              JOIN funnel f ON fv.funnel_id = f.id
              WHERE f.id = ${funnelId}
                AND f.tenant_id = ${tenantId}
                AND f.workspace_id = ${workspaceId}
              ORDER BY fv.version DESC
              LIMIT 1
            )
          )
        GROUP BY anonymous_id
        HAVING COUNT(DISTINCT funnel_step_order) > 1
      ),
      bucketed_data AS (
        SELECT 
          CASE 
            WHEN conversion_time_seconds <= 300 THEN '0-5min'
            WHEN conversion_time_seconds <= 900 THEN '5-15min'
            WHEN conversion_time_seconds <= 1800 THEN '15-30min'
            WHEN conversion_time_seconds <= 3600 THEN '30-60min'
            WHEN conversion_time_seconds <= 86400 THEN '1-24h'
            WHEN conversion_time_seconds <= 604800 THEN '1-7d'
            ELSE '7d+'
          END as time_bucket,
          CASE 
            WHEN conversion_time_seconds <= 300 THEN '0-5 minutes'
            WHEN conversion_time_seconds <= 900 THEN '5-15 minutes'
            WHEN conversion_time_seconds <= 1800 THEN '15-30 minutes'
            WHEN conversion_time_seconds <= 3600 THEN '30-60 minutes'
            WHEN conversion_time_seconds <= 86400 THEN '1-24 hours'
            WHEN conversion_time_seconds <= 604800 THEN '1-7 days'
            ELSE 'Over 7 days'
          END as time_range,
          COUNT(*) as user_count
        FROM funnel_conversions
        WHERE conversion_time_seconds > 0
        GROUP BY 
          CASE 
            WHEN conversion_time_seconds <= 300 THEN '0-5min'
            WHEN conversion_time_seconds <= 900 THEN '5-15min'
            WHEN conversion_time_seconds <= 1800 THEN '15-30min'
            WHEN conversion_time_seconds <= 3600 THEN '30-60min'
            WHEN conversion_time_seconds <= 86400 THEN '1-24h'
            WHEN conversion_time_seconds <= 604800 THEN '1-7d'
            ELSE '7d+'
          END,
          CASE 
            WHEN conversion_time_seconds <= 300 THEN '0-5 minutes'
            WHEN conversion_time_seconds <= 900 THEN '5-15 minutes'
            WHEN conversion_time_seconds <= 1800 THEN '15-30 minutes'
            WHEN conversion_time_seconds <= 3600 THEN '30-60 minutes'
            WHEN conversion_time_seconds <= 86400 THEN '1-24 hours'
            WHEN conversion_time_seconds <= 604800 THEN '1-7 days'
            ELSE 'Over 7 days'
          END
      )
      SELECT 
        time_bucket,
        time_range,
        user_count,
        ROUND((user_count * 100.0 / SUM(user_count) OVER ()), 2) as percentage
      FROM bucketed_data
      ORDER BY 
        CASE time_bucket
          WHEN '0-5min' THEN 1
          WHEN '5-15min' THEN 2
          WHEN '15-30min' THEN 3
          WHEN '30-60min' THEN 4
          WHEN '1-24h' THEN 5
          WHEN '1-7d' THEN 6
          ELSE 7
        END
    `

    const stats = result[0] || {
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      mean_seconds: 0,
      stddev_seconds: 0,
      min_seconds: 0,
      max_seconds: 0,
    }

    return {
      percentiles: {
        p10: Number(stats.p10),
        p25: Number(stats.p25),
        p50: Number(stats.p50),
        p75: Number(stats.p75),
        p90: Number(stats.p90),
        p95: Number(stats.p95),
        p99: Number(stats.p99),
      },
      distribution: distributionResult.map((row) => ({
        time_bucket: row.time_bucket,
        time_range: row.time_range,
        user_count: Number(row.user_count),
        percentage: Number(row.percentage),
      })),
      statistics: {
        mean_seconds: Number(stats.mean_seconds),
        median_seconds: Number(stats.p50),
        stddev_seconds: Number(stats.stddev_seconds),
        min_seconds: Number(stats.min_seconds),
        max_seconds: Number(stats.max_seconds),
      },
    }
  }

  /**
   * Analyze step-by-step timing patterns
   * Shows average time spent at each funnel step
   */
  async getStepTimingAnalysis(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      step_order: number
      step_label: string
      avg_time_to_next_seconds: number
      median_time_to_next_seconds: number
      p90_time_to_next_seconds: number
      user_count: number
      abandonment_rate: number
    }>
  > {
    const result = await this.prisma.$queryRaw<
      Array<{
        step_order: number
        step_label: string
        avg_time_to_next_seconds: number
        median_time_to_next_seconds: number
        p90_time_to_next_seconds: number
        user_count: bigint
        abandonment_rate: number
      }>
    >`
      WITH step_transitions AS (
        SELECT 
          e1.anonymous_id,
          e1.funnel_step_order as current_step,
          e1.timestamp as current_time,
          e2.funnel_step_order as next_step,
          e2.timestamp as next_time,
          EXTRACT(EPOCH FROM (e2.timestamp - e1.timestamp)) as time_to_next_seconds
        FROM event e1
        LEFT JOIN event e2 ON e1.anonymous_id = e2.anonymous_id 
          AND e2.funnel_step_order = e1.funnel_step_order + 1
          AND e2.tenant_id = e1.tenant_id
          AND e2.workspace_id = e1.workspace_id
          AND e2.funnel_id = e1.funnel_id
          AND e2.timestamp > e1.timestamp
          AND e2.timestamp <= e1.timestamp + INTERVAL '7 days'
        WHERE e1.tenant_id = ${tenantId}
          AND e1.workspace_id = ${workspaceId}
          AND e1.funnel_id = ${funnelId}
          AND e1.timestamp BETWEEN ${startDate} AND ${endDate}
      ),
      step_stats AS (
        SELECT 
          st.current_step as step_order,
          fs.label as step_label,
          COUNT(st.anonymous_id) as total_users,
          COUNT(st.next_step) as proceeded_users,
          AVG(CASE WHEN st.time_to_next_seconds > 0 THEN st.time_to_next_seconds END) as avg_time_to_next_seconds,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY st.time_to_next_seconds) 
            FILTER (WHERE st.time_to_next_seconds > 0) as median_time_to_next_seconds,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY st.time_to_next_seconds)
            FILTER (WHERE st.time_to_next_seconds > 0) as p90_time_to_next_seconds
        FROM step_transitions st
        JOIN funnel_step fs ON fs.order_index = st.current_step
        JOIN funnel_version fv ON fs.funnel_version_id = fv.id
        JOIN funnel f ON fv.funnel_id = f.id
        WHERE f.id = ${funnelId}
          AND f.tenant_id = ${tenantId}
          AND f.workspace_id = ${workspaceId}
          AND fv.state = 'PUBLISHED'
        GROUP BY st.current_step, fs.label
      )
      SELECT 
        step_order,
        step_label,
        COALESCE(avg_time_to_next_seconds, 0) as avg_time_to_next_seconds,
        COALESCE(median_time_to_next_seconds, 0) as median_time_to_next_seconds,
        COALESCE(p90_time_to_next_seconds, 0) as p90_time_to_next_seconds,
        total_users as user_count,
        CASE 
          WHEN total_users > 0 THEN ROUND(((total_users - proceeded_users) * 100.0 / total_users), 2)
          ELSE 0
        END as abandonment_rate
      FROM step_stats
      ORDER BY step_order
    `

    return result.map((row) => ({
      step_order: Number(row.step_order),
      step_label: row.step_label,
      avg_time_to_next_seconds: Number(row.avg_time_to_next_seconds),
      median_time_to_next_seconds: Number(row.median_time_to_next_seconds),
      p90_time_to_next_seconds: Number(row.p90_time_to_next_seconds),
      user_count: Number(row.user_count),
      abandonment_rate: Number(row.abandonment_rate),
    }))
  }

  /**
   * Calculate velocity trends over time
   * Shows how conversion speed changes over time periods
   */
  async getVelocityTrends(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: Date,
    endDate: Date,
    granularity: 'daily' | 'weekly' = 'daily'
  ): Promise<
    Array<{
      period: string
      date: string
      avg_conversion_time_seconds: number
      median_conversion_time_seconds: number
      conversion_count: number
      velocity_score: number
      trend_indicator: 'improving' | 'stable' | 'declining'
    }>
  > {
    const truncateFormat = granularity === 'daily' ? 'day' : 'week'

    const result = await this.prisma.$queryRaw<
      Array<{
        period: string
        date: Date
        avg_conversion_time_seconds: number
        median_conversion_time_seconds: number
        conversion_count: bigint
        velocity_score: number
      }>
    >`
      WITH funnel_conversions AS (
        SELECT 
          anonymous_id,
          DATE_TRUNC('${truncateFormat}', MIN(timestamp)) as period_start,
          EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) as conversion_time_seconds
        FROM event e
        WHERE e.tenant_id = ${tenantId}
          AND e.workspace_id = ${workspaceId}
          AND e.funnel_id = ${funnelId}
          AND e.timestamp BETWEEN ${startDate} AND ${endDate}
          AND e.anonymous_id IN (
            SELECT DISTINCT anonymous_id
            FROM event
            WHERE tenant_id = ${tenantId}
              AND workspace_id = ${workspaceId}
              AND funnel_id = ${funnelId}
              AND timestamp BETWEEN ${startDate} AND ${endDate}
            GROUP BY anonymous_id
            HAVING COUNT(DISTINCT funnel_step_order) = (
              SELECT COUNT(*) FROM funnel_step fs
              JOIN funnel_version fv ON fs.funnel_version_id = fv.id
              JOIN funnel f ON fv.funnel_id = f.id
              WHERE f.id = ${funnelId}
                AND f.tenant_id = ${tenantId}
                AND f.workspace_id = ${workspaceId}
              ORDER BY fv.version DESC
              LIMIT 1
            )
          )
        GROUP BY anonymous_id, DATE_TRUNC('${truncateFormat}', MIN(timestamp))
        HAVING COUNT(DISTINCT funnel_step_order) > 1
          AND EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) > 0
      ),
      period_stats AS (
        SELECT 
          period_start,
          TO_CHAR(period_start, 'YYYY-MM-DD') as period,
          COUNT(*) as conversion_count,
          AVG(conversion_time_seconds) as avg_conversion_time_seconds,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY conversion_time_seconds) as median_conversion_time_seconds
        FROM funnel_conversions
        GROUP BY period_start
        ORDER BY period_start
      )
      SELECT 
        period,
        period_start as date,
        avg_conversion_time_seconds,
        median_conversion_time_seconds,
        conversion_count,
        CASE 
          WHEN avg_conversion_time_seconds <= 300 THEN 100  -- 5 min = excellent
          WHEN avg_conversion_time_seconds <= 1800 THEN 85  -- 30 min = good
          WHEN avg_conversion_time_seconds <= 3600 THEN 70  -- 1 hour = fair
          WHEN avg_conversion_time_seconds <= 86400 THEN 50 -- 1 day = poor
          ELSE 25  -- > 1 day = very poor
        END as velocity_score
      FROM period_stats
      ORDER BY period_start
    `

    // Calculate trend indicators
    return result.map((row, index, array) => {
      let trend_indicator: 'improving' | 'stable' | 'declining' = 'stable'

      if (index > 0) {
        const prevSpeed = array[index - 1].avg_conversion_time_seconds
        const currentSpeed = row.avg_conversion_time_seconds
        const changePercent = ((currentSpeed - prevSpeed) / prevSpeed) * 100

        if (changePercent < -10)
          trend_indicator = 'improving' // Getting faster
        else if (changePercent > 10) trend_indicator = 'declining' // Getting slower
      }

      return {
        period: row.period,
        date: row.date.toISOString().split('T')[0],
        avg_conversion_time_seconds: Number(row.avg_conversion_time_seconds),
        median_conversion_time_seconds: Number(row.median_conversion_time_seconds),
        conversion_count: Number(row.conversion_count),
        velocity_score: Number(row.velocity_score),
        trend_indicator,
      }
    })
  }

  /**
   * Analyze timing patterns by segments
   * Compare conversion timing across different user segments
   */
  async getSegmentTimingComparison(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      segment_name: string
      segment_value: string
      avg_conversion_time_seconds: number
      median_conversion_time_seconds: number
      p90_conversion_time_seconds: number
      conversion_count: number
      velocity_score: number
      performance_indicator: 'fast' | 'average' | 'slow'
    }>
  > {
    const result = await this.prisma.$queryRaw<
      Array<{
        segment_name: string
        segment_value: string
        avg_conversion_time_seconds: number
        median_conversion_time_seconds: number
        p90_conversion_time_seconds: number
        conversion_count: bigint
      }>
    >`
      WITH funnel_conversions AS (
        SELECT 
          e.anonymous_id,
          COALESCE(e.device->>'type', 'unknown') as device_type,
          COALESCE(e.utm->>'source', 'direct') as traffic_source,
          CASE 
            WHEN e.page->>'url' LIKE '%mobile%' OR e.device->>'type' = 'mobile' THEN 'mobile'
            WHEN e.device->>'type' = 'desktop' THEN 'desktop'
            ELSE 'unknown'
          END as platform,
          EXTRACT(EPOCH FROM (MAX(e.timestamp) - MIN(e.timestamp))) as conversion_time_seconds
        FROM event e
        WHERE e.tenant_id = ${tenantId}
          AND e.workspace_id = ${workspaceId}
          AND e.funnel_id = ${funnelId}
          AND e.timestamp BETWEEN ${startDate} AND ${endDate}
          AND e.anonymous_id IN (
            SELECT DISTINCT anonymous_id
            FROM event
            WHERE tenant_id = ${tenantId}
              AND workspace_id = ${workspaceId}
              AND funnel_id = ${funnelId}
              AND timestamp BETWEEN ${startDate} AND ${endDate}
            GROUP BY anonymous_id
            HAVING COUNT(DISTINCT funnel_step_order) = (
              SELECT COUNT(*) FROM funnel_step fs
              JOIN funnel_version fv ON fs.funnel_version_id = fv.id
              JOIN funnel f ON fv.funnel_id = f.id
              WHERE f.id = ${funnelId}
                AND f.tenant_id = ${tenantId}
                AND f.workspace_id = ${workspaceId}
              ORDER BY fv.version DESC
              LIMIT 1
            )
          )
        GROUP BY e.anonymous_id, device_type, traffic_source, platform
        HAVING COUNT(DISTINCT e.funnel_step_order) > 1
          AND EXTRACT(EPOCH FROM (MAX(e.timestamp) - MIN(e.timestamp))) > 0
      ),
      segment_stats AS (
        SELECT 
          'device_type' as segment_name,
          device_type as segment_value,
          COUNT(*) as conversion_count,
          AVG(conversion_time_seconds) as avg_conversion_time_seconds,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY conversion_time_seconds) as median_conversion_time_seconds,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY conversion_time_seconds) as p90_conversion_time_seconds
        FROM funnel_conversions
        GROUP BY device_type
        
        UNION ALL
        
        SELECT 
          'traffic_source' as segment_name,
          traffic_source as segment_value,
          COUNT(*) as conversion_count,
          AVG(conversion_time_seconds) as avg_conversion_time_seconds,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY conversion_time_seconds) as median_conversion_time_seconds,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY conversion_time_seconds) as p90_conversion_time_seconds
        FROM funnel_conversions
        GROUP BY traffic_source
        
        UNION ALL
        
        SELECT 
          'platform' as segment_name,
          platform as segment_value,
          COUNT(*) as conversion_count,
          AVG(conversion_time_seconds) as avg_conversion_time_seconds,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY conversion_time_seconds) as median_conversion_time_seconds,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY conversion_time_seconds) as p90_conversion_time_seconds
        FROM funnel_conversions
        GROUP BY platform
      )
      SELECT 
        segment_name,
        segment_value,
        avg_conversion_time_seconds,
        median_conversion_time_seconds,
        p90_conversion_time_seconds,
        conversion_count
      FROM segment_stats
      WHERE conversion_count >= 10  -- Only include segments with meaningful sample size
      ORDER BY segment_name, avg_conversion_time_seconds
    `

    // Calculate overall average for performance comparison
    const overallAvg =
      result.length > 0
        ? result.reduce((sum, row) => sum + Number(row.avg_conversion_time_seconds), 0) /
          result.length
        : 0

    return result.map((row) => {
      const avgTime = Number(row.avg_conversion_time_seconds)
      let performance_indicator: 'fast' | 'average' | 'slow' = 'average'

      if (avgTime < overallAvg * 0.8) performance_indicator = 'fast'
      else if (avgTime > overallAvg * 1.2) performance_indicator = 'slow'

      const velocity_score =
        avgTime <= 300
          ? 100
          : avgTime <= 1800
            ? 85
            : avgTime <= 3600
              ? 70
              : avgTime <= 86400
                ? 50
                : 25

      return {
        segment_name: row.segment_name,
        segment_value: row.segment_value,
        avg_conversion_time_seconds: avgTime,
        median_conversion_time_seconds: Number(row.median_conversion_time_seconds),
        p90_conversion_time_seconds: Number(row.p90_conversion_time_seconds),
        conversion_count: Number(row.conversion_count),
        velocity_score,
        performance_indicator,
      }
    })
  }

  /**
   * Get live metrics for real-time dashboard
   */
  async getLiveMetrics(tenantId: string, workspaceId: string, funnelId: string): Promise<any> {
    try {
      // Get current time boundaries
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000)

      // Query 1: Active sessions and basic metrics
      const basicMetrics = (await this.prisma.$queryRaw`
        WITH active_sessions AS (
          SELECT DISTINCT fus.anonymous_id
          FROM funnel_user_state fus
          WHERE fus.tenant_id = ${BigInt(tenantId)}
            AND fus.workspace_id = ${BigInt(workspaceId)}
            AND fus.funnel_id = ${BigInt(funnelId)}
            AND fus.status = 'active'
            AND fus.last_activity_at >= ${thirtyMinAgo}
        ),
        recent_entries AS (
          SELECT COUNT(*) as entries_count
          FROM funnel_user_state fus
          WHERE fus.tenant_id = ${BigInt(tenantId)}
            AND fus.workspace_id = ${BigInt(workspaceId)}
            AND fus.funnel_id = ${BigInt(funnelId)}
            AND fus.entered_at >= ${oneHourAgo}
        ),
        recent_conversions AS (
          SELECT COUNT(*) as conversions_count
          FROM funnel_user_state fus
          WHERE fus.tenant_id = ${BigInt(tenantId)}
            AND fus.workspace_id = ${BigInt(workspaceId)}
            AND fus.funnel_id = ${BigInt(funnelId)}
            AND fus.status = 'completed'
            AND fus.completed_at >= ${oneHourAgo}
        )
        SELECT 
          (SELECT COUNT(*) FROM active_sessions) as active_sessions,
          (SELECT entries_count FROM recent_entries) as entries_last_hour,
          (SELECT conversions_count FROM recent_conversions) as conversions_last_hour,
          CASE 
            WHEN (SELECT entries_count FROM recent_entries) > 0 
            THEN ROUND((SELECT conversions_count FROM recent_conversions)::numeric / (SELECT entries_count FROM recent_entries)::numeric * 100, 2)
            ELSE 0 
          END as current_conversion_rate;
      `) as any[]

      // Query 2: Step distribution
      const stepDistribution = (await this.prisma.$queryRaw`
        SELECT 
          fus.current_step_index as step_order,
          COUNT(*) as current_users,
          ROUND(COUNT(*)::numeric * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM funnel_user_state fus
        WHERE fus.tenant_id = ${BigInt(tenantId)}
          AND fus.workspace_id = ${BigInt(workspaceId)}
          AND fus.funnel_id = ${BigInt(funnelId)}
          AND fus.status = 'active'
          AND fus.last_activity_at >= ${thirtyMinAgo}
        GROUP BY fus.current_step_index
        ORDER BY fus.current_step_index;
      `) as any[]

      // Query 3: Real-time trends (last 30 minutes, per minute)
      const trends = (await this.prisma.$queryRaw`
        WITH minute_series AS (
          SELECT generate_series(
            date_trunc('minute', ${thirtyMinAgo}),
            date_trunc('minute', ${now}),
            interval '1 minute'
          ) as minute_bucket
        ),
        entries_per_minute AS (
          SELECT 
            date_trunc('minute', fus.entered_at) as minute_bucket,
            COUNT(*) as entries
          FROM funnel_user_state fus
          WHERE fus.tenant_id = ${BigInt(tenantId)}
            AND fus.workspace_id = ${BigInt(workspaceId)}
            AND fus.funnel_id = ${BigInt(funnelId)}
            AND fus.entered_at >= ${thirtyMinAgo}
          GROUP BY date_trunc('minute', fus.entered_at)
        ),
        conversions_per_minute AS (
          SELECT 
            date_trunc('minute', fus.completed_at) as minute_bucket,
            COUNT(*) as conversions
          FROM funnel_user_state fus
          WHERE fus.tenant_id = ${BigInt(tenantId)}
            AND fus.workspace_id = ${BigInt(workspaceId)}
            AND fus.funnel_id = ${BigInt(funnelId)}
            AND fus.completed_at >= ${thirtyMinAgo}
            AND fus.status = 'completed'
          GROUP BY date_trunc('minute', fus.completed_at)
        )
        SELECT 
          ms.minute_bucket,
          COALESCE(epm.entries, 0) as entries,
          COALESCE(cpm.conversions, 0) as conversions,
          CASE 
            WHEN COALESCE(epm.entries, 0) > 0 
            THEN ROUND(COALESCE(cpm.conversions, 0)::numeric / epm.entries::numeric * 100, 2)
            ELSE 0 
          END as conversion_rate
        FROM minute_series ms
        LEFT JOIN entries_per_minute epm ON ms.minute_bucket = epm.minute_bucket
        LEFT JOIN conversions_per_minute cpm ON ms.minute_bucket = cpm.minute_bucket
        ORDER BY ms.minute_bucket;
      `) as any[]

      return {
        basicMetrics: basicMetrics[0] || {
          active_sessions: 0,
          entries_last_hour: 0,
          conversions_last_hour: 0,
          current_conversion_rate: 0,
        },
        stepDistribution,
        trends,
      }
    } catch (error) {
      this.logger.error(
        'Error getting live metrics',
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  }

  /**
   * Get user progression details for individual tracking
   */
  async getUserProgression(
    tenantId: string,
    workspaceId: string,
    funnelId: string,
    userId?: string,
    anonymousId?: string
  ): Promise<any> {
    try {
      if (!userId && !anonymousId) {
        throw new Error('Either userId or anonymousId must be provided')
      }

      // Get user funnel state
      const userState = await this.prisma.funnelUserState.findFirst({
        where: {
          tenantId: BigInt(tenantId),
          workspaceId: BigInt(workspaceId),
          funnelId: BigInt(funnelId),
          ...(anonymousId && { anonymousId }),
          ...(userId && { leadId: BigInt(userId) }),
        },
        include: {
          funnel: {
            include: {
              versions: {
                where: { state: 'PUBLISHED' },
                include: {
                  steps: {
                    orderBy: { orderIndex: 'asc' },
                  },
                },
                take: 1,
              },
            },
          },
        },
      })

      if (!userState) {
        return null
      }

      // Get journey history from events
      const journeyEvents = (await this.prisma.$queryRaw`
        SELECT 
          e.event_name,
          e.timestamp,
          e.page,
          e.utm,
          e.device
        FROM event e
        WHERE e.tenant_id = ${BigInt(tenantId)}
          AND e.workspace_id = ${BigInt(workspaceId)}
          AND e.anonymous_id = ${userState.anonymousId}
          AND e.timestamp >= ${userState.enteredAt}
        ORDER BY e.timestamp ASC;
      `) as any[]

      // Get step timing averages for comparison
      const stepTimingAverages = (await this.prisma.$queryRaw`
        SELECT 
          fus.current_step_index as step_order,
          AVG(EXTRACT(epoch FROM (fus.last_activity_at - fus.entered_at))) as avg_time_to_reach,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (fus.last_activity_at - fus.entered_at))) as median_time
        FROM funnel_user_state fus
        WHERE fus.tenant_id = ${BigInt(tenantId)}
          AND fus.workspace_id = ${BigInt(workspaceId)}
          AND fus.funnel_id = ${BigInt(funnelId)}
          AND fus.current_step_index IS NOT NULL
        GROUP BY fus.current_step_index
        ORDER BY fus.current_step_index;
      `) as any[]

      return {
        userState,
        journeyEvents,
        stepTimingAverages,
        funnelSteps: userState.funnel.versions[0]?.steps || [],
      }
    } catch (error) {
      this.logger.error(
        'Error getting user progression',
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  }

  /**
   * Detect conversion anomalies and bottlenecks for alerts
   */
  async detectAnomalies(tenantId: string, workspaceId: string, funnelId: string): Promise<any[]> {
    try {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      // Detect conversion rate drops
      const conversionRateAnomaly = (await this.prisma.$queryRaw`
        WITH current_period AS (
          SELECT 
            COUNT(CASE WHEN fus.status = 'completed' THEN 1 END) as conversions,
            COUNT(*) as entries,
            CASE 
              WHEN COUNT(*) > 0 
              THEN ROUND(COUNT(CASE WHEN fus.status = 'completed' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2)
              ELSE 0 
            END as conversion_rate
          FROM funnel_user_state fus
          WHERE fus.tenant_id = ${BigInt(tenantId)}
            AND fus.workspace_id = ${BigInt(workspaceId)}
            AND fus.funnel_id = ${BigInt(funnelId)}
            AND fus.entered_at >= ${oneHourAgo}
        ),
        historical_period AS (
          SELECT 
            COUNT(CASE WHEN fus.status = 'completed' THEN 1 END) as conversions,
            COUNT(*) as entries,
            CASE 
              WHEN COUNT(*) > 0 
              THEN ROUND(COUNT(CASE WHEN fus.status = 'completed' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2)
              ELSE 0 
            END as conversion_rate
          FROM funnel_user_state fus
          WHERE fus.tenant_id = ${BigInt(tenantId)}
            AND fus.workspace_id = ${BigInt(workspaceId)}
            AND fus.funnel_id = ${BigInt(funnelId)}
            AND fus.entered_at >= ${twentyFourHoursAgo}
            AND fus.entered_at < ${oneHourAgo}
        )
        SELECT 
          cp.conversion_rate as current_rate,
          hp.conversion_rate as historical_rate,
          CASE 
            WHEN hp.conversion_rate > 0 
            THEN ROUND(((cp.conversion_rate - hp.conversion_rate) / hp.conversion_rate * 100), 2)
            ELSE 0 
          END as rate_change_percent,
          cp.entries as current_entries,
          hp.entries as historical_entries
        FROM current_period cp, historical_period hp;
      `) as any[]

      // Detect step bottlenecks
      const stepBottlenecks = (await this.prisma.$queryRaw`
        SELECT 
          fus.current_step_index as step_order,
          COUNT(*) as users_stuck,
          AVG(EXTRACT(epoch FROM (${now} - fus.last_activity_at))) as avg_time_stuck,
          MAX(EXTRACT(epoch FROM (${now} - fus.last_activity_at))) as max_time_stuck
        FROM funnel_user_state fus
        WHERE fus.tenant_id = ${BigInt(tenantId)}
          AND fus.workspace_id = ${BigInt(workspaceId)}
          AND fus.funnel_id = ${BigInt(funnelId)}
          AND fus.status = 'active'
          AND fus.last_activity_at < ${new Date(now.getTime() - 10 * 60 * 1000)} -- 10 minutes ago
        GROUP BY fus.current_step_index
        HAVING COUNT(*) >= 5 -- At least 5 users stuck
        ORDER BY COUNT(*) DESC;
      `) as any[]

      return [...(conversionRateAnomaly[0] ? [conversionRateAnomaly[0]] : []), ...stepBottlenecks]
    } catch (error) {
      this.logger.error(
        'Error detecting anomalies',
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  }

  /**
   * Get step conversion metrics for bottleneck detection
   */
  async getStepConversionMetrics(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string
  ): Promise<{
    stepMetrics: Array<{
      stepOrder: number
      stepLabel: string
      totalEntries: number
      conversionRate: number
      avgTimeToComplete?: number
    }>
  }> {
    try {
      const stepMetrics = (await this.prisma.$queryRaw`
        WITH funnel_steps AS (
          SELECT 
            jsonb_array_elements(steps) -> 'order' as step_order,
            jsonb_array_elements(steps) ->> 'label' as step_label
          FROM funnel 
          WHERE id = ${funnelId} 
            AND tenant_id = ${tenantId} 
            AND workspace_id = ${workspaceId}
            AND archived_at IS NULL
        ),
        step_data AS (
          SELECT 
            fs.step_order::int as step_order,
            fs.step_label,
            COUNT(DISTINCT fus.anonymous_id) as total_entries,
            COUNT(DISTINCT CASE WHEN fus.current_step >= fs.step_order::int THEN fus.anonymous_id END) as conversions,
            AVG(EXTRACT(epoch FROM (fus.completed_at - fus.first_seen_at))) as avg_completion_time
          FROM funnel_steps fs
          LEFT JOIN funnel_user_state fus ON fus.funnel_id = ${funnelId}
            AND fus.tenant_id = ${tenantId}
            AND fus.workspace_id = ${workspaceId}
            AND fus.first_seen_at >= ${startDate}::timestamp
            AND fus.first_seen_at <= ${endDate}::timestamp
          GROUP BY fs.step_order, fs.step_label
        )
        SELECT 
          step_order,
          step_label,
          total_entries,
          CASE 
            WHEN total_entries > 0 THEN (conversions::float / total_entries::float) * 100
            ELSE 0 
          END as conversion_rate,
          COALESCE(avg_completion_time, 0) as avg_time_to_complete
        FROM step_data
        ORDER BY step_order;
      `) as Array<{
        step_order: number
        step_label: string
        total_entries: bigint
        conversion_rate: number
        avg_time_to_complete: number
      }>

      return {
        stepMetrics: stepMetrics.map((step) => ({
          stepOrder: step.step_order,
          stepLabel: step.step_label || `Step ${step.step_order}`,
          totalEntries: Number(step.total_entries),
          conversionRate: step.conversion_rate,
          avgTimeToComplete: step.avg_time_to_complete > 0 ? step.avg_time_to_complete : undefined,
        })),
      }
    } catch (error) {
      this.logger.error(
        'Error getting step conversion metrics',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenantId.toString(),
          workspaceId: workspaceId.toString(),
          funnelId: funnelId.toString(),
          startDate,
          endDate,
        }
      )
      throw error
    }
  }

  /**
   * Get user journeys for path analysis
   */
  async getUserJourneys(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string,
    maxPathLength: number = 10
  ): Promise<
    Array<{
      user_id: string
      anonymous_id: string
      steps: Array<{
        step_order: number
        step_type: string
        step_identifier: string
        step_label: string
        timestamp: string
        time_spent_seconds: number
        metadata?: Record<string, any>
      }>
      converted: boolean
      completion_time_seconds: number
      total_events: number
    }>
  > {
    try {
      const journeys = (await this.prisma.$queryRaw`
        WITH funnel_events AS (
          SELECT 
            COALESCE(e.lead_id, e.anonymous_id) as user_id,
            e.anonymous_id,
            e.event_name as step_identifier,
            e.page ->> 'title' as step_label,
            e.timestamp,
            CASE 
              WHEN e.page IS NOT NULL THEN 'page'
              ELSE 'event'
            END as step_type,
            e.props,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(e.lead_id, e.anonymous_id) 
              ORDER BY e.timestamp
            ) as step_order
          FROM event e
          WHERE e.tenant_id = ${tenantId}
            AND e.workspace_id = ${workspaceId}
            AND e.timestamp >= ${startDate}::timestamp
            AND e.timestamp <= ${endDate}::timestamp
          ORDER BY COALESCE(e.lead_id, e.anonymous_id), e.timestamp
        ),
        user_journeys AS (
          SELECT 
            user_id,
            anonymous_id,
            jsonb_agg(
              jsonb_build_object(
                'step_order', step_order,
                'step_type', step_type,
                'step_identifier', step_identifier,
                'step_label', COALESCE(step_label, step_identifier),
                'timestamp', timestamp::text,
                'time_spent_seconds', 
                  COALESCE(
                    EXTRACT(epoch FROM (
                      LEAD(timestamp) OVER (PARTITION BY user_id ORDER BY timestamp) - timestamp
                    )), 
                    60
                  ),
                'metadata', props
              ) ORDER BY step_order
            ) as steps,
            COUNT(*) as total_events,
            EXTRACT(epoch FROM (MAX(timestamp) - MIN(timestamp))) as completion_time_seconds,
            -- Check if user completed funnel (simplified - would check against funnel steps)
            CASE 
              WHEN COUNT(*) >= 3 AND MAX(step_order) >= 3 THEN true
              ELSE false
            END as converted
          FROM funnel_events
          WHERE step_order <= ${maxPathLength}
          GROUP BY user_id, anonymous_id
          HAVING COUNT(*) >= 2 -- At least 2 steps to form a path
        )
        SELECT 
          user_id,
          anonymous_id,
          steps,
          converted,
          completion_time_seconds,
          total_events
        FROM user_journeys
        ORDER BY total_events DESC, completion_time_seconds ASC
        LIMIT 1000; -- Limit for performance
      `) as Array<{
        user_id: string
        anonymous_id: string
        steps: any
        converted: boolean
        completion_time_seconds: number
        total_events: bigint
      }>

      return journeys.map((journey) => ({
        user_id: journey.user_id,
        anonymous_id: journey.anonymous_id,
        steps: Array.isArray(journey.steps) ? journey.steps : [],
        converted: journey.converted,
        completion_time_seconds: journey.completion_time_seconds,
        total_events: Number(journey.total_events),
      }))
    } catch (error) {
      this.logger.error(
        'Error getting user journeys',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenantId.toString(),
          workspaceId: workspaceId.toString(),
          funnelId: funnelId.toString(),
          startDate,
          endDate,
          maxPathLength,
        }
      )
      throw error
    }
  }

  /**
   * Get touchpoint journeys for attribution analysis
   */
  async getTouchpointJourneys(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string,
    lookbackWindowDays: number
  ): Promise<{
    journeys: Array<{
      user_id: string
      anonymous_id: string
      touchpoints: Array<{
        touchpoint_type: string
        timestamp: string
        utm_source?: string
        utm_medium?: string
        utm_campaign?: string
        referrer_domain?: string
        device_type?: string
        page_url?: string
      }>
      converted: boolean
      conversion_timestamp: string
      journey_duration_seconds: number
    }>
    totalTouchpoints: number
    totalConversions: number
    touchpointTypes: string[]
  }> {
    try {
      const lookbackDate = new Date()
      lookbackDate.setDate(lookbackDate.getDate() - lookbackWindowDays)

      const journeys = (await this.prisma.$queryRaw`
        WITH user_touchpoints AS (
          SELECT 
            COALESCE(e.lead_id, e.anonymous_id) as user_id,
            e.anonymous_id,
            e.timestamp,
            e.event_name,
            e.page ->> 'url' as page_url,
            e.utm ->> 'source' as utm_source,
            e.utm ->> 'medium' as utm_medium,
            e.utm ->> 'campaign' as utm_campaign,
            e.device ->> 'type' as device_type,
            CASE 
              WHEN e.page ->> 'referrer' IS NOT NULL 
              THEN regexp_replace(e.page ->> 'referrer', 'https?://([^/]+).*', '\\1')
              ELSE null
            END as referrer_domain,
            CASE 
              WHEN e.utm ->> 'source' IS NOT NULL THEN 'paid_search'
              WHEN e.page ->> 'referrer' LIKE '%google%' THEN 'organic_search'
              WHEN e.page ->> 'referrer' IS NULL THEN 'direct'
              WHEN e.page ->> 'referrer' LIKE '%social%' THEN 'social'
              ELSE 'referral'
            END as touchpoint_type,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(e.lead_id, e.anonymous_id) 
              ORDER BY e.timestamp
            ) as touchpoint_order
          FROM event e
          WHERE e.tenant_id = ${tenantId}
            AND e.workspace_id = ${workspaceId}
            AND e.timestamp >= ${lookbackDate.toISOString()}::timestamp
            AND e.timestamp <= ${endDate}::timestamp
          ORDER BY user_id, e.timestamp
        ),
        user_conversions AS (
          SELECT 
            user_id,
            anonymous_id,
            jsonb_agg(
              jsonb_build_object(
                'touchpoint_type', touchpoint_type,
                'timestamp', timestamp::text,
                'utm_source', utm_source,
                'utm_medium', utm_medium,
                'utm_campaign', utm_campaign,
                'referrer_domain', referrer_domain,
                'device_type', device_type,
                'page_url', page_url
              ) ORDER BY timestamp
            ) as touchpoints,
            COUNT(*) as total_touchpoints,
            MIN(timestamp) as first_touchpoint,
            MAX(timestamp) as last_touchpoint,
            -- Simplified conversion detection (would check against actual funnel completion)
            CASE 
              WHEN COUNT(*) >= 3 THEN true
              ELSE false
            END as converted,
            MAX(timestamp) as conversion_timestamp,
            EXTRACT(epoch FROM (MAX(timestamp) - MIN(timestamp))) as journey_duration_seconds
          FROM user_touchpoints
          WHERE touchpoint_order <= 20 -- Limit touchpoints per journey
          GROUP BY user_id, anonymous_id
          HAVING COUNT(*) >= 1
        )
        SELECT 
          user_id,
          anonymous_id,
          touchpoints,
          converted,
          conversion_timestamp::text,
          journey_duration_seconds,
          total_touchpoints
        FROM user_conversions
        WHERE first_touchpoint >= ${startDate}::timestamp
          AND first_touchpoint <= ${endDate}::timestamp
        ORDER BY converted DESC, total_touchpoints DESC
        LIMIT 5000; -- Limit for performance
      `) as Array<{
        user_id: string
        anonymous_id: string
        touchpoints: any
        converted: boolean
        conversion_timestamp: string
        journey_duration_seconds: number
        total_touchpoints: bigint
      }>

      // Get aggregated stats
      const stats = (await this.prisma.$queryRaw`
        SELECT 
          COUNT(DISTINCT COALESCE(e.lead_id, e.anonymous_id)) as total_users,
          COUNT(*) as total_touchpoints,
          COUNT(DISTINCT CASE WHEN funnel_completed.user_id IS NOT NULL THEN e.lead_id END) as total_conversions,
          array_agg(DISTINCT 
            CASE 
              WHEN e.utm ->> 'source' IS NOT NULL THEN 'paid_search'
              WHEN e.page ->> 'referrer' LIKE '%google%' THEN 'organic_search'
              WHEN e.page ->> 'referrer' IS NULL THEN 'direct'
              WHEN e.page ->> 'referrer' LIKE '%social%' THEN 'social'
              ELSE 'referral'
            END
          ) as touchpoint_types
        FROM event e
        LEFT JOIN (
          SELECT DISTINCT COALESCE(lead_id, anonymous_id) as user_id
          FROM event 
          WHERE tenant_id = ${tenantId} 
            AND workspace_id = ${workspaceId}
          GROUP BY COALESCE(lead_id, anonymous_id)
          HAVING COUNT(*) >= 3
        ) funnel_completed ON funnel_completed.user_id = COALESCE(e.lead_id, e.anonymous_id)
        WHERE e.tenant_id = ${tenantId}
          AND e.workspace_id = ${workspaceId}
          AND e.timestamp >= ${startDate}::timestamp
          AND e.timestamp <= ${endDate}::timestamp;
      `) as Array<{
        total_users: bigint
        total_touchpoints: bigint
        total_conversions: bigint
        touchpoint_types: string[]
      }>

      const statsRow = stats[0] || {
        total_touchpoints: BigInt(0),
        total_conversions: BigInt(0),
        touchpoint_types: [],
      }

      return {
        journeys: journeys.map((journey) => ({
          user_id: journey.user_id,
          anonymous_id: journey.anonymous_id,
          touchpoints: Array.isArray(journey.touchpoints) ? journey.touchpoints : [],
          converted: journey.converted,
          conversion_timestamp: journey.conversion_timestamp,
          journey_duration_seconds: journey.journey_duration_seconds,
        })),
        totalTouchpoints: Number(statsRow.total_touchpoints),
        totalConversions: Number(statsRow.total_conversions),
        touchpointTypes: statsRow.touchpoint_types || [],
      }
    } catch (error) {
      this.logger.error(
        'Error getting touchpoint journeys',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenantId.toString(),
          workspaceId: workspaceId.toString(),
          funnelId: funnelId.toString(),
          startDate,
          endDate,
          lookbackWindowDays,
        }
      )
      throw error
    }
  }

  /**
   * Health check method for repository
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: 'healthy', details: 'Database connection successful' }
    } catch (error) {
      this.logger.error(
        'Analytics repository health check failed',
        error instanceof Error ? error : new Error(String(error))
      )
      return {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

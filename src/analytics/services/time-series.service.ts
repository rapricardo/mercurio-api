import { Injectable, Logger } from '@nestjs/common'
import { AnalyticsRepository } from '../repositories/analytics.repository'
import { PeriodUtils } from '../utils/period.utils'
import { TimezoneUtils } from '../utils/timezone.utils'
import { TimeSeriesResponse, TimeSeriesDataPoint } from '../dto/response.dto'
import { TimeSeriesQueryDto } from '../dto/query.dto'

@Injectable()
export class TimeSeriesService {
  private readonly logger = new Logger(TimeSeriesService.name)

  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  /**
   * Generate time series data with proper granularity
   */
  async generateTimeSeries(
    tenantId: bigint,
    workspaceId: bigint,
    query: TimeSeriesQueryDto
  ): Promise<TimeSeriesResponse> {
    const { start: startDate, end: endDate } = PeriodUtils.calculatePeriod(
      query.period,
      query.startDate,
      query.endDate,
      query.timezone
    )

    // Validate granularity for the period
    this.validateGranularity(startDate, endDate, query.granularity)

    // Get time series data from repository
    const rawData = await this.analyticsRepository.getTimeSeriesData(
      tenantId,
      workspaceId,
      startDate,
      endDate,
      query.granularity,
      query.metrics
    )

    // Process and format the data points
    const dataPoints = this.processTimeSeriesData(rawData, query.metrics, query.timezone || 'UTC')

    // Fill in any gaps in the time series
    const completeDataPoints = this.fillTimeSeriesGaps(
      dataPoints,
      startDate,
      endDate,
      query.granularity,
      query.metrics,
      query.timezone || 'UTC'
    )

    return {
      period: PeriodUtils.createPeriodInfo(
        query.period,
        startDate,
        endDate,
        query.timezone,
        query.granularity
      ),
      data: completeDataPoints,
    }
  }

  /**
   * Validate that granularity is appropriate for the time period
   */
  private validateGranularity(
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week'
  ): void {
    const durationMs = endDate.getTime() - startDate.getTime()
    const durationHours = durationMs / (60 * 60 * 1000)
    const durationDays = durationHours / 24

    switch (granularity) {
      case 'hour':
        if (durationDays > 31) {
          throw new Error('Hourly granularity not supported for periods longer than 31 days')
        }
        break
      case 'day':
        if (durationDays > 365) {
          throw new Error('Daily granularity not supported for periods longer than 1 year')
        }
        break
      case 'week':
        // Weekly granularity is always acceptable
        break
    }

    // Warn if granularity might be too fine-grained
    if (granularity === 'hour' && durationDays > 7) {
      this.logger.warn('Hourly granularity for long periods may result in many data points', {
        durationDays,
      })
    }
  }

  /**
   * Process raw time series data into formatted data points
   */
  private processTimeSeriesData(
    rawData: any[],
    requestedMetrics: string[],
    timezone: string
  ): TimeSeriesDataPoint[] {
    return rawData.map((row) => {
      const dataPoint: TimeSeriesDataPoint = {
        timestamp: new Date(row.period).toISOString(),
      }

      // Add requested metrics to the data point
      requestedMetrics.forEach((metric) => {
        switch (metric) {
          case 'events':
            dataPoint.events = row.total_events || 0
            break
          case 'visitors':
            dataPoint.visitors = row.unique_visitors || 0
            break
          case 'sessions':
            dataPoint.sessions = row.total_sessions || 0
            break
          case 'conversions':
            dataPoint.conversions = row.conversions || 0
            break
        }
      })

      return dataPoint
    })
  }

  /**
   * Fill gaps in time series data to ensure complete data points
   */
  private fillTimeSeriesGaps(
    dataPoints: TimeSeriesDataPoint[],
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week',
    metrics: string[],
    timezone: string
  ): TimeSeriesDataPoint[] {
    const filledData: TimeSeriesDataPoint[] = []
    const existingDataMap = new Map<string, TimeSeriesDataPoint>()

    // Create a map of existing data points by timestamp
    dataPoints.forEach((point) => {
      existingDataMap.set(point.timestamp, point)
    })

    // Generate complete time series
    const current = new Date(startDate)
    while (current <= endDate) {
      const truncatedDate = TimezoneUtils.getTruncatedDate(current, granularity, timezone)
      const timestamp = truncatedDate.toISOString()

      const existingPoint = existingDataMap.get(timestamp)
      if (existingPoint) {
        filledData.push(existingPoint)
      } else {
        // Create empty data point for missing time slot
        const emptyPoint: TimeSeriesDataPoint = { timestamp }

        metrics.forEach((metric) => {
          switch (metric) {
            case 'events':
              emptyPoint.events = 0
              break
            case 'visitors':
              emptyPoint.visitors = 0
              break
            case 'sessions':
              emptyPoint.sessions = 0
              break
            case 'conversions':
              emptyPoint.conversions = 0
              break
          }
        })

        filledData.push(emptyPoint)
      }

      // Advance to next time slot
      this.advanceDate(current, granularity)
    }

    return filledData.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }

  /**
   * Advance date by the specified granularity
   */
  private advanceDate(date: Date, granularity: 'hour' | 'day' | 'week'): void {
    switch (granularity) {
      case 'hour':
        date.setHours(date.getHours() + 1)
        break
      case 'day':
        date.setDate(date.getDate() + 1)
        break
      case 'week':
        date.setDate(date.getDate() + 7)
        break
    }
  }

  /**
   * Calculate optimal data point count for given period and granularity
   */
  getOptimalDataPointCount(
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week'
  ): number {
    const durationMs = endDate.getTime() - startDate.getTime()

    switch (granularity) {
      case 'hour':
        return Math.ceil(durationMs / (60 * 60 * 1000))
      case 'day':
        return Math.ceil(durationMs / (24 * 60 * 60 * 1000))
      case 'week':
        return Math.ceil(durationMs / (7 * 24 * 60 * 60 * 1000))
      default:
        return 0
    }
  }

  /**
   * Suggest optimal granularity based on period duration
   */
  suggestOptimalGranularity(startDate: Date, endDate: Date): 'hour' | 'day' | 'week' {
    return PeriodUtils.getOptimalGranularity(startDate, endDate)
  }

  /**
   * Validate metrics selection
   */
  validateMetrics(metrics: string[]): void {
    const validMetrics = ['events', 'visitors', 'sessions', 'conversions']
    const invalidMetrics = metrics.filter((m) => !validMetrics.includes(m))

    if (invalidMetrics.length > 0) {
      throw new Error(`Invalid metrics: ${invalidMetrics.join(', ')}`)
    }

    if (metrics.length === 0) {
      throw new Error('At least one metric must be specified')
    }

    if (metrics.length > 4) {
      throw new Error('Maximum 4 metrics can be requested at once')
    }
  }
}

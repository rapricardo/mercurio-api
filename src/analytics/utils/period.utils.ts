import { PeriodType } from '../types/analytics.types'
import { PeriodInfo } from '../dto/response.dto'

export class PeriodUtils {
  static calculatePeriod(
    period: PeriodType,
    startDate?: Date,
    endDate?: Date,
    timezone: string = 'UTC'
  ): { start: Date; end: Date } {
    if (period === 'custom') {
      if (!startDate || !endDate) {
        throw new Error('Start and end dates are required for custom period')
      }
      return { start: startDate, end: endDate }
    }

    const now = new Date()
    let start: Date

    switch (period) {
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        throw new Error(`Invalid period: ${period}`)
    }

    return { start, end: now }
  }

  static calculatePreviousPeriod(
    period: PeriodType,
    startDate: Date,
    endDate: Date
  ): { start: Date; end: Date } {
    const duration = endDate.getTime() - startDate.getTime()
    const previousEnd = new Date(startDate.getTime() - 1)
    const previousStart = new Date(previousEnd.getTime() - duration)

    return {
      start: previousStart,
      end: previousEnd,
    }
  }

  static createPeriodInfo(
    period: PeriodType,
    start: Date,
    end: Date,
    timezone: string = 'UTC',
    granularity?: string
  ): PeriodInfo {
    return {
      type: period,
      start: start.toISOString(),
      end: end.toISOString(),
      timezone,
      granularity: granularity as any,
    }
  }

  static validateDateRange(startDate: Date, endDate: Date): void {
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000 // 1 year
    const rangeMs = endDate.getTime() - startDate.getTime()

    if (rangeMs > maxRangeMs) {
      throw new Error(
        `Date range cannot exceed 1 year. Requested: ${Math.ceil(
          rangeMs / (24 * 60 * 60 * 1000)
        )} days`
      )
    }

    if (startDate >= endDate) {
      throw new Error('Start date must be before end date')
    }

    // Don't allow future dates beyond current time
    const now = new Date()
    if (endDate > now) {
      throw new Error('End date cannot be in the future')
    }
  }

  static getOptimalGranularity(startDate: Date, endDate: Date): 'hour' | 'day' | 'week' {
    const durationMs = endDate.getTime() - startDate.getTime()
    const durationHours = durationMs / (60 * 60 * 1000)

    if (durationHours <= 48) {
      return 'hour' // <= 2 days, show hourly
    } else if (durationHours <= 24 * 30) {
      return 'day' // <= 30 days, show daily
    } else {
      return 'week' // > 30 days, show weekly
    }
  }
}

import {
  PeriodType,
  GranularityType,
  ActivityLevelType,
  ExportFormatType,
  ExportStatusType,
} from '../types/analytics.types'

export interface PeriodInfo {
  type: PeriodType
  start: string // ISO8601
  end: string // ISO8601
  timezone: string
  granularity?: GranularityType
}

export interface MetricComparison {
  value: number
  change_pct: number
  previous: number
  direction?: 'up' | 'down' | 'stable'
}

export interface OverviewMetricsResponse {
  period: PeriodInfo
  metrics: {
    total_events: number
    unique_visitors: number
    total_sessions: number
    conversion_rate: number
    bounce_rate: number
    avg_session_duration: number
    top_event: string
  }
  comparisons: {
    total_events: MetricComparison
    unique_visitors: MetricComparison
    total_sessions: MetricComparison
  }
}

export interface TimeSeriesDataPoint {
  timestamp: string // ISO8601
  events?: number
  visitors?: number
  sessions?: number
  conversions?: number
}

export interface TimeSeriesResponse {
  period: PeriodInfo
  data: TimeSeriesDataPoint[]
}

export interface EventTrendData {
  change_pct: number
  direction: 'up' | 'down' | 'stable'
}

export interface TopEventItem {
  rank: number
  event_name: string
  count: number
  percentage: number
  unique_visitors: number
  avg_per_visitor: number
  trend: EventTrendData
}

export interface TopEventsResponse {
  period: PeriodInfo
  total_events: number
  events: TopEventItem[]
}

export interface ActivityLevel {
  level: ActivityLevelType
  description: string
  visitors: number
  percentage: number
  avg_events_per_session: number
}

export interface ConversionStage {
  stage: string
  count: number
  percentage: number
}

export interface ConversionFunnel {
  visitors: number
  sessions_created: number
  events_generated: number
  leads_identified: number
  conversion_stages: ConversionStage[]
}

export interface UserAnalyticsResponse {
  period: PeriodInfo
  summary: {
    total_visitors: number
    identified_leads: number
    identification_rate: number
    returning_visitors: number
    new_visitors: number
  }
  activity_levels: ActivityLevel[]
  conversion_funnel: ConversionFunnel
}

export interface EventDetailItem {
  event_id: string
  event_name: string
  timestamp: string
  anonymous_id: string
  lead_id?: string
  session_id?: string
  page?: Record<string, any>
  utm?: Record<string, any>
  device?: Record<string, any>
  geo?: Record<string, any>
  props?: Record<string, any>
}

export interface PaginationInfo {
  page: number
  limit: number
  total_count: number
  total_pages: number
  has_next_page: boolean
  has_previous_page: boolean
}

export interface EventDetailsResponse {
  period: PeriodInfo
  pagination: PaginationInfo
  filters: Record<string, any>
  events: EventDetailItem[]
}

export interface ExportResponse {
  export_id: string
  status: ExportStatusType
  created_at: string
  download_url?: string
  expires_at?: string
  format: ExportFormatType
  estimated_size?: string
  record_count?: number
}

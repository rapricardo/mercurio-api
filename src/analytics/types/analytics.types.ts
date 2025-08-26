export type PeriodType = '24h' | '7d' | '30d' | 'custom';
export type GranularityType = 'hour' | 'day' | 'week';
export type MetricType = 'events' | 'visitors' | 'sessions' | 'conversions';
export type SortOrderType = 'asc' | 'desc';
export type ActivityLevelType = 'high_activity' | 'medium_activity' | 'low_activity';
export type ExportDatasetType = 'events' | 'overview' | 'timeseries' | 'users';
export type ExportFormatType = 'json' | 'csv';
export type ExportStatusType = 'processing' | 'completed' | 'failed';

export interface EventAggregation {
  period: Date;
  total_events: number;
  unique_visitors: number;
  total_sessions: number;
  conversions: number;
}

export interface TopEventData {
  rank: number;
  event_name: string;
  count: number;
  unique_visitors: number;
  avg_per_visitor: number;
  percentage: number;
}

export interface UserActivityData {
  activity_level: ActivityLevelType;
  visitors: number;
  percentage: number;
  avg_events_per_session: number;
}
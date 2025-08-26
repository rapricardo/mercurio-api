/**
 * Request DTOs for Funnel Analytics Phase 2 endpoints
 * Comprehensive analytics queries with flexible parameters
 */

export interface ConversionAnalysisRequest {
  /** Analysis date range */
  start_date: string; // ISO date string (YYYY-MM-DD)
  end_date: string;   // ISO date string (YYYY-MM-DD)
  
  /** Timezone for date interpretation */
  timezone?: string; // Default: 'UTC'
  
  /** Include segment analysis (device, traffic source, etc.) */
  include_segments?: boolean; // Default: false
  
  /** Include time-series data */
  include_timeseries?: boolean; // Default: false
  
  /** Time-series granularity when include_timeseries=true */
  timeseries_granularity?: 'hourly' | 'daily' | 'weekly'; // Default: 'daily'
  
  /** Specific segments to analyze */
  segment_filters?: {
    device_types?: string[]; // ['desktop', 'mobile', 'tablet']
    utm_sources?: string[];  // ['google', 'facebook', 'email']
    countries?: string[];    // ['US', 'BR', 'UK']
    user_types?: string[];   // ['new', 'returning']
  };
  
  /** Statistical comparison options */
  compare_to_previous_period?: boolean; // Default: true
  statistical_confidence_level?: 90 | 95 | 99; // Default: 95
}

export interface DropoffAnalysisRequest {
  /** Analysis date range */
  start_date: string;
  end_date: string;
  timezone?: string;
  
  /** Bottleneck detection sensitivity */
  bottleneck_threshold?: number; // % drop-off to consider bottleneck (default: 50)
  
  /** Include exit path analysis */
  include_exit_paths?: boolean; // Default: true
  
  /** Include optimization recommendations */
  include_recommendations?: boolean; // Default: true
  
  /** Segment filters for targeted analysis */
  segment_filters?: {
    device_types?: string[];
    utm_sources?: string[];
    countries?: string[];
  };
  
  /** Minimum sample size for statistical significance */
  min_sample_size?: number; // Default: 100
}

export interface CohortAnalysisRequest {
  /** Analysis date range */
  start_date: string;
  end_date: string;
  timezone?: string;
  
  /** Cohort period grouping */
  cohort_period: 'daily' | 'weekly' | 'monthly';
  
  /** Include retention curve analysis */
  include_retention_curves?: boolean; // Default: true
  
  /** Include cross-cohort comparisons */
  include_comparisons?: boolean; // Default: true
  
  /** Segment-based cohort analysis */
  segment_cohorts?: {
    by_device?: boolean;
    by_traffic_source?: boolean;
    by_geography?: boolean;
  };
  
  /** Statistical analysis options */
  statistical_tests?: boolean; // Default: true
  confidence_level?: 90 | 95 | 99; // Default: 95
}

export interface TimingAnalysisRequest {
  /** Analysis date range */
  start_date: string;
  end_date: string;
  timezone?: string;
  
  /** Include step-by-step timing breakdown */
  include_step_timing?: boolean; // Default: true
  
  /** Include velocity trend analysis */
  include_velocity_trends?: boolean; // Default: true
  
  /** Include segment timing comparisons */
  include_segment_timing?: boolean; // Default: false
  
  /** Percentiles to calculate for timing distributions */
  percentiles?: number[]; // Default: [25, 50, 75, 90, 95, 99]
  
  /** Segment filters for timing analysis */
  segment_filters?: {
    device_types?: string[];
    utm_sources?: string[];
    countries?: string[];
  };
  
  /** Time unit for timing calculations */
  time_unit?: 'seconds' | 'minutes' | 'hours' | 'days'; // Default: 'minutes'
}

/**
 * Common filter interface for all analytics requests
 */
export interface AnalyticsFilters {
  /** Date range */
  start_date: string;
  end_date: string;
  timezone?: string;
  
  /** Funnel-specific filters */
  funnel_version?: string; // Analyze specific funnel version
  exclude_test_traffic?: boolean; // Filter out test/bot traffic
  
  /** User segmentation */
  user_segments?: {
    new_vs_returning?: 'new' | 'returning' | 'both';
    device_categories?: string[];
    geographic_regions?: string[];
    traffic_sources?: string[];
  };
  
  /** Event property filters */
  event_property_filters?: Array<{
    property_name: string;
    operator: 'equals' | 'contains' | 'starts_with' | 'in' | 'greater_than' | 'less_than';
    value: string | number | string[] | number[];
  }>;
  
  /** Performance optimization */
  max_results?: number; // Limit results for performance
  cache_duration_override?: number; // Override default cache TTL in seconds
}

/**
 * Request validation interfaces
 */
export interface DateRangeValidation {
  start_date: string;
  end_date: string;
  max_range_days?: number; // Maximum allowed date range
  timezone?: string;
}

export interface AnalyticsRequestValidation {
  /** Validate date range */
  validateDateRange(request: DateRangeValidation): {
    isValid: boolean;
    errors?: string[];
  };
  
  /** Validate segment filters */
  validateSegmentFilters(filters?: any): {
    isValid: boolean;
    errors?: string[];
  };
  
  /** Validate performance parameters */
  validatePerformanceParams(request: any): {
    isValid: boolean;
    errors?: string[];
  };
}

/**
 * Advanced analytics request options
 */
export interface AdvancedAnalyticsOptions {
  /** Machine learning insights */
  ml_insights?: {
    predict_future_performance?: boolean;
    anomaly_detection?: boolean;
    pattern_recognition?: boolean;
  };
  
  /** Statistical analysis depth */
  statistical_depth?: 'basic' | 'advanced' | 'comprehensive';
  
  /** Export options */
  export_format?: 'json' | 'csv' | 'excel';
  include_raw_data?: boolean;
  
  /** Performance tuning */
  use_approximations?: boolean; // Use approximate calculations for speed
  sampling_rate?: number; // Sample percentage for large datasets (0.1 to 1.0)
}

/**
 * Time-to-Conversion analytics request (Task 2.4)
 */
export interface TimingAnalysisRequest {
  /** Date range for analysis */
  start_date: string;
  end_date: string;
  
  /** Time granularity for trends */
  granularity?: 'daily' | 'weekly';
  
  /** Include segment timing comparison */
  includeSegments?: boolean;
  
  /** Timezone for date calculations */
  timezone?: string;
  
  /** Performance optimization flags */
  use_approximations?: boolean;
  sampling_rate?: number;
}

/**
 * Real-time analytics request (for Phase 3)
 */
export interface RealTimeAnalyticsRequest {
  /** Time window for real-time data */
  time_window_minutes?: number; // Default: 60
  
  /** Refresh interval */
  refresh_interval_seconds?: number; // Default: 30
  
  /** Alert thresholds */
  alert_thresholds?: {
    conversion_rate_drop?: number; // % drop to trigger alert
    traffic_spike?: number; // % increase to trigger alert
    error_rate_increase?: number; // % increase in errors
  };
  
  /** Live metrics to include */
  live_metrics?: {
    active_sessions?: boolean;
    current_conversions?: boolean;
    real_time_bottlenecks?: boolean;
  };
}

/**
 * Multi-funnel comparison request (for Phase 4)
 */
export interface FunnelComparisonRequest {
  /** Funnels to compare */
  funnel_ids: string[];
  
  /** Comparison metrics */
  metrics: Array<'conversion_rate' | 'drop_off_rate' | 'time_to_convert' | 'volume'>;
  
  /** Statistical comparison options */
  statistical_tests?: boolean;
  confidence_level?: 90 | 95 | 99;
  
  /** Normalization options */
  normalize_by?: 'volume' | 'time_period' | 'none';
}
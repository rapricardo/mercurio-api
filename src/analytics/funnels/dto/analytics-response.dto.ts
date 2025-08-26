/**
 * Response DTOs for Funnel Analytics Phase 2 endpoints
 * Comprehensive analytics data structures with performance metadata
 */

/**
 * Conversion Analysis Response - Task 2.1
 */
export interface ConversionAnalysisResponse {
  /** Basic funnel information */
  funnel_id: string;
  funnel_name: string;
  
  /** Analysis period and metadata */
  analysis_period: {
    start_date: string;
    end_date: string;
    timezone: string;
    total_days: number;
  };
  
  /** Overall conversion metrics */
  overall_metrics: OverallConversionMetrics;
  
  /** Step-by-step conversion breakdown */
  step_metrics: StepConversionMetrics[];
  
  /** Segment analysis (when requested) */
  segment_analysis?: SegmentConversionMetrics[];
  
  /** Time-series data (when requested) */
  time_series?: ConversionTimeSeriesPoint[];
  
  /** Statistical significance testing */
  statistical_significance?: StatisticalSignificanceResult;
  
  /** Performance benchmarks */
  performance_benchmarks: {
    industry_average: number;
    peer_comparison: {
      percentile: number; // Where this funnel ranks among peers
      peer_average: number;
    };
  };
  
  /** Response metadata */
  generated_at: string;
  cache_duration_seconds: number;
  query_performance: {
    execution_time_ms: number;
    cache_hit: boolean;
    data_freshness_minutes: number;
  };
}

export interface OverallConversionMetrics {
  /** Core conversion numbers */
  total_entries: number;
  total_conversions: number;
  conversion_rate: number; // Percentage
  total_drop_offs: number;
  
  /** Advanced timing metrics */
  average_time_to_convert: number; // Minutes
  median_time_to_convert: number; // Minutes
  conversion_velocity: number; // Conversions per hour
  
  /** Quality metrics */
  bounce_rate_at_entry: number; // Percentage who leave immediately
  engagement_score: number; // 0-100 engagement rating
  
  /** Comparison metrics */
  period_over_period_change?: {
    conversion_rate_change: number; // Percentage points
    volume_change: number; // Percentage
    improvement_direction: 'up' | 'down' | 'stable';
  };
}

export interface StepConversionMetrics {
  /** Step identification */
  step_order: number;
  step_name: string;
  step_type: 'start' | 'page' | 'event' | 'decision' | 'conversion';
  
  /** Step performance */
  total_users: number;
  conversion_rate_from_previous: number; // Percentage
  conversion_rate_from_start: number; // Percentage
  drop_off_rate: number; // Percentage
  drop_off_count: number;
  
  /** Step analysis */
  is_bottleneck: boolean; // True if major drop-off point
  bottleneck_severity?: 'low' | 'medium' | 'high' | 'critical';
  
  /** Timing analysis */
  average_time_to_complete: number; // Minutes from previous step
  median_time_to_complete: number; // Minutes from previous step
  time_percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  
  /** Common exit paths from this step */
  common_exit_paths?: Array<{
    exit_type: 'bounce' | 'navigation' | 'conversion' | 'abandonment';
    exit_destination?: string; // Page or event they went to
    percentage: number;
  }>;
}

export interface SegmentConversionMetrics {
  /** Segment definition */
  segment_type: 'device' | 'traffic_source' | 'geography' | 'user_type' | 'custom';
  segment_value: string; // 'mobile', 'google', 'US', 'new_user', etc.
  
  /** Segment performance */
  total_entries: number;
  total_conversions: number;
  conversion_rate: number; // Percentage
  
  /** Comparative analysis */
  performance_vs_average: number; // Percentage difference from overall average
  statistical_significance: boolean; // If difference is statistically significant
  confidence_interval: {
    lower_bound: number;
    upper_bound: number;
    confidence_level: number; // 90, 95, or 99
  };
  
  /** Segment insights */
  insights: Array<{
    type: 'outperforming' | 'underperforming' | 'stable' | 'volatile';
    description: string;
    impact_score: number; // 0-100 how important this insight is
  }>;
}

export interface ConversionTimeSeriesPoint {
  /** Time period */
  date: string; // ISO date string
  period_type: 'hour' | 'day' | 'week';
  
  /** Metrics for this period */
  entries: number;
  conversions: number;
  conversion_rate: number;
  
  /** Trend indicators */
  trend_direction: 'up' | 'down' | 'stable';
  moving_average: number; // 7-day moving average
  seasonal_adjustment?: number; // Seasonally adjusted rate
}

export interface StatisticalSignificanceResult {
  /** Comparison period */
  comparison_period: {
    start: string;
    end: string;
  };
  
  /** Statistical measures */
  current_conversion_rate: number;
  previous_conversion_rate: number;
  improvement: number; // Percentage change
  
  /** Test results */
  z_score: number;
  p_value: number;
  is_significant: boolean;
  confidence_level: number;
  
  /** Effect size */
  effect_size: 'small' | 'medium' | 'large';
  practical_significance: boolean; // If change is practically meaningful
}

/**
 * Drop-off Analysis Response - Task 2.2
 */
export interface DropoffAnalysisResponse {
  /** Basic funnel information */
  funnel_id: string;
  funnel_name: string;
  analysis_period: {
    start_date: string;
    end_date: string;
    timezone: string;
  };
  
  /** Step-by-step drop-off analysis */
  step_dropoffs: StepDropoffMetrics[];
  
  /** Critical bottleneck identification */
  critical_bottlenecks: BottleneckAnalysis[];
  
  /** Exit path analysis */
  exit_paths: ExitPathAnalysis[];
  
  /** Optimization recommendations */
  recommendations: OptimizationRecommendation[];
  
  /** Performance summary */
  summary: {
    total_drop_offs: number;
    biggest_bottleneck_step: number;
    optimization_potential: number; // 0-100 score
  };
  
  /** Response metadata */
  generated_at: string;
  cache_duration_seconds: number;
}

export interface StepDropoffMetrics {
  step_order: number;
  step_name: string;
  entries: number;
  exits: number;
  drop_off_rate: number;
  drop_off_severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Exit timing analysis */
  average_time_before_exit: number; // Seconds
  exit_velocity: 'immediate' | 'quick' | 'delayed' | 'hesitant';
  
  /** Exit triggers */
  common_exit_triggers: Array<{
    trigger_type: 'error' | 'confusion' | 'distraction' | 'friction';
    description: string;
    frequency: number;
  }>;
}

export interface BottleneckAnalysis {
  step_order: number;
  step_name: string;
  severity_score: number; // 0-100
  impact_on_overall_conversion: number; // Percentage points
  
  /** Root cause analysis */
  likely_causes: Array<{
    cause_type: 'technical' | 'ux' | 'content' | 'timing' | 'external';
    description: string;
    confidence: number; // 0-100
  }>;
  
  /** Improvement potential */
  optimization_potential: {
    conservative_estimate: number; // % conversion rate improvement
    optimistic_estimate: number;
    effort_required: 'low' | 'medium' | 'high';
  };
}

export interface ExitPathAnalysis {
  /** Exit point */
  from_step: number;
  from_step_name: string;
  
  /** Where users went */
  exit_destinations: Array<{
    destination_type: 'page' | 'external' | 'bounce' | 'other_funnel';
    destination: string;
    user_count: number;
    percentage: number;
  }>;
  
  /** Exit patterns */
  exit_patterns: Array<{
    pattern_type: 'immediate_bounce' | 'multi_step_exploration' | 'return_later' | 'convert_elsewhere';
    description: string;
    frequency: number;
  }>;
}

export interface OptimizationRecommendation {
  /** Recommendation details */
  type: 'technical' | 'ux' | 'content' | 'flow' | 'timing';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  
  /** Impact estimation */
  estimated_impact: {
    conversion_rate_lift: number; // Percentage points
    affected_users_per_month: number;
    confidence: number; // 0-100
  };
  
  /** Implementation */
  implementation: {
    effort_level: 'low' | 'medium' | 'high';
    estimated_dev_days: number;
    technical_requirements: string[];
  };
  
  /** A/B test suggestion */
  ab_test_suggestion?: {
    test_duration_days: number;
    minimum_sample_size: number;
    success_metrics: string[];
  };
}

/**
 * Cohort Analysis Response - Task 2.3
 */
export interface CohortAnalysisResponse {
  /** Basic information */
  funnel_id: string;
  funnel_name: string;
  analysis_period: {
    start_date: string;
    end_date: string;
    timezone: string;
  };
  
  /** Cohort configuration */
  cohort_period: 'daily' | 'weekly' | 'monthly';
  
  /** Individual cohorts */
  cohorts: CohortMetrics[];
  
  /** Cross-cohort analysis */
  cohort_comparison: CohortComparison[];
  
  /** Segment-based cohorts (when requested) */
  segment_cohorts?: SegmentCohortMetrics[];
  
  /** Insights and trends */
  insights: CohortInsight[];
  
  /** Response metadata */
  generated_at: string;
  cache_duration_seconds: number;
}

export interface CohortMetrics {
  cohort_id: string;
  cohort_period: string; // ISO date
  cohort_size: number; // Initial users
  
  /** Step-by-step retention */
  step_retention: Array<{
    step_order: number;
    users_reached: number;
    retention_rate: number; // From cohort start
    step_conversion_rate: number; // From previous step
  }>;
  
  /** Overall cohort performance */
  final_conversion_rate: number;
  average_time_to_convert: number; // Days
  
  /** Cohort characteristics */
  cohort_segments: {
    device_breakdown: Record<string, number>;
    traffic_source_breakdown: Record<string, number>;
    geographic_breakdown: Record<string, number>;
  };
}

export interface CohortComparison {
  metric: 'conversion_rate' | 'retention_rate' | 'time_to_convert';
  
  /** Statistical comparison */
  best_performing_cohort: {
    cohort_id: string;
    value: number;
  };
  worst_performing_cohort: {
    cohort_id: string;
    value: number;
  };
  
  /** Trend analysis */
  trend_direction: 'improving' | 'declining' | 'stable' | 'volatile';
  trend_strength: number; // 0-1 correlation coefficient
  
  /** Statistical significance */
  variance_significance: boolean;
  f_test_p_value: number;
}

export interface SegmentCohortMetrics {
  segment_type: string;
  segment_value: string;
  cohorts: CohortMetrics[];
  segment_insights: string[];
}

export interface CohortInsight {
  type: 'trend' | 'anomaly' | 'seasonal' | 'segment' | 'optimization';
  title: string;
  description: string;
  impact_score: number; // 0-100
  actionable: boolean;
  recommended_actions?: string[];
}


export interface TimingMetrics {
  /** Distribution metrics */
  mean: number;
  median: number;
  mode: number;
  standard_deviation: number;
  
  /** Percentile breakdown */
  percentiles: Record<number, number>; // P25, P50, P75, P90, P95, P99
  
  /** Timing categorization */
  timing_categories: {
    immediate: { count: number; percentage: number }; // < 1 minute
    quick: { count: number; percentage: number };     // 1-15 minutes
    deliberate: { count: number; percentage: number }; // 15 minutes - 1 hour
    extended: { count: number; percentage: number };   // 1+ hours
  };
  
  /** Velocity metrics */
  conversion_velocity: number; // Conversions per hour
  optimal_velocity_range: {
    min: number;
    max: number;
    explanation: string;
  };
}

export interface StepTimingMetrics {
  step_order: number;
  step_name: string;
  
  /** Step timing distribution */
  timing_distribution: TimingMetrics;
  
  /** Step completion patterns */
  completion_patterns: {
    immediate_completion: number; // Percentage
    hesitation_indicators: number; // Percentage showing hesitation
    abandonment_after_delay: number; // Percentage who delay then abandon
  };
  
  /** Timing bottlenecks */
  is_timing_bottleneck: boolean;
  optimal_completion_time_range: {
    min: number;
    max: number;
    unit: string;
  };
}

export interface VelocityTrendPoint {
  date: string;
  period_type: 'hour' | 'day' | 'week';
  average_velocity: number;
  velocity_trend: 'accelerating' | 'decelerating' | 'stable';
  
  /** Factors affecting velocity */
  velocity_factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    strength: number; // 0-1
  }>;
}

export interface SegmentTimingMetrics {
  segment_type: string;
  segment_value: string;
  timing_metrics: TimingMetrics;
  
  /** Comparative analysis */
  performance_vs_average: {
    faster_by: number; // Minutes or percentage
    significance: 'not_significant' | 'significant' | 'highly_significant';
  };
}

export interface TimingInsight {
  type: 'optimization' | 'bottleneck' | 'trend' | 'segment' | 'seasonal';
  title: string;
  description: string;
  impact_on_conversions: number; // Percentage points
  
  /** Actionable recommendations */
  recommendations: Array<{
    action: string;
    expected_improvement: string;
    implementation_effort: 'low' | 'medium' | 'high';
  }>;
}

/**
 * Common interfaces for all analytics responses
 */
export interface AnalyticsResponseMetadata {
  generated_at: string;
  cache_duration_seconds: number;
  query_performance: {
    execution_time_ms: number;
    cache_hit: boolean;
    data_freshness_minutes: number;
    query_complexity: 'simple' | 'medium' | 'complex';
  };
  data_quality: {
    completeness_score: number; // 0-100
    accuracy_indicators: string[];
    known_limitations: string[];
  };
}

/**
 * Time-to-Conversion analysis response (Task 2.4)
 */
export interface TimingAnalysisResponse {
  overall_timing: {
    percentiles: Record<string, number>;
    distribution: Array<{
      time_bucket: string;
      time_range: string;
      user_count: number;
      percentage: number;
    }>;
    statistics: {
      mean_seconds: number;
      median_seconds: number;
      stddev_seconds: number;
      min_seconds: number;
      max_seconds: number;
    };
  };
  step_timing: Array<{
    step_order: number;
    step_label: string;
    avg_time_to_next_seconds: number;
    median_time_to_next_seconds: number;
    p90_time_to_next_seconds: number;
    user_count: number;
    abandonment_rate: number;
  }>;
  conversion_velocity_trends: Array<{
    period: string;
    date: string;
    avg_conversion_time_seconds: number;
    median_conversion_time_seconds: number;
    conversion_count: number;
    velocity_score: number;
    trend_indicator: 'improving' | 'stable' | 'declining';
  }>;
  segment_timing: Array<{
    segment_name: string;
    segment_value: string;
    avg_conversion_time_seconds: number;
    median_conversion_time_seconds: number;
    p90_conversion_time_seconds: number;
    conversion_count: number;
    velocity_score: number;
    performance_indicator: 'fast' | 'average' | 'slow';
  }>;
  insights: Array<{
    type: 'timing_insight';
    category: 'bottleneck' | 'optimization' | 'trend';
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    recommendation?: string;
    data: Record<string, any>;
  }>;
  metadata: {
    funnel_id: string;
    date_range: {
      start_date: string;
      end_date: string;
    };
    data_freshness: string;
    query_time_ms: number;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    suggestion?: string;
  };
  request_id: string;
  timestamp: string;
}
export interface FunnelComparisonRequest {
  funnel_ids: string[] // 2-5 funnels to compare
  comparison_period: {
    start_date: string
    end_date: string
  }
  baseline_funnel_id?: string // Which funnel to use as baseline, defaults to first

  // A/B Testing specific parameters
  ab_test_configuration?: {
    test_name: string
    test_hypothesis: string
    confidence_level: 90 | 95 | 99 // Default 95
    minimum_sample_size?: number
    power_analysis?: boolean // Default true
    expected_effect_size?: number // For power analysis
  }

  // Comparison dimensions
  include_statistical_tests?: boolean // Default true
  include_conversion_rates?: boolean // Default true
  include_drop_off_analysis?: boolean // Default true
  include_timing_analysis?: boolean // Default true
  include_cohort_comparison?: boolean // Default false
  include_segment_analysis?: boolean // Default false
  segment_dimensions?: string[] // utm_source, device_type, etc.

  // Advanced options
  normalize_for_traffic?: boolean // Default true
  exclude_outliers?: boolean // Default false
  time_series_granularity?: 'hourly' | 'daily' | 'weekly' // Default daily
}

export interface FunnelComparisonResponse {
  comparison_id: string
  comparison_timestamp: string
  comparison_period: {
    start_date: string
    end_date: string
  }

  // Basic funnel info
  funnels_compared: FunnelComparisonInfo[]
  baseline_funnel_id: string

  // Statistical comparison results
  statistical_comparison: StatisticalComparisonResult

  // Core metrics comparison
  conversion_rate_comparison: ConversionRateComparison
  drop_off_comparison: DropOffComparison
  timing_comparison: TimingComparison

  // A/B Testing results (if configured)
  ab_test_results?: ABTestResults

  // Advanced comparisons (if enabled)
  cohort_comparison?: CohortComparison[]
  segment_comparison?: SegmentComparison[]
  time_series_comparison?: TimeSeriesComparison

  // Insights and recommendations
  comparison_insights: ComparisonInsight[]
  optimization_recommendations: OptimizationRecommendation[]

  // Performance metadata
  query_performance: {
    processing_time_ms: number
    cache_hit: boolean
    funnels_analyzed: number
    total_events_processed: number
  }
}

export interface FunnelComparisonInfo {
  funnel_id: string
  funnel_name: string
  funnel_description?: string
  steps_count: number
  is_baseline: boolean

  // Period summary
  total_entries: number
  total_conversions: number
  overall_conversion_rate: number

  // Traffic characteristics
  traffic_volume_rank: number // 1-based ranking by volume
  traffic_quality_score: number // 0-100
  user_engagement_score: number // 0-100
}

export interface StatisticalComparisonResult {
  overall_significance: {
    is_statistically_significant: boolean
    confidence_level: number
    p_value: number
    chi_square_statistic?: number
    degrees_of_freedom?: number
  }

  pairwise_comparisons: PairwiseComparison[]

  // Multiple comparison correction
  multiple_comparison_correction: {
    method: 'bonferroni' | 'benjamini_hochberg' | 'none'
    adjusted_alpha: number
    significant_pairs_count: number
  }

  // Effect size analysis
  effect_size_analysis: {
    cohens_d?: number // For 2-funnel comparison
    eta_squared?: number // For multiple funnel comparison
    practical_significance: 'negligible' | 'small' | 'medium' | 'large'
    business_impact_estimate: 'low' | 'medium' | 'high'
  }
}

export interface PairwiseComparison {
  funnel_a_id: string
  funnel_b_id: string

  comparison_metrics: {
    conversion_rate_difference: number // Percentage points
    conversion_rate_lift: number // Percentage change
    confidence_interval: [number, number] // For the lift
    statistical_significance: boolean
    p_value: number
  }

  practical_assessment: {
    effect_size: number
    business_significance: 'not_significant' | 'marginal' | 'meaningful' | 'substantial'
    recommendation: 'no_action' | 'investigate_further' | 'implement_winner' | 'continue_testing'
  }
}

export interface ConversionRateComparison {
  step_by_step_comparison: StepConversionComparison[]

  overall_performance_ranking: FunnelPerformanceRank[]

  conversion_efficiency_analysis: {
    most_efficient_funnel: string
    least_efficient_funnel: string
    efficiency_gap_percentage: number
    consistency_scores: { [funnel_id: string]: number } // 0-100
  }

  // Conversion rate trends over time
  conversion_trends: {
    [funnel_id: string]: {
      trend_direction: 'improving' | 'declining' | 'stable'
      trend_strength: number // -1 to 1
      volatility_score: number // 0-100
      seasonal_patterns: boolean
    }
  }
}

export interface StepConversionComparison {
  step_number: number
  step_name: string

  step_conversions: {
    [funnel_id: string]: {
      conversion_rate: number
      entries: number
      conversions: number
      rank: number
      vs_baseline_difference: number // Percentage points
    }
  }

  step_insights: {
    best_performing_funnel: string
    worst_performing_funnel: string
    performance_spread: number // Max - Min conversion rate
    optimization_potential: number // 0-100
  }
}

export interface FunnelPerformanceRank {
  funnel_id: string
  overall_rank: number
  conversion_rate: number

  performance_breakdown: {
    traffic_acquisition_score: number // 0-100
    user_experience_score: number // 0-100
    conversion_optimization_score: number // 0-100
    retention_score: number // 0-100
  }

  relative_performance: {
    vs_baseline_lift: number // Percentage
    vs_average_lift: number // Percentage
    confidence_in_ranking: number // 0-100
  }
}

export interface DropOffComparison {
  step_by_step_dropoff: StepDropOffComparison[]

  critical_bottlenecks: {
    [funnel_id: string]: {
      worst_step: number
      drop_off_rate: number
      impact_on_overall_conversion: number // Percentage points
      severity_score: number // 0-100
    }
  }

  drop_off_pattern_analysis: {
    consistent_patterns: string[] // Common drop-off points across funnels
    unique_challenges: { [funnel_id: string]: string[] } // Unique drop-off points
    improvement_recommendations: { [funnel_id: string]: string[] }
  }
}

export interface StepDropOffComparison {
  step_number: number
  step_name: string

  step_dropoffs: {
    [funnel_id: string]: {
      drop_off_rate: number
      drop_off_count: number
      rank: number // 1 = best (lowest drop-off)
      vs_baseline_difference: number
    }
  }

  step_analysis: {
    average_drop_off_rate: number
    best_performing_funnel: string
    worst_performing_funnel: string
    improvement_opportunity: number // 0-100
  }
}

export interface TimingComparison {
  overall_timing_metrics: {
    [funnel_id: string]: {
      avg_time_to_conversion_seconds: number
      median_time_to_conversion_seconds: number
      conversion_velocity_score: number // 0-100, higher = faster
      rank: number
    }
  }

  step_timing_comparison: StepTimingComparison[]

  timing_insights: {
    fastest_funnel: string
    slowest_funnel: string
    time_efficiency_gap: number // Seconds
    optimal_timing_recommendations: { [funnel_id: string]: string }
  }
}

export interface StepTimingComparison {
  step_number: number
  step_name: string

  step_timings: {
    [funnel_id: string]: {
      avg_time_on_step_seconds: number
      median_time_on_step_seconds: number
      time_efficiency_rank: number
      vs_baseline_difference_seconds: number
    }
  }

  timing_analysis: {
    average_time_on_step: number
    fastest_funnel: string
    slowest_funnel: string
    optimization_potential_seconds: number
  }
}

// A/B Testing specific interfaces
export interface ABTestResults {
  test_configuration: {
    test_name: string
    test_hypothesis: string
    confidence_level: number
    minimum_sample_size: number
    actual_sample_size: number
  }

  test_status: {
    is_conclusive: boolean
    has_sufficient_sample: boolean
    test_duration_days: number
    recommended_duration_days?: number
  }

  statistical_results: {
    winner: string | null // funnel_id or null if inconclusive
    confidence_level_achieved: number
    p_value: number
    effect_size: number

    power_analysis: {
      statistical_power: number // 0-1
      minimum_detectable_effect: number
      actual_effect_observed: number
    }
  }

  business_impact: {
    projected_conversion_lift: number // Percentage
    projected_revenue_impact?: number // If revenue data available
    risk_assessment: 'low' | 'medium' | 'high'
    implementation_recommendation:
      | 'implement_winner'
      | 'continue_testing'
      | 'inconclusive'
      | 'no_significant_difference'
  }

  segment_results?: ABTestSegmentResult[] // If segment analysis enabled
}

export interface ABTestSegmentResult {
  segment_dimension: string // utm_source, device_type, etc.
  segment_value: string

  segment_test_results: {
    winner: string | null
    confidence_level: number
    effect_size: number
    sample_size: number
    is_conclusive: boolean
  }

  segment_insights: {
    different_from_overall: boolean
    segment_specific_recommendation: string
    confidence_in_segment_result: number // 0-100
  }
}

// Advanced comparison types
export interface CohortComparison {
  cohort_period: 'daily' | 'weekly' | 'monthly'
  cohort_date: string

  cohort_performance: {
    [funnel_id: string]: {
      cohort_size: number
      conversion_rate: number
      retention_curve: number[] // Conversion at days 1, 7, 14, 30, etc.
      cohort_quality_score: number // 0-100
    }
  }

  cohort_insights: {
    best_performing_cohort_funnel: string
    most_consistent_funnel: string
    retention_leader: string
    improvement_opportunities: string[]
  }
}

export interface SegmentComparison {
  segment_dimension: string
  segment_value: string

  segment_performance: {
    [funnel_id: string]: {
      segment_conversion_rate: number
      segment_volume: number
      segment_rank: number
      vs_overall_performance: number // Percentage difference
    }
  }

  segment_insights: {
    best_funnel_for_segment: string
    segment_optimization_potential: number // 0-100
    cross_funnel_learnings: string[]
  }
}

export interface TimeSeriesComparison {
  granularity: 'hourly' | 'daily' | 'weekly'

  time_series_data: {
    [funnel_id: string]: TimeSeriesDataPoint[]
  }

  trend_analysis: {
    [funnel_id: string]: {
      overall_trend: 'improving' | 'declining' | 'stable'
      trend_strength: number // -1 to 1
      volatility: number // 0-100
      seasonal_patterns: boolean
      anomaly_periods: string[] // ISO dates where anomalies detected
    }
  }

  comparative_insights: {
    most_stable_funnel: string
    most_volatile_funnel: string
    correlation_matrix: { [funnel_pair: string]: number } // -1 to 1
    synchronization_score: number // How much funnels move together (0-100)
  }
}

export interface TimeSeriesDataPoint {
  timestamp: string
  conversion_rate: number
  entries: number
  conversions: number
  confidence_interval: [number, number]
}

// Insights and recommendations
export interface ComparisonInsight {
  insight_type:
    | 'performance_gap'
    | 'statistical_significance'
    | 'trend_divergence'
    | 'segment_opportunity'
    | 'timing_optimization'
  title: string
  description: string
  confidence: number // 0-100
  impact_potential: 'low' | 'medium' | 'high' | 'critical'

  affected_funnels: string[]
  supporting_data: {
    metric_name: string
    values: { [funnel_id: string]: number }
    significance_level?: number
  }

  recommended_actions: string[]
  estimated_improvement: {
    metric: string
    potential_lift: number // Percentage
    confidence_range: [number, number]
  }
}

export interface OptimizationRecommendation {
  recommendation_id: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  category:
    | 'funnel_design'
    | 'user_experience'
    | 'traffic_acquisition'
    | 'conversion_optimization'
    | 'testing_strategy'

  title: string
  description: string
  rationale: string

  target_funnels: string[]
  implementation_complexity: 'low' | 'medium' | 'high'
  estimated_effort_days: number

  expected_impact: {
    primary_metric: string
    expected_lift_percentage: number
    confidence_level: number // 0-100
    risk_level: 'low' | 'medium' | 'high'
  }

  implementation_steps: string[]
  success_metrics: string[]
  monitoring_recommendations: string[]
}

// Helper interfaces for validation and configuration
export interface FunnelComparisonValidation {
  funnel_ids_valid: boolean
  date_range_valid: boolean
  sample_size_sufficient: boolean
  comparison_feasible: boolean

  validation_warnings: string[]
  validation_errors: string[]

  sample_size_analysis: {
    [funnel_id: string]: {
      actual_sample: number
      minimum_required: number
      sufficiency_percentage: number // 0-100
    }
  }
}

export interface ComparisonConfiguration {
  max_funnels_per_comparison: number // Default 5
  minimum_sample_size_per_funnel: number // Default 100
  default_confidence_level: number // Default 95

  statistical_test_settings: {
    enable_multiple_comparison_correction: boolean
    correction_method: 'bonferroni' | 'benjamini_hochberg'
    effect_size_threshold: number // Minimum practical significance
  }

  performance_settings: {
    enable_caching: boolean
    cache_ttl_minutes: number
    max_time_series_points: number
  }
}

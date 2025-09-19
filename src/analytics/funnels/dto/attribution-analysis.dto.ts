export interface AttributionAnalysisRequest {
  funnel_id: string
  start_date: string
  end_date: string
  attribution_models?: AttributionModel[] // Default: all models
  cross_channel?: boolean // Default true
  include_custom_model?: boolean // Default false
  custom_model_weights?: CustomModelWeights
  dimension_breakdown?: AttributionDimension[] // Device, source, etc.
  include_model_comparison?: boolean // Default true
}

export type AttributionModel =
  | 'first_touch'
  | 'last_touch'
  | 'linear'
  | 'time_decay'
  | 'position_based'
  | 'data_driven'
  | 'custom'

export type AttributionDimension =
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'device_type'
  | 'browser'
  | 'traffic_source'
  | 'referrer_domain'

export interface CustomModelWeights {
  first_touch_weight: number // 0-1
  last_touch_weight: number // 0-1
  middle_touches_weight: number // 0-1
  time_decay_factor?: number // For time decay component
  position_boost?: number // For position-based component
}

export interface AttributionAnalysisResponse {
  funnel_id: string
  analysis_period: {
    start_date: string
    end_date: string
  }
  analysis_timestamp: string
  attribution_results: AttributionModelResult[]
  dimension_attribution: DimensionAttribution[]
  cross_model_comparison: CrossModelComparison[]
  journey_attribution: JourneyAttribution
  conversion_credit_distribution: ConversionCreditDistribution
  query_performance: {
    processing_time_ms: number
    cache_hit: boolean
    touchpoints_analyzed: number
    conversions_analyzed: number
  }
}

export interface AttributionModelResult {
  model_name: AttributionModel
  model_configuration?: CustomModelWeights
  total_conversions: number
  total_attributed_value: number // If revenue data available

  attribution_by_touchpoint: TouchpointAttribution[]
  model_performance: {
    attribution_accuracy_score: number // 0-100
    coverage_percentage: number // % of conversions attributed
    confidence_interval: [number, number]
    statistical_significance: number // p-value vs baseline
  }

  top_performing_touchpoints: TouchpointPerformance[]
  attribution_insights: AttributionInsight[]
}

export interface TouchpointAttribution {
  touchpoint_id: string
  touchpoint_type:
    | 'organic_search'
    | 'paid_search'
    | 'direct'
    | 'referral'
    | 'social'
    | 'email'
    | 'display'
    | 'other'
  touchpoint_details: {
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    referrer_domain?: string
    device_type?: string
  }

  attributed_conversions: number
  attribution_percentage: number
  attribution_value?: number // Revenue if available

  position_analysis: {
    first_touch_percentage: number
    middle_touch_percentage: number
    last_touch_percentage: number
    avg_position_in_journey: number
  }

  effectiveness_metrics: {
    conversion_rate: number
    avg_time_to_conversion: number
    journey_completion_rate: number
    bounce_rate?: number
  }
}

export interface TouchpointPerformance {
  touchpoint_id: string
  rank: number
  attributed_conversions: number
  attribution_percentage: number
  efficiency_score: number // 0-100
  roi_estimate?: number

  performance_indicators: {
    high_converting: boolean
    cost_effective: boolean
    consistent_performer: boolean
    trending_up: boolean
  }

  optimization_opportunities: {
    increase_investment: boolean
    optimize_targeting: boolean
    improve_landing_page: boolean
    a_b_test_creative: boolean
  }
}

export interface AttributionInsight {
  insight_type:
    | 'high_performer'
    | 'underperformer'
    | 'trend_change'
    | 'attribution_shift'
    | 'optimization_opportunity'
  title: string
  description: string
  confidence: number // 0-100
  impact_potential: 'low' | 'medium' | 'high' | 'critical'

  supporting_data: {
    metric_name: string
    current_value: number
    benchmark_value?: number
    change_percentage?: number
  }[]

  recommended_actions: string[]
}

export interface DimensionAttribution {
  dimension: AttributionDimension
  dimension_values: DimensionAttributionValue[]
  dimension_insights: {
    best_performing_value: string
    worst_performing_value: string
    most_consistent_value: string
    highest_volume_value: string
  }
}

export interface DimensionAttributionValue {
  dimension_value: string
  attributed_conversions: number
  attribution_percentage: number
  attribution_models: {
    [model: string]: {
      conversions: number
      percentage: number
    }
  }

  performance_metrics: {
    conversion_rate: number
    avg_order_value?: number
    customer_lifetime_value?: number
    return_on_ad_spend?: number
  }

  journey_characteristics: {
    avg_touchpoints_before_conversion: number
    avg_days_to_conversion: number
    most_common_journey_pattern: string
    drop_off_rate: number
  }
}

export interface CrossModelComparison {
  model_a: AttributionModel
  model_b: AttributionModel

  comparison_metrics: {
    correlation_coefficient: number // -1 to 1
    attribution_difference_percentage: number
    rank_correlation: number // Spearman correlation of rankings
    agreement_percentage: number // % of top touchpoints that agree
  }

  key_differences: ModelDifference[]
  use_case_recommendations: {
    model_a_better_for: string[]
    model_b_better_for: string[]
    when_to_use_model_a: string
    when_to_use_model_b: string
  }
}

export interface ModelDifference {
  touchpoint_id: string
  model_a_attribution: number
  model_b_attribution: number
  difference_percentage: number
  difference_significance: 'minor' | 'moderate' | 'major' | 'critical'

  explanation: {
    reason_for_difference: string
    which_model_more_accurate: AttributionModel | 'unclear'
    confidence_in_assessment: number // 0-100
  }
}

export interface JourneyAttribution {
  typical_journey_patterns: JourneyPattern[]
  journey_complexity_analysis: {
    avg_touchpoints_per_conversion: number
    avg_journey_duration_days: number
    multi_channel_percentage: number
    single_channel_percentage: number
  }

  journey_effectiveness: {
    shortest_converting_journeys: JourneyPattern[]
    longest_converting_journeys: JourneyPattern[]
    most_efficient_journeys: JourneyPattern[]
    least_efficient_journeys: JourneyPattern[]
  }
}

export interface JourneyPattern {
  pattern_id: string
  touchpoint_sequence: TouchpointInJourney[]
  frequency: number // How many users followed this pattern
  conversion_rate: number
  avg_time_to_conversion: number
  pattern_effectiveness_score: number // 0-100

  attribution_distribution: {
    [touchpoint_position: number]: {
      touchpoint_type: string
      attribution_percentage: number
    }
  }
}

export interface TouchpointInJourney {
  position: number // 1-based position in journey
  touchpoint_type: string
  touchpoint_details: Record<string, string>
  time_since_previous_touchpoint?: number // seconds
  attributed_influence: number // 0-1 influence on final conversion
}

export interface ConversionCreditDistribution {
  total_conversion_credit: number // Always 100% distributed

  by_channel_type: {
    [channel: string]: {
      credit_percentage: number
      credit_trend: 'increasing' | 'decreasing' | 'stable'
      credit_consistency: number // 0-100, how consistent over time
    }
  }

  by_touchpoint_position: {
    first_touch_credit: number
    middle_touches_credit: number
    last_touch_credit: number
    assist_touches_credit: number
  }

  by_journey_stage: {
    awareness_stage_credit: number
    consideration_stage_credit: number
    decision_stage_credit: number
    retention_stage_credit?: number
  }

  credit_concentration: {
    top_10_percent_touchpoints_credit: number
    attribution_gini_coefficient: number // 0-1, inequality measure
    diversification_score: number // 0-100, how spread out attribution is
  }
}

// Helper interfaces for configuration and validation
export interface AttributionConfiguration {
  lookback_window_days: number // Default 90
  time_decay_half_life_days?: number // For time decay model
  position_based_weights?: {
    first_touch: number
    last_touch: number
    middle_distribution: 'equal' | 'time_decay' | 'linear_decay'
  }

  minimum_touchpoints: number // Default 1
  maximum_touchpoints: number // Default 20

  data_driven_settings?: {
    minimum_conversions_for_model: number // Default 1000
    confidence_threshold: number // Default 0.95
    use_machine_learning: boolean // Default false
  }
}

export interface AttributionValidation {
  total_conversions_check: boolean
  attribution_sum_check: boolean // Should sum to 100%
  model_consistency_check: boolean
  data_quality_score: number // 0-100

  validation_warnings: string[]
  validation_errors: string[]
}

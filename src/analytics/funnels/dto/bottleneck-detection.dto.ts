export interface BottleneckDetectionRequest {
  funnel_id: string
  time_window_hours?: number // Default 24h
  sensitivity_level?: 'low' | 'medium' | 'high' // Default medium
  include_recommendations?: boolean // Default true
  comparison_period_days?: number // Default 7 days for historical comparison
}

export interface BottleneckDetectionResponse {
  funnel_id: string
  analysis_timestamp: string
  time_window_hours: number
  detected_bottlenecks: DetectedBottleneck[]
  performance_anomalies: PerformanceAnomaly[]
  recommendations: AutomatedRecommendation[]
  historical_trends: HistoricalTrend[]
  detection_metadata: DetectionMetadata
}

export interface DetectedBottleneck {
  id: string
  step_order: number
  step_label: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence_score: number // 0-100
  detection_type: 'conversion_drop' | 'time_stuck' | 'exit_spike' | 'volume_anomaly'

  metrics: {
    current_conversion_rate: number
    historical_avg_conversion_rate: number
    drop_percentage: number
    users_affected: number
    avg_time_stuck: number // seconds
    statistical_significance: number // p-value
  }

  impact_analysis: {
    lost_conversions_estimated: number
    revenue_impact_estimated?: number
    users_at_risk: number
    trend_direction: 'worsening' | 'stable' | 'improving'
  }

  root_cause_indicators: RootCauseIndicator[]
  first_detected_at: string
  last_updated_at: string
}

export interface RootCauseIndicator {
  type: 'device_type' | 'traffic_source' | 'page_performance' | 'user_segment' | 'time_pattern'
  indicator: string
  confidence: number // 0-100
  evidence: {
    metric_name: string
    current_value: number
    expected_value: number
    deviation_percentage: number
  }
}

export interface PerformanceAnomaly {
  id: string
  type: 'sudden_drop' | 'gradual_decline' | 'plateau' | 'spike' | 'oscillation'
  affected_steps: number[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence_score: number

  detection_method:
    | 'statistical_control'
    | 'machine_learning'
    | 'threshold_based'
    | 'trend_analysis'

  metrics: {
    anomaly_start_time: string
    anomaly_duration_hours: number
    magnitude: number // How big the anomaly is (standard deviations)
    affected_users: number
    baseline_metric_value: number
    anomalous_metric_value: number
  }

  contextual_factors: ContextualFactor[]
}

export interface ContextualFactor {
  factor_type: 'seasonal' | 'campaign' | 'technical' | 'external' | 'user_behavior'
  description: string
  correlation_strength: number // -1 to 1
  time_overlap_percentage: number
}

export interface AutomatedRecommendation {
  id: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: 'ui_ux' | 'technical' | 'content' | 'process' | 'targeting'

  recommendation: {
    title: string
    description: string
    implementation_steps: string[]
    estimated_impact: {
      conversion_lift_percentage: number
      confidence_level: number // 0-100
      time_to_see_results_days: number
    }
  }

  implementation: {
    difficulty: 'easy' | 'medium' | 'hard' | 'complex'
    estimated_hours: number
    required_skills: string[]
    dependencies: string[]
  }

  evidence: {
    data_points_analyzed: number
    similar_cases_success_rate: number
    statistical_backing: string
  }

  for_bottlenecks: string[] // Bottleneck IDs this recommendation addresses
}

export interface HistoricalTrend {
  step_order: number
  step_label: string
  time_series: HistoricalDataPoint[]
  trend_analysis: {
    overall_direction: 'improving' | 'declining' | 'stable' | 'volatile'
    trend_strength: number // 0-100
    seasonality_detected: boolean
    cycle_length_days?: number
  }
}

export interface HistoricalDataPoint {
  timestamp: string
  conversion_rate: number
  volume: number
  avg_time_to_complete: number
  anomaly_score?: number
}

export interface DetectionMetadata {
  analysis_settings: {
    sensitivity_level: 'low' | 'medium' | 'high'
    statistical_significance_threshold: number
    minimum_sample_size: number
    confidence_interval: number
  }

  data_quality: {
    completeness_percentage: number
    data_points_analyzed: number
    outliers_removed: number
    confidence_in_results: number
  }

  algorithm_performance: {
    detection_algorithms_used: string[]
    processing_time_ms: number
    memory_usage_mb: number
    false_positive_risk: 'low' | 'medium' | 'high'
  }

  next_analysis_recommended_at: string
}

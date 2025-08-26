export interface PathAnalysisRequest {
  funnel_id: string;
  start_date: string;
  end_date: string;
  include_alternative_paths?: boolean; // Default true
  min_path_volume?: number; // Minimum users to consider path valid (default 10)
  max_path_length?: number; // Maximum path length to analyze (default 10)
  include_efficiency_scoring?: boolean; // Default true  
  include_branching_analysis?: boolean; // Default true
}

export interface PathAnalysisResponse {
  funnel_id: string;
  analysis_period: {
    start_date: string;
    end_date: string;
  };
  analysis_timestamp: string;
  conversion_paths: ConversionPath[];
  alternative_paths: AlternativePath[];
  path_optimization_opportunities: PathOptimization[];
  branching_analysis: BranchingAnalysis;
  path_comparison_matrix: PathComparisonMatrix;
  query_performance: {
    processing_time_ms: number;
    cache_hit: boolean;
    paths_analyzed: number;
  };
}

export interface ConversionPath {
  path_id: string;
  path_type: 'primary' | 'alternative' | 'shortcut' | 'extended';
  steps: PathStep[];
  metrics: PathMetrics;
  efficiency_score: number; // 0-100
  popularity_rank: number;
  success_indicators: PathSuccessIndicator[];
}

export interface PathStep {
  step_order: number;
  step_type: 'page' | 'event' | 'decision_point' | 'merge_point';
  step_identifier: string; // page URL, event name, etc.
  step_label: string;
  completion_rate: number;
  avg_time_spent: number; // seconds
  bounce_rate?: number; // for pages
  alternative_exits?: number; // users who took different path from here
}

export interface PathMetrics {
  total_users: number;
  successful_conversions: number;
  conversion_rate: number;
  avg_completion_time: number; // seconds
  median_completion_time: number;
  dropout_rate: number;
  abandonment_points: AbandonmentPoint[];
  velocity_score: number; // Conversion speed rating 0-100
}

export interface AbandonmentPoint {
  step_order: number;
  step_identifier: string;
  abandonment_count: number;
  abandonment_rate: number;
  common_exit_destinations: string[];
}

export interface PathSuccessIndicator {
  indicator_type: 'high_conversion' | 'fast_completion' | 'low_dropout' | 'user_satisfaction';
  score: number; // 0-100
  description: string;
  supporting_metrics: Record<string, number>;
}

export interface AlternativePath {
  path_id: string;
  deviation_from_primary: PathDeviation[];
  discovery_method: 'user_behavior' | 'branching_analysis' | 'exit_analysis';
  metrics: PathMetrics;
  optimization_potential: {
    estimated_conversion_lift: number; // percentage
    implementation_difficulty: 'low' | 'medium' | 'high';
    recommendation_priority: 'low' | 'medium' | 'high' | 'critical';
  };
  alternative_route_analysis: {
    skipped_steps: number[];
    additional_steps: PathStep[];
    merge_point: number; // step where path rejoins primary
  };
}

export interface PathDeviation {
  deviation_point: number; // step where deviation occurs
  deviation_type: 'skip' | 'detour' | 'backtrack' | 'alternative_action';
  deviation_steps: PathStep[];
  impact_on_conversion: number; // percentage change
  user_intent_analysis: {
    likely_reason: string;
    user_segment_correlation: string[];
    success_rate: number;
  };
}

export interface PathOptimization {
  optimization_id: string;
  target_paths: string[]; // path IDs that would benefit
  optimization_type: 'step_removal' | 'step_reorder' | 'merge_paths' | 'create_shortcut' | 'improve_step';
  
  recommendation: {
    title: string;
    description: string;
    implementation_steps: string[];
    expected_impact: {
      conversion_improvement_percentage: number;
      user_experience_score_improvement: number;
      implementation_effort_hours: number;
    };
  };
  
  supporting_evidence: {
    paths_analyzed: number;
    users_affected: number;
    confidence_level: number; // 0-100
    statistical_significance: number; // p-value
  };
  
  before_after_comparison: {
    current_metrics: PathMetrics;
    projected_metrics: PathMetrics;
    key_improvements: string[];
  };
}

export interface BranchingAnalysis {
  decision_points: DecisionPoint[];
  merge_points: MergePoint[];
  path_flow_diagram: PathFlowNode[];
  branching_efficiency: {
    overall_score: number;
    bottleneck_branches: string[];
    high_performing_branches: string[];
  };
}

export interface DecisionPoint {
  step_order: number;
  step_identifier: string;
  branches: Branch[];
  user_distribution: {
    [branch_id: string]: {
      user_count: number;
      percentage: number;
      success_rate: number;
    };
  };
  optimization_opportunities: {
    underutilized_branches: string[];
    high_friction_branches: string[];
    recommendations: string[];
  };
}

export interface Branch {
  branch_id: string;
  branch_label: string;
  destination_step: number;
  user_count: number;
  success_rate: number;
  avg_completion_time: number;
  branch_quality_score: number; // 0-100
}

export interface MergePoint {
  step_order: number;
  step_identifier: string;
  incoming_paths: IncomingPath[];
  merge_efficiency: {
    conversion_rate_consistency: number; // variance between paths
    time_to_merge_consistency: number;
    user_experience_score: number;
  };
  post_merge_performance: {
    combined_conversion_rate: number;
    performance_vs_single_path: number;
  };
}

export interface IncomingPath {
  path_id: string;
  origin_steps: number[];
  user_count: number;
  conversion_rate: number;
  avg_time_to_reach_merge: number;
  path_quality_indicators: string[];
}

export interface PathFlowNode {
  node_id: string;
  node_type: 'step' | 'decision' | 'merge' | 'exit';
  step_order: number;
  step_identifier: string;
  connections: PathConnection[];
  user_volume: number;
  conversion_impact: number;
}

export interface PathConnection {
  target_node_id: string;
  connection_strength: number; // 0-100, based on user volume
  connection_quality: number; // 0-100, based on success rate
  user_count: number;
  success_rate: number;
}

export interface PathComparisonMatrix {
  compared_paths: string[];
  comparison_metrics: ComparisonMetric[];
  statistical_significance: {
    [metric_name: string]: {
      p_value: number;
      confidence_interval: [number, number];
      is_significant: boolean;
    };
  };
  winner_analysis: {
    overall_best_path: string;
    best_by_metric: {
      [metric_name: string]: string;
    };
    recommendations: string[];
  };
}

export interface ComparisonMetric {
  metric_name: string;
  metric_type: 'conversion_rate' | 'completion_time' | 'dropout_rate' | 'efficiency_score';
  values_by_path: {
    [path_id: string]: {
      value: number;
      rank: number;
      percentile: number;
      confidence_interval: [number, number];
    };
  };
  statistical_analysis: {
    variance: number;
    significant_differences: boolean;
    best_performing_path: string;
    worst_performing_path: string;
  };
}
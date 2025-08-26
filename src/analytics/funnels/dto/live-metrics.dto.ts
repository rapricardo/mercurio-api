export interface LiveMetricsRequest {
  funnel_id: string;
  refresh_interval?: number; // seconds, default 30
}

export interface UserProgressionRequest {
  funnel_id: string;
  user_id?: string;
  anonymous_id?: string;
}

export interface LiveMetricsResponse {
  funnel_id: string;
  timestamp: string;
  live_metrics: {
    active_sessions: number;
    entries_last_hour: number;
    conversions_last_hour: number;
    current_conversion_rate: number;
    users_in_funnel: number;
    step_distribution: StepDistribution[];
  };
  real_time_trends: {
    entry_rate_per_minute: number[];
    conversion_rate_trend: number[];
    timestamps: string[];
  };
  alerts: FunnelAlert[];
}

export interface StepDistribution {
  step_order: number;
  step_label: string;
  current_users: number;
  percentage: number;
}

export interface FunnelAlert {
  id: string;
  type: 'conversion_drop' | 'bottleneck' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  triggered_at: string;
  step_order?: number;
  metrics: {
    threshold: number;
    current_value: number;
    change_percentage: number;
  };
}

export interface UserProgressionResponse {
  funnel_id: string;
  user_identifier: string;
  user_type: 'anonymous' | 'identified';
  progression: {
    current_step: number;
    current_step_label: string;
    completed_steps: number[];
    entry_time: string;
    last_activity: string;
    time_in_funnel: number; // seconds
    conversion_status: 'in_progress' | 'converted' | 'abandoned';
  };
  journey_history: JourneyStep[];
  step_timing: StepTiming[];
  performance_indicators: {
    progression_velocity: number; // steps per hour
    time_to_conversion?: number; // seconds
    abandonment_risk_score: number; // 0-100
  };
}

export interface JourneyStep {
  step_order: number;
  step_label: string;
  timestamp: string;
  time_from_start: number; // seconds
  time_from_previous?: number; // seconds
  event_details: {
    event_name: string;
    page?: string;
    utm_source?: string;
    device_type?: string;
  };
}

export interface StepTiming {
  step_order: number;
  step_label: string;
  average_time_to_reach: number; // seconds
  user_time_to_reach?: number; // seconds
  performance_vs_average: 'faster' | 'average' | 'slower';
  percentile_ranking?: number; // user's percentile vs other users
}
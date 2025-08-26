# Funnel Analysis Endpoints - API Design Specification

## Overview

This document provides detailed API specifications for the funnel analysis endpoints, including request/response schemas, validation rules, and integration patterns with the existing Mercurio API infrastructure.

## Base Configuration

**Base URL**: `/v1/analytics/funnels`  
**Authentication**: API Key Authentication (Bearer token)  
**Content-Type**: `application/json`  
**Rate Limiting**: Varies by endpoint type (see individual endpoints)

## 1. Funnel Configuration Management

### 1.1 Create Funnel

**Endpoint**: `POST /v1/analytics/funnels`  
**Rate Limit**: 100 requests/hour  
**Scope Required**: `funnels:write`

#### Request Schema
```typescript
interface CreateFunnelRequest {
  name: string;                    // 1-255 characters
  description?: string;            // Optional, max 1000 characters  
  time_window_days: number;        // 1-90 days
  metadata?: Record<string, any>;  // Optional custom metadata
  steps: FunnelStepConfig[];       // 2-20 steps
}

interface FunnelStepConfig {
  order: number;                   // Step order (1-based)
  type: 'start' | 'page' | 'event' | 'decision' | 'conversion';
  label: string;                   // 1-255 characters
  matching_rules: MatchingRule[];  // 1-10 rules per step
}

interface MatchingRule {
  type: 'page_url' | 'event_name' | 'event_property';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'greater_than' | 'less_than';
  value: string | number;
  property_name?: string;          // Required when type is 'event_property'
}
```

#### Response Schema
```typescript
interface CreateFunnelResponse {
  success: boolean;
  data: {
    funnel_id: string;             // uf_ prefix
    name: string;
    description?: string;
    time_window_days: number;
    status: 'draft';
    version: 1;
    step_count: number;
    created_at: string;            // ISO 8601
    created_by: string;            // API key ID
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
  };
}
```

#### Validation Rules
- `name`: Required, 1-255 characters, unique within workspace
- `time_window_days`: Required, integer between 1-90
- `steps`: Required array, 2-20 elements
- `steps[].order`: Must be sequential starting from 1
- `steps[].type`: First step must be 'start', last step should be 'conversion'
- `matching_rules`: At least 1 rule per step, max 10 rules per step

#### Error Responses
```typescript
// 400 Bad Request - Validation Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid funnel configuration",
    "details": [
      {
        "field": "steps[0].type",
        "message": "First step must be of type 'start'"
      }
    ]
  }
}

// 409 Conflict - Duplicate Name
{
  "success": false,
  "error": {
    "code": "FUNNEL_NAME_EXISTS",
    "message": "Funnel with this name already exists in workspace"
  }
}
```

### 1.2 List Funnels

**Endpoint**: `GET /v1/analytics/funnels`  
**Rate Limit**: 1000 requests/hour  
**Scope Required**: `funnels:read`

#### Query Parameters
```typescript
interface ListFunnelsQuery {
  page?: number;           // Default: 1, min: 1
  limit?: number;          // Default: 20, min: 1, max: 100
  status?: 'draft' | 'published' | 'archived';  // Filter by status
  search?: string;         // Search in name/description
  sort?: 'name' | 'created_at' | 'last_updated';  // Default: 'created_at'
  order?: 'asc' | 'desc';  // Default: 'desc'
}
```

#### Response Schema
```typescript
interface ListFunnelsResponse {
  success: boolean;
  data: {
    funnels: FunnelSummary[];
    pagination: {
      page: number;
      limit: number;
      total_count: number;
      total_pages: number;
      has_next: boolean;
      has_prev: boolean;
    };
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
  };
}

interface FunnelSummary {
  funnel_id: string;
  name: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  current_version: number;
  published_version?: number;
  step_count: number;
  time_window_days: number;
  created_at: string;
  last_updated_at: string;
  performance_summary?: {
    total_entries: number;
    conversion_rate: number;
    last_calculated_at: string;
  };
}
```

### 1.3 Get Funnel Details

**Endpoint**: `GET /v1/analytics/funnels/:funnelId`  
**Rate Limit**: 1000 requests/hour  
**Scope Required**: `funnels:read`

#### Path Parameters
- `funnelId`: Funnel ID with `uf_` prefix

#### Query Parameters
```typescript
interface GetFunnelQuery {
  version?: number;        // Specific version, default: current
  include_steps?: boolean; // Include step details, default: true
  include_stats?: boolean; // Include performance stats, default: true
}
```

#### Response Schema
```typescript
interface FunnelDetailsResponse {
  success: boolean;
  data: {
    funnel_id: string;
    name: string;
    description?: string;
    status: 'draft' | 'published' | 'archived';
    current_version: number;
    requested_version: number;
    time_window_days: number;
    created_at: string;
    last_updated_at: string;
    created_by: string;
    steps: FunnelStepDetails[];
    performance_stats?: FunnelPerformanceStats;
    version_history: FunnelVersionSummary[];
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
  };
}

interface FunnelStepDetails {
  step_id: string;
  order: number;
  type: string;
  label: string;
  matching_rules: MatchingRuleDetails[];
  performance?: {
    entries: number;
    completions: number;
    completion_rate: number;
    avg_time_to_next_step_seconds?: number;
  };
}

interface MatchingRuleDetails {
  rule_id: string;
  type: string;
  operator: string;
  value: string | number;
  property_name?: string;
}

interface FunnelPerformanceStats {
  total_entries: number;
  total_conversions: number;
  overall_conversion_rate: number;
  avg_conversion_time_seconds: number;
  step_conversion_rates: number[];
  last_calculated_at: string;
  data_freshness_minutes: number;
}
```

### 1.4 Update Funnel

**Endpoint**: `PATCH /v1/analytics/funnels/:funnelId`  
**Rate Limit**: 100 requests/hour  
**Scope Required**: `funnels:write`

#### Request Schema
```typescript
interface UpdateFunnelRequest {
  name?: string;                   // 1-255 characters
  description?: string;            // Max 1000 characters
  time_window_days?: number;       // 1-90 days
  metadata?: Record<string, any>;  // Custom metadata
  steps?: FunnelStepConfig[];      // Complete step configuration
}
```

#### Response Schema
```typescript
interface UpdateFunnelResponse {
  success: boolean;
  data: {
    funnel_id: string;
    name: string;
    description?: string;
    time_window_days: number;
    status: 'draft';
    version: number;               // Incremented version
    step_count: number;
    updated_at: string;
    changes_summary: string[];     // List of changes made
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
  };
}
```

### 1.5 Archive Funnel

**Endpoint**: `DELETE /v1/analytics/funnels/:funnelId`  
**Rate Limit**: 50 requests/hour  
**Scope Required**: `funnels:admin`

#### Response Schema
```typescript
interface ArchiveFunnelResponse {
  success: boolean;
  data: {
    funnel_id: string;
    name: string;
    status: 'archived';
    archived_at: string;
    data_retention_days: number;   // How long historical data is kept
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
  };
}
```

## 2. Funnel Analytics & Metrics

### 2.1 Conversion Rates Analysis

**Endpoint**: `GET /v1/analytics/funnels/:funnelId/conversion`  
**Rate Limit**: 500 requests/hour  
**Scope Required**: `funnels:read`

#### Query Parameters
```typescript
interface ConversionAnalysisQuery {
  date_from: string;              // ISO 8601 date, required
  date_to: string;                // ISO 8601 date, required
  granularity?: 'day' | 'week' | 'month';  // Default: 'day'
  segments?: string[];            // Available: 'device', 'traffic_source', 'user_type'
  compare_period?: boolean;       // Compare with previous period
  version?: number;               // Funnel version, default: published
}
```

#### Response Schema
```typescript
interface ConversionAnalysisResponse {
  success: boolean;
  data: {
    funnel_id: string;
    version: number;
    period: {
      from: string;
      to: string;
      granularity: string;
    };
    overall_metrics: {
      total_entries: number;
      total_conversions: number;
      conversion_rate: number;
      avg_conversion_time_seconds: number;
      median_conversion_time_seconds: number;
    };
    step_metrics: StepConversionMetrics[];
    time_series: ConversionTimeSeriesPoint[];
    segment_analysis?: SegmentConversionMetrics[];
    comparison?: {
      previous_period: ConversionPeriodMetrics;
      change_percentage: number;
      statistical_significance: number;
    };
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
    cache_hit: boolean;
    data_freshness_minutes: number;
  };
}

interface StepConversionMetrics {
  step_order: number;
  step_label: string;
  entries: number;
  completions: number;
  conversion_rate: number;
  drop_off_rate: number;
  avg_time_from_previous_seconds?: number;
  median_time_from_previous_seconds?: number;
}

interface ConversionTimeSeriesPoint {
  date: string;                   // ISO 8601 date
  entries: number;
  conversions: number;
  conversion_rate: number;
}

interface SegmentConversionMetrics {
  segment_type: string;           // 'device', 'traffic_source', 'user_type'
  segment_value: string;
  entries: number;
  conversions: number;
  conversion_rate: number;
  performance_vs_average: number; // Percentage difference from average
}
```

### 2.2 Drop-off Analysis

**Endpoint**: `GET /v1/analytics/funnels/:funnelId/dropoff`  
**Rate Limit**: 500 requests/hour  
**Scope Required**: `funnels:read`

#### Query Parameters
```typescript
interface DropoffAnalysisQuery {
  date_from: string;              // ISO 8601 date, required
  date_to: string;                // ISO 8601 date, required
  segments?: string[];            // Available: 'device', 'traffic_source', 'user_type'
  include_paths?: boolean;        // Include exit path analysis
  min_sample_size?: number;       // Minimum sample size for segments
}
```

#### Response Schema
```typescript
interface DropoffAnalysisResponse {
  success: boolean;
  data: {
    funnel_id: string;
    period: { from: string; to: string; };
    step_dropoffs: StepDropoffMetrics[];
    critical_bottlenecks: BottleneckAnalysis[];
    segment_dropoffs?: SegmentDropoffMetrics[];
    exit_paths?: ExitPathAnalysis[];
    recommendations: OptimizationRecommendation[];
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
    data_freshness_minutes: number;
  };
}

interface StepDropoffMetrics {
  step_order: number;
  step_label: string;
  entries: number;
  exits: number;
  dropoff_rate: number;
  dropoff_impact_score: number;   // Weighted impact on overall conversion
  trend: 'improving' | 'stable' | 'worsening';
}

interface BottleneckAnalysis {
  step_order: number;
  step_label: string;
  bottleneck_severity: 'high' | 'medium' | 'low';
  dropoff_rate: number;
  expected_dropoff_rate: number;  // Based on historical data
  excess_dropoff_percentage: number;
  potential_recovery_conversions: number;
}

interface SegmentDropoffMetrics {
  segment_type: string;
  segment_value: string;
  worst_performing_step: number;
  dropoff_rate_by_step: number[];
  overall_performance: 'above_average' | 'average' | 'below_average';
}

interface ExitPathAnalysis {
  step_order: number;
  common_exit_pages: Array<{
    page_url: string;
    exit_count: number;
    percentage: number;
  }>;
  common_exit_events: Array<{
    event_name: string;
    exit_count: number;
    percentage: number;
  }>;
}

interface OptimizationRecommendation {
  type: 'step_optimization' | 'segment_targeting' | 'flow_improvement';
  priority: 'high' | 'medium' | 'low';
  step_order?: number;
  recommendation: string;
  potential_impact: number;       // Estimated conversion improvement percentage
}
```

### 2.3 Cohort Analysis

**Endpoint**: `GET /v1/analytics/funnels/:funnelId/cohorts`  
**Rate Limit**: 200 requests/hour  
**Scope Required**: `funnels:read`

#### Query Parameters
```typescript
interface CohortAnalysisQuery {
  date_from: string;              // ISO 8601 date, required
  date_to: string;                // ISO 8601 date, required
  cohort_period: 'daily' | 'weekly' | 'monthly';  // Default: 'weekly'
  retention_days?: number;        // Days to track retention, default: funnel time window
  segments?: string[];            // Segment cohorts by attributes
}
```

#### Response Schema
```typescript
interface CohortAnalysisResponse {
  success: boolean;
  data: {
    funnel_id: string;
    period: { from: string; to: string; };
    cohort_period: string;
    cohorts: CohortMetrics[];
    cohort_comparison: CohortComparison[];
    segment_cohorts?: SegmentCohortMetrics[];
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
    data_freshness_minutes: number;
  };
}

interface CohortMetrics {
  cohort_id: string;              // e.g., "2024-01-W1"
  cohort_date: string;
  cohort_size: number;
  step_completion_rates: StepCohortMetrics[];
  overall_conversion_rate: number;
  avg_days_to_conversion: number;
  retention_curve: Array<{
    day: number;
    active_users: number;
    retention_rate: number;
  }>;
}

interface StepCohortMetrics {
  step_order: number;
  completion_count: number;
  completion_rate: number;
  avg_days_to_complete: number;
  median_days_to_complete: number;
}

interface CohortComparison {
  cohort_1: string;
  cohort_2: string;
  conversion_rate_difference: number;
  statistical_significance: number;
  significant_step_differences: Array<{
    step_order: number;
    difference: number;
    significance: number;
  }>;
}

interface SegmentCohortMetrics {
  segment_type: string;
  segment_value: string;
  cohorts: CohortMetrics[];
  segment_performance: 'outperforming' | 'average' | 'underperforming';
}
```

### 2.4 Time-to-Conversion Analysis

**Endpoint**: `GET /v1/analytics/funnels/:funnelId/timing`  
**Rate Limit**: 500 requests/hour  
**Scope Required**: `funnels:read`

#### Query Parameters
```typescript
interface TimingAnalysisQuery {
  date_from: string;              // ISO 8601 date, required
  date_to: string;                // ISO 8601 date, required
  percentiles?: number[];         // Default: [25, 50, 75, 90, 95]
  segments?: string[];            // Segment analysis
  include_step_timing?: boolean;  // Include step-by-step timing
}
```

#### Response Schema
```typescript
interface TimingAnalysisResponse {
  success: boolean;
  data: {
    funnel_id: string;
    period: { from: string; to: string; };
    overall_timing: TimingMetrics;
    step_timing: StepTimingMetrics[];
    segment_timing?: SegmentTimingMetrics[];
    conversion_velocity_trends: VelocityTrendPoint[];
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
    data_freshness_minutes: number;
  };
}

interface TimingMetrics {
  mean_seconds: number;
  median_seconds: number;
  percentiles: Array<{
    percentile: number;
    value_seconds: number;
  }>;
  std_deviation_seconds: number;
  conversion_velocity_score: number;  // Custom metric: conversions per time unit
}

interface StepTimingMetrics {
  step_order: number;
  step_label: string;
  from_previous_step: TimingMetrics;
  from_funnel_start: TimingMetrics;
  abandonment_risk_threshold_seconds: number;
}

interface SegmentTimingMetrics {
  segment_type: string;
  segment_value: string;
  overall_timing: TimingMetrics;
  performance_vs_average: number;  // Percentage faster/slower than average
}

interface VelocityTrendPoint {
  date: string;
  avg_conversion_time_seconds: number;
  conversion_velocity_score: number;
  trend: 'improving' | 'stable' | 'declining';
}
```

## 3. Real-time Funnel Tracking

### 3.1 Live Metrics

**Endpoint**: `GET /v1/analytics/funnels/:funnelId/live`  
**Rate Limit**: 500 requests/hour  
**Scope Required**: `funnels:read`

#### Query Parameters
```typescript
interface LiveMetricsQuery {
  window_minutes?: number;        // Time window for live data, default: 60, max: 1440
  refresh_interval?: number;      // Suggested refresh interval in seconds
}
```

#### Response Schema
```typescript
interface LiveMetricsResponse {
  success: boolean;
  data: {
    funnel_id: string;
    window_minutes: number;
    timestamp: string;              // Current timestamp
    live_metrics: {
      active_sessions: number;      // Sessions currently in funnel
      entries_last_hour: number;
      conversions_last_hour: number;
      current_conversion_rate: number;
      steps_health: StepHealthStatus[];
    };
    real_time_trends: {
      entry_rate_per_minute: number[];      // Last 60 minutes
      conversion_rate_trend: number[];      // Last 24 hours
      active_users_by_step: number[];
    };
    alerts: FunnelAlert[];
    next_refresh_at: string;
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
    data_freshness_seconds: number;
  };
}

interface StepHealthStatus {
  step_order: number;
  step_label: string;
  current_users: number;
  completion_rate_1h: number;
  status: 'healthy' | 'degraded' | 'critical';
  alert_triggered: boolean;
}

interface FunnelAlert {
  alert_id: string;
  type: 'conversion_drop' | 'step_bottleneck' | 'completion_spike' | 'anomaly_detected';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  step_order?: number;
  triggered_at: string;
  acknowledged: boolean;
}
```

### 3.2 User Progression Tracking

**Endpoint**: `GET /v1/analytics/funnels/:funnelId/users/:userId`  
**Rate Limit**: 1000 requests/hour  
**Scope Required**: `funnels:read`

#### Path Parameters
- `userId`: Anonymous ID (`a_`) or Lead ID (`ld_`)

#### Response Schema
```typescript
interface UserProgressionResponse {
  success: boolean;
  data: {
    funnel_id: string;
    user_id: string;
    user_type: 'anonymous' | 'identified';
    progression_status: 'in_progress' | 'completed' | 'abandoned';
    current_step?: number;
    completion_percentage: number;
    step_history: UserStepHistory[];
    session_data: UserSessionData[];
    predicted_completion_probability?: number;
    time_in_funnel_seconds: number;
    abandonment_risk: 'low' | 'medium' | 'high';
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
  };
}

interface UserStepHistory {
  step_order: number;
  step_label: string;
  completed_at: string;
  completion_method: 'page_view' | 'event_trigger' | 'property_match';
  session_id: string;
  time_from_previous_seconds?: number;
  additional_context?: Record<string, any>;
}

interface UserSessionData {
  session_id: string;
  started_at: string;
  ended_at?: string;
  device: {
    type: string;
    browser: string;
    os: string;
  };
  traffic_source: {
    source: string;
    medium: string;
    campaign?: string;
  };
  geo: {
    country: string;
    region?: string;
    city?: string;
  };
}
```

### 3.3 Bottleneck Detection

**Endpoint**: `GET /v1/analytics/funnels/:funnelId/bottlenecks`  
**Rate Limit**: 200 requests/hour  
**Scope Required**: `funnels:read`

#### Query Parameters
```typescript
interface BottleneckDetectionQuery {
  detection_window_hours?: number;  // Default: 24, max: 168 (1 week)
  sensitivity?: 'low' | 'medium' | 'high';  // Detection sensitivity
  min_sample_size?: number;         // Minimum events for detection
}
```

#### Response Schema
```typescript
interface BottleneckDetectionResponse {
  success: boolean;
  data: {
    funnel_id: string;
    detection_window_hours: number;
    timestamp: string;
    detected_bottlenecks: DetectedBottleneck[];
    performance_anomalies: PerformanceAnomaly[];
    recommendations: AutomatedRecommendation[];
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
    detection_algorithm_version: string;
  };
}

interface DetectedBottleneck {
  bottleneck_id: string;
  step_order: number;
  step_label: string;
  severity: 'minor' | 'moderate' | 'severe';
  detection_confidence: number;    // 0-1 confidence score
  metrics: {
    current_conversion_rate: number;
    expected_conversion_rate: number;
    performance_degradation_percentage: number;
    affected_users_count: number;
  };
  contributing_factors: Array<{
    factor: string;
    impact_score: number;
    description: string;
  }>;
  first_detected_at: string;
  trend: 'improving' | 'stable' | 'worsening';
}

interface PerformanceAnomaly {
  anomaly_id: string;
  type: 'conversion_spike' | 'conversion_drop' | 'timing_anomaly' | 'volume_anomaly';
  step_order?: number;
  severity: number;                // 0-1 severity score
  description: string;
  detected_at: string;
  potential_causes: string[];
}

interface AutomatedRecommendation {
  recommendation_id: string;
  type: 'optimization' | 'investigation' | 'monitoring';
  priority: number;                // 1-10 priority score
  title: string;
  description: string;
  action_items: string[];
  expected_impact: {
    metric: string;
    improvement_percentage: number;
    confidence: number;
  };
}
```

## 4. Advanced Funnel Features

### 4.1 Multi-path Analysis

**Endpoint**: `GET /v1/analytics/funnels/:funnelId/paths`  
**Rate Limit**: 200 requests/hour  
**Scope Required**: `funnels:read`

#### Query Parameters
```typescript
interface PathAnalysisQuery {
  date_from: string;              // ISO 8601 date, required
  date_to: string;                // ISO 8601 date, required
  include_alternatives?: boolean;  // Include alternative paths
  min_path_frequency?: number;    // Minimum occurrences for path inclusion
  max_paths?: number;             // Maximum number of paths to return
}
```

#### Response Schema
```typescript
interface PathAnalysisResponse {
  success: boolean;
  data: {
    funnel_id: string;
    period: { from: string; to: string; };
    conversion_paths: ConversionPath[];
    alternative_paths: AlternativePath[];
    path_optimization_opportunities: PathOptimization[];
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
    data_freshness_minutes: number;
  };
}

interface ConversionPath {
  path_id: string;
  step_sequence: number[];
  frequency: number;
  conversion_rate: number;
  avg_completion_time_seconds: number;
  path_efficiency_score: number;
  user_segments: Array<{
    segment_type: string;
    segment_value: string;
    percentage: number;
  }>;
}

interface AlternativePath {
  path_id: string;
  step_sequence: number[];
  frequency: number;
  conversion_rate: number;
  deviation_from_primary: number;
  success_rate_vs_primary: number;
}

interface PathOptimization {
  optimization_id: string;
  type: 'step_reorder' | 'step_addition' | 'step_removal' | 'conditional_logic';
  current_path: number[];
  suggested_path: number[];
  rationale: string;
  estimated_improvement: number;
  implementation_difficulty: 'low' | 'medium' | 'high';
}
```

### 4.2 Attribution Analysis

**Endpoint**: `GET /v1/analytics/funnels/:funnelId/attribution`  
**Rate Limit**: 200 requests/hour  
**Scope Required**: `funnels:read`

#### Query Parameters
```typescript
interface AttributionAnalysisQuery {
  date_from: string;              // ISO 8601 date, required
  date_to: string;                // ISO 8601 date, required
  attribution_models: ('first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based')[];
  attribution_dimensions: ('traffic_source' | 'utm_campaign' | 'utm_medium' | 'referrer' | 'device')[];
}
```

#### Response Schema
```typescript
interface AttributionAnalysisResponse {
  success: boolean;
  data: {
    funnel_id: string;
    period: { from: string; to: string; };
    attribution_results: AttributionModelResult[];
    dimension_attribution: DimensionAttribution[];
    cross_model_comparison: CrossModelComparison[];
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
    data_freshness_minutes: number;
  };
}

interface AttributionModelResult {
  model: string;
  total_conversions: number;
  attribution_breakdown: Array<{
    dimension: string;
    value: string;
    attributed_conversions: number;
    attribution_percentage: number;
    confidence_score: number;
  }>;
}

interface DimensionAttribution {
  dimension: string;
  values: Array<{
    value: string;
    attribution_by_model: Record<string, number>;
    total_touchpoints: number;
    avg_touchpoints_to_conversion: number;
  }>;
}

interface CrossModelComparison {
  dimension: string;
  value: string;
  model_comparison: Array<{
    model_1: string;
    model_2: string;
    attribution_difference: number;
    significance_level: number;
  }>;
}
```

### 4.3 Funnel Comparison

**Endpoint**: `POST /v1/analytics/funnels/compare`  
**Rate Limit**: 100 requests/hour  
**Scope Required**: `funnels:read`

#### Request Schema
```typescript
interface FunnelComparisonRequest {
  comparisons: FunnelComparisonConfig[];
  date_from: string;              // ISO 8601 date, required
  date_to: string;                // ISO 8601 date, required
  metrics: ('conversion_rate' | 'drop_off_rate' | 'avg_conversion_time' | 'step_performance')[];
  statistical_test?: 'chi_square' | 't_test' | 'mann_whitney';
}

interface FunnelComparisonConfig {
  comparison_id: string;
  funnel_1: { funnel_id: string; version?: number; };
  funnel_2: { funnel_id: string; version?: number; };
  comparison_type: 'a_b_test' | 'time_period' | 'version' | 'segment';
  segment_filters?: Record<string, any>;
}
```

#### Response Schema
```typescript
interface FunnelComparisonResponse {
  success: boolean;
  data: {
    comparison_results: ComparisonResult[];
    statistical_summary: StatisticalSummary;
    recommendations: ComparisonRecommendation[];
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
    statistical_confidence_level: number;
  };
}

interface ComparisonResult {
  comparison_id: string;
  funnel_1: FunnelComparisonMetrics;
  funnel_2: FunnelComparisonMetrics;
  differences: MetricDifference[];
  statistical_significance: StatisticalTest;
  winner?: 'funnel_1' | 'funnel_2' | 'no_significant_difference';
}

interface FunnelComparisonMetrics {
  funnel_id: string;
  version: number;
  total_entries: number;
  total_conversions: number;
  conversion_rate: number;
  avg_conversion_time_seconds: number;
  step_metrics: StepComparisonMetrics[];
}

interface MetricDifference {
  metric: string;
  absolute_difference: number;
  percentage_difference: number;
  confidence_interval: [number, number];
}

interface StatisticalTest {
  test_type: string;
  p_value: number;
  test_statistic: number;
  degrees_of_freedom?: number;
  is_significant: boolean;
  effect_size: number;
}
```

### 4.4 Export Funnel Data

**Endpoint**: `POST /v1/analytics/funnels/:funnelId/export`  
**Rate Limit**: 10 requests/hour  
**Scope Required**: `funnels:read`

#### Request Schema
```typescript
interface FunnelExportRequest {
  date_from: string;              // ISO 8601 date, required
  date_to: string;                // ISO 8601 date, required
  format: 'csv' | 'json' | 'excel';
  export_type: 'summary' | 'detailed' | 'raw_events';
  include_segments?: boolean;
  include_user_journeys?: boolean;
  filters?: {
    segments?: Record<string, string[]>;
    completion_status?: ('completed' | 'in_progress' | 'abandoned')[];
  };
  delivery_method: 'download' | 'email';
  email_address?: string;         // Required if delivery_method is 'email'
}
```

#### Response Schema
```typescript
interface FunnelExportResponse {
  success: boolean;
  data: {
    export_id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    estimated_completion_seconds?: number;
    download_url?: string;          // Available when status is 'completed'
    expires_at?: string;           // Download link expiration
    file_size_bytes?: number;
    record_count?: number;
  };
  meta: {
    request_id: string;
    processing_time_ms: number;
  };
}
```

## Error Handling Standards

### Common Error Codes

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    correlation_id: string;
  };
  meta: {
    request_id: string;
    timestamp: string;
  };
}

// Standard Error Codes
const ERROR_CODES = {
  // Validation Errors (400)
  VALIDATION_ERROR: 'Invalid request parameters or body',
  INVALID_DATE_RANGE: 'Date range is invalid or exceeds maximum allowed period',
  INVALID_FUNNEL_CONFIG: 'Funnel configuration contains errors',
  
  // Authorization Errors (401/403)
  INSUFFICIENT_SCOPE: 'API key lacks required scope for this operation',
  FUNNEL_ACCESS_DENIED: 'Access denied to specified funnel',
  
  // Not Found Errors (404)
  FUNNEL_NOT_FOUND: 'Funnel does not exist or has been archived',
  FUNNEL_VERSION_NOT_FOUND: 'Specified funnel version does not exist',
  
  // Conflict Errors (409)
  FUNNEL_NAME_EXISTS: 'Funnel name already exists in workspace',
  FUNNEL_ALREADY_PUBLISHED: 'Funnel version is already published',
  
  // Rate Limit Errors (429)
  RATE_LIMIT_EXCEEDED: 'Request rate limit exceeded',
  QUERY_COMPLEXITY_LIMIT: 'Query is too complex, reduce parameters',
  
  // Server Errors (500)
  CALCULATION_ERROR: 'Error occurred during funnel calculations',
  DATA_PROCESSING_ERROR: 'Error processing funnel data',
  EXPORT_GENERATION_ERROR: 'Error generating export file'
} as const;
```

### Rate Limiting Headers

All responses include rate limiting headers:

```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 485  
X-RateLimit-Reset: 1640995200
X-RateLimit-Retry-After: 3600
```

### Response Time Headers

Performance monitoring headers:

```
X-Processing-Time-Ms: 145
X-Cache-Status: hit | miss | stale
X-Data-Freshness-Minutes: 5
```

## Integration Patterns

### 1. Authentication Integration

```typescript
// Extends existing API key scopes
const FUNNEL_SCOPES = [
  'funnels:read',        // View funnel configs and analytics
  'funnels:write',       // Create/update funnel configs  
  'funnels:admin',       // Full funnel management
  'funnels:export',      // Export funnel data
] as const;

// Backward compatibility with existing analytics scopes
const COMPATIBLE_SCOPES = [
  'analytics:read',      // Grants funnels:read
  'analytics:write',     // Grants funnels:write
] as const;
```

### 2. Caching Integration

```typescript
// Cache keys follow existing patterns
const CACHE_KEYS = {
  funnel_config: (funnelId: string, version: number) => 
    `funnel:config:${funnelId}:v${version}`,
  
  conversion_metrics: (funnelId: string, dateFrom: string, dateTo: string) =>
    `funnel:metrics:${funnelId}:${dateFrom}:${dateTo}`,
    
  live_metrics: (funnelId: string) =>
    `funnel:live:${funnelId}`,
} as const;

// TTL values
const CACHE_TTL = {
  funnel_config: 300,      // 5 minutes
  conversion_metrics: 900,  // 15 minutes
  live_metrics: 30,        // 30 seconds
} as const;
```

### 3. Monitoring Integration

```typescript
// Metrics follow existing naming conventions
const METRICS = {
  'funnel_endpoint_duration_ms': 'Histogram of endpoint response times',
  'funnel_calculation_duration_ms': 'Histogram of calculation times',
  'funnel_cache_hit_rate': 'Ratio of cache hits to requests',
  'funnel_query_complexity_score': 'Gauge of query complexity',
  'funnel_active_calculations': 'Number of concurrent calculations',
} as const;

// Log structured data follows existing format
interface FunnelLogContext {
  funnel_id: string;
  version?: number;
  tenant_id: string;
  workspace_id: string;
  endpoint: string;
  query_complexity?: number;
  cache_status?: 'hit' | 'miss' | 'stale';
  processing_time_ms: number;
}
```

This comprehensive API design specification provides detailed schemas, validation rules, error handling, and integration patterns for all funnel analysis endpoints, ensuring seamless integration with the existing Mercurio API infrastructure while providing robust functionality for advanced funnel analytics.
# Funnel Analysis Endpoints - Technical Design Document

## Executive Summary

This design document outlines the implementation of comprehensive funnel analysis capabilities as an extension to Mercurio's existing AnalyticsModule. The implementation will provide sophisticated funnel configuration management, real-time tracking, advanced analytics calculations, and multi-dimensional attribution analysis while maintaining performance targets of P50 < 200ms for simple queries and P95 < 2s for complex reports.

### Key Design Decisions

1. **Module Extension Pattern**: Extend the existing AnalyticsModule with FunnelAnalyticsModule to leverage proven infrastructure
2. **Multi-tenant Isolation**: Utilize existing tenant/workspace scoping with dedicated funnel data isolation
3. **Performance-First Architecture**: Implement intelligent caching, query optimization, and real-time processing pipelines
4. **Existing Schema Utilization**: Leverage existing funnel tables with performance-optimized extensions
5. **TypeScript-First API Design**: Comprehensive type safety across all endpoints and data structures

## System Architecture

### Overall Architecture

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  Funnel APIs    │───▶│  FunnelAnalytics    │───▶│   Analytics         │
│  (Controllers)  │    │      Module         │    │  Infrastructure     │
└─────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                        │                          │
         │                        ▼                          ▼
         │               ┌─────────────────────┐    ┌─────────────────────┐
         │               │  Funnel Services    │    │   Cache Services    │
         │               │  - Configuration    │    │   - Redis Cache     │
         │               │  - Analytics        │    │   - TTL Management  │
         │               │  - Real-time        │    │   - Invalidation    │
         │               └─────────────────────┘    └─────────────────────┘
         │                        │                          │
         ▼                        ▼                          ▼
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Database      │    │   Event Stream      │    │  Monitoring &       │
│   - Postgres    │    │   - Real-time       │    │  Observability      │
│   - Indexes     │    │   - Processing      │    │   - Metrics         │
│   - Partitions  │    │   - State Cache     │    │   - Logging         │
└─────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### Module Structure

The FunnelAnalyticsModule will follow the established patterns:

```typescript
FunnelAnalyticsModule/
├── controllers/
│   ├── funnel-config.controller.ts      # Funnel CRUD operations
│   ├── funnel-analytics.controller.ts   # Analytics endpoints
│   └── funnel-realtime.controller.ts    # Real-time tracking
├── services/
│   ├── funnel-config.service.ts         # Configuration management
│   ├── funnel-analytics.service.ts      # Core analytics calculations
│   ├── funnel-cache.service.ts          # Funnel-specific caching
│   ├── funnel-realtime.service.ts       # Real-time processing
│   ├── funnel-calculation.service.ts    # Conversion calculations
│   └── funnel-attribution.service.ts    # Attribution modeling
├── repositories/
│   ├── funnel.repository.ts             # Database operations
│   └── funnel-analytics.repository.ts   # Analytics queries
├── dto/
│   ├── funnel-config.dto.ts             # Configuration DTOs
│   ├── funnel-query.dto.ts              # Query parameter DTOs
│   └── funnel-response.dto.ts           # Response type DTOs
├── types/
│   ├── funnel.types.ts                  # Core funnel types
│   ├── funnel-analytics.types.ts        # Analytics types
│   └── funnel-attribution.types.ts      # Attribution types
└── utils/
    ├── funnel-matching.utils.ts         # Step matching logic
    ├── funnel-calculation.utils.ts      # Calculation utilities
    └── funnel-validation.utils.ts       # Validation helpers
```

### Data Flow Architecture

```
Event Ingestion → Event Matching → Funnel State Update → Analytics Aggregation
      │                │                   │                      │
      │                ▼                   ▼                      ▼
      │         ┌─────────────┐   ┌─────────────┐      ┌─────────────┐
      │         │ Step Match  │   │ User State  │      │ Metrics     │
      │         │ Engine      │   │ Cache       │      │ Cache       │
      │         └─────────────┘   └─────────────┘      └─────────────┘
      │                │                   │                      │
      ▼                ▼                   ▼                      ▼
┌─────────────┐ ┌─────────────┐   ┌─────────────┐      ┌─────────────┐
│ Raw Events  │ │ Funnel      │   │ User        │      │ Aggregated  │
│ Storage     │ │ Progression │   │ Journey     │      │ Analytics   │
│ (Event      │ │ Tracking    │   │ State       │      │ Results     │
│ Table)      │ │             │   │             │      │             │
└─────────────┘ └─────────────┘   └─────────────┘      └─────────────┘
```

## Technical Specifications

### Database Schema Extensions

#### Performance Indexes

```sql
-- Funnel analytics performance indexes
CREATE INDEX CONCURRENTLY idx_funnel_tenant_workspace_created 
ON funnel (tenant_id, workspace_id, created_at) WHERE archived_at IS NULL;

CREATE INDEX CONCURRENTLY idx_funnel_version_active 
ON funnel_version (funnel_id, state, created_at) WHERE state = 'published';

CREATE INDEX CONCURRENTLY idx_funnel_publication_active 
ON funnel_publication (funnel_id, published_at DESC);

-- Event matching performance indexes  
CREATE INDEX CONCURRENTLY idx_event_funnel_matching 
ON event (tenant_id, workspace_id, event_name, timestamp) 
INCLUDE (anonymous_id, lead_id, session_id, page, props);

CREATE INDEX CONCURRENTLY idx_event_user_journey 
ON event (tenant_id, workspace_id, anonymous_id, timestamp)
INCLUDE (event_name, lead_id, session_id, page, utm, device, geo);

CREATE INDEX CONCURRENTLY idx_event_session_progression 
ON event (tenant_id, workspace_id, session_id, timestamp)
INCLUDE (event_name, anonymous_id, lead_id, page, props);

-- Identity linking for funnel attribution
CREATE INDEX CONCURRENTLY idx_identity_link_funnel_attribution 
ON identity_link (tenant_id, workspace_id, lead_id, first_at, last_at)
INCLUDE (anonymous_id);
```

#### Materialized Views for Performance

```sql
-- Funnel step completion aggregations
CREATE MATERIALIZED VIEW funnel_step_completions AS
SELECT 
  f.tenant_id,
  f.workspace_id,
  f.id as funnel_id,
  fv.id as funnel_version_id,
  fs.id as step_id,
  fs.order_index,
  DATE_TRUNC('day', e.timestamp) as completion_date,
  COUNT(DISTINCT e.anonymous_id) as unique_completions,
  COUNT(DISTINCT e.lead_id) as identified_completions,
  COUNT(DISTINCT e.session_id) as session_completions
FROM funnel f
JOIN funnel_version fv ON f.id = fv.funnel_id AND fv.state = 'published'
JOIN funnel_step fs ON fv.id = fs.funnel_version_id
JOIN funnel_step_match fsm ON fs.id = fsm.funnel_step_id
JOIN event e ON (
  (fsm.kind = 'event' AND e.event_name = (fsm.rules->>'event_name')) OR
  (fsm.kind = 'page' AND e.page->>'url' ~ (fsm.rules->>'url_pattern'))
) AND e.tenant_id = f.tenant_id AND e.workspace_id = f.workspace_id
GROUP BY f.tenant_id, f.workspace_id, f.id, fv.id, fs.id, fs.order_index, DATE_TRUNC('day', e.timestamp);

-- Refresh strategy
CREATE INDEX ON funnel_step_completions (tenant_id, workspace_id, funnel_id, completion_date);
```

#### User Journey State Table

```sql
-- New table for tracking user funnel progression state
CREATE TABLE funnel_user_state (
  tenant_id BIGINT NOT NULL,
  workspace_id BIGINT NOT NULL,
  funnel_id BIGINT NOT NULL,
  funnel_version_id BIGINT NOT NULL,
  anonymous_id VARCHAR(50) NOT NULL,
  lead_id BIGINT,
  current_step_index INTEGER NOT NULL DEFAULT 0,
  completed_steps INTEGER[] DEFAULT '{}',
  first_step_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_step_at TIMESTAMP WITH TIME ZONE NOT NULL,
  conversion_completed_at TIMESTAMP WITH TIME ZONE,
  session_id VARCHAR(50),
  entry_utm JSONB,
  entry_device JSONB,
  entry_geo JSONB,
  total_events INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (tenant_id, workspace_id, funnel_id, funnel_version_id, anonymous_id),
  
  FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (funnel_id) REFERENCES funnel(id) ON DELETE CASCADE,
  FOREIGN KEY (funnel_version_id) REFERENCES funnel_version(id) ON DELETE CASCADE,
  FOREIGN KEY (anonymous_id) REFERENCES visitor(anonymous_id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES lead(id) ON DELETE SET NULL
);

-- Performance indexes for user state
CREATE INDEX idx_funnel_user_state_progression 
ON funnel_user_state (tenant_id, workspace_id, funnel_id, current_step_index, last_step_at);

CREATE INDEX idx_funnel_user_state_conversion 
ON funnel_user_state (tenant_id, workspace_id, funnel_id, conversion_completed_at) 
WHERE conversion_completed_at IS NOT NULL;

CREATE INDEX idx_funnel_user_state_realtime 
ON funnel_user_state (tenant_id, workspace_id, updated_at DESC) 
WHERE updated_at > NOW() - INTERVAL '24 hours';
```

### API Endpoint Specifications

#### Funnel Configuration Endpoints

```typescript
// POST /v1/analytics/funnels
interface CreateFunnelRequest {
  name: string;
  description?: string;
  steps: FunnelStepConfig[];
  windowDays: number; // 1-90
  metadata?: Record<string, any>;
}

interface FunnelStepConfig {
  orderIndex: number;
  type: 'start' | 'page' | 'event' | 'decision' | 'conversion';
  label: string;
  matches: FunnelStepMatch[];
  metadata?: Record<string, any>;
}

interface FunnelStepMatch {
  kind: 'page' | 'event';
  rules: PageMatchRules | EventMatchRules;
}

interface PageMatchRules {
  urlPattern: string; // regex pattern
  urlOperator?: 'equals' | 'contains' | 'regex' | 'startsWith';
}

interface EventMatchRules {
  eventName: string;
  propertyFilters?: PropertyFilter[];
}

interface PropertyFilter {
  property: string;
  operator: 'equals' | 'contains' | 'regex' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn';
  value: string | number | boolean | (string | number)[];
}
```

#### Analytics Endpoints Response Types

```typescript
// GET /v1/analytics/funnels/:id/conversion
interface FunnelConversionResponse {
  funnelId: string;
  funnelName: string;
  version: number;
  period: PeriodInfo;
  overallConversionRate: number;
  totalUsers: number;
  convertedUsers: number;
  steps: FunnelStepConversion[];
  segments: ConversionBySegment[];
  trends: ConversionTrend[];
  statisticalSignificance?: SignificanceTest;
}

interface FunnelStepConversion {
  stepIndex: number;
  stepLabel: string;
  stepType: string;
  users: number;
  conversionRate: number;
  dropoffRate: number;
  avgTimeFromPrevious: number; // seconds
  medianTimeFromPrevious: number;
  percentiles: {
    p25: number;
    p75: number;
    p90: number;
    p95: number;
  };
}

interface ConversionBySegment {
  segmentType: 'device' | 'traffic_source' | 'user_type' | 'custom';
  segmentValue: string;
  totalUsers: number;
  convertedUsers: number;
  conversionRate: number;
  significance: number; // vs overall rate
}

// GET /v1/analytics/funnels/:id/dropoff
interface FunnelDropoffResponse {
  funnelId: string;
  period: PeriodInfo;
  overallDropoffRate: number;
  steps: DropoffStepAnalysis[];
  criticalDropoffPoints: CriticalDropoffPoint[];
  dropoffTrends: DropoffTrend[];
  segmentAnalysis: DropoffBySegment[];
}

interface DropoffStepAnalysis {
  stepIndex: number;
  stepLabel: string;
  entryUsers: number;
  exitUsers: number;
  continuedUsers: number;
  dropoffRate: number;
  dropoffRank: number; // ranked by severity
  avgTimeOnStep: number;
  bounceRate: number; // immediate exit
}

interface CriticalDropoffPoint {
  stepIndex: number;
  stepLabel: string;
  dropoffRate: number;
  expectedRate: number; // based on historical data
  severity: 'critical' | 'warning' | 'normal';
  recommendation: string;
  impactScore: number; // 0-100
}

// GET /v1/analytics/funnels/:id/cohorts
interface FunnelCohortResponse {
  funnelId: string;
  period: PeriodInfo;
  cohortDefinition: CohortDefinition;
  cohorts: CohortAnalysis[];
  averageConversionRate: number;
  cohortTrends: CohortTrend[];
}

interface CohortDefinition {
  groupBy: 'entry_date' | 'entry_week' | 'entry_month' | 'custom';
  customCriteria?: PropertyFilter[];
}

interface CohortAnalysis {
  cohortId: string;
  cohortLabel: string;
  entryPeriod: string; // ISO date
  totalUsers: number;
  stepProgression: CohortStepProgression[];
  conversionRate: number;
  avgTimeToConversion: number;
  retentionRate: number;
}

interface CohortStepProgression {
  stepIndex: number;
  usersReached: number;
  conversionRate: number;
  daysFromEntry: number[];
}

// GET /v1/analytics/funnels/:id/segments  
interface FunnelSegmentResponse {
  funnelId: string;
  period: PeriodInfo;
  segments: SegmentAnalysis[];
  comparisons: SegmentComparison[];
  recommendations: SegmentRecommendation[];
}

interface SegmentAnalysis {
  segmentType: 'device' | 'traffic_source' | 'geo' | 'user_type' | 'custom';
  segmentValue: string;
  totalUsers: number;
  conversionRate: number;
  avgTimeToConversion: number;
  steps: SegmentStepPerformance[];
  value: number; // business impact score
}

interface SegmentStepPerformance {
  stepIndex: number;
  users: number;
  conversionRate: number;
  avgTimeOnStep: number;
  relativePerformance: number; // vs overall
}

// GET /v1/analytics/funnels/:id/timing
interface FunnelTimingResponse {
  funnelId: string;
  period: PeriodInfo;
  overallTimingMetrics: TimingMetrics;
  stepTimings: StepTiming[];
  conversionVelocity: VelocityAnalysis;
  bottlenecks: TimingBottleneck[];
}

interface TimingMetrics {
  avgTimeToConversion: number; // seconds
  medianTimeToConversion: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  fastestConversion: number;
  slowestConversion: number;
}

interface StepTiming {
  stepIndex: number;
  stepLabel: string;
  avgDwellTime: number;
  medianDwellTime: number;
  avgTimeFromStart: number;
  conversionTimeDistribution: TimeDistribution[];
}

interface VelocityAnalysis {
  velocityTrend: VelocityTrend[];
  fastTrackUsers: VelocitySegment;
  slowTrackUsers: VelocitySegment;
  optimalPath: OptimalPathAnalysis;
}
```

#### Real-time Tracking Endpoints

```typescript
// GET /v1/analytics/funnels/:id/live
interface FunnelLiveMetricsResponse {
  funnelId: string;
  timestamp: string;
  liveMetrics: LiveMetric[];
  activeUsers: ActiveUserMetrics;
  recentConversions: RecentConversion[];
  alertStatus: AlertStatus[];
}

interface LiveMetric {
  metric: 'conversion_rate' | 'active_users' | 'step_completions' | 'dropoff_rate';
  value: number;
  change: number; // vs previous period
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

interface ActiveUserMetrics {
  totalActiveUsers: number;
  usersByStep: StepActiveUsers[];
  avgSessionDuration: number;
  newUsersInFunnel: number;
}

// GET /v1/analytics/funnels/:id/users/:userId
interface FunnelUserProgressionResponse {
  funnelId: string;
  userId: string; // anonymous_id or lead_id
  userType: 'anonymous' | 'identified';
  currentStep: number;
  completedSteps: number[];
  progression: UserProgressionEvent[];
  conversionStatus: 'in_progress' | 'converted' | 'dropped_off';
  timeInFunnel: number; // seconds
  predictedConversionProbability?: number;
}

interface UserProgressionEvent {
  stepIndex: number;
  stepLabel: string;
  completedAt: string;
  timeFromPrevious: number;
  sessionId: string;
  eventDetails: EventDetail[];
}

// GET /v1/analytics/funnels/:id/bottlenecks
interface FunnelBottleneckResponse {
  funnelId: string;
  detectionTimestamp: string;
  bottlenecks: BottleneckAnalysis[];
  recommendations: BottleneckRecommendation[];
  historicalComparison: HistoricalBottleneckComparison;
}

interface BottleneckAnalysis {
  stepIndex: number;
  stepLabel: string;
  severity: 'critical' | 'major' | 'minor';
  currentDropoffRate: number;
  expectedDropoffRate: number;
  impact: number; // users affected
  duration: number; // how long this has been occurring
  possibleCauses: string[];
}
```

### Query Optimization Strategies

#### Intelligent Query Planning

```typescript
// Query optimization service
export class FunnelQueryOptimizer {
  
  /**
   * Optimize funnel conversion queries based on data volume and complexity
   */
  optimizeConversionQuery(params: FunnelQueryParams): OptimizedQuery {
    const strategy = this.determineQueryStrategy(params);
    
    switch (strategy) {
      case 'materialized_view':
        return this.buildMaterializedViewQuery(params);
      case 'window_function':
        return this.buildWindowFunctionQuery(params);
      case 'cte_recursive':
        return this.buildRecursiveCTEQuery(params);
      case 'partition_parallel':
        return this.buildPartitionedQuery(params);
      default:
        return this.buildStandardQuery(params);
    }
  }

  private determineQueryStrategy(params: FunnelQueryParams): QueryStrategy {
    const { period, userCount, stepCount, segmentCount } = this.estimateQueryComplexity(params);
    
    // Use materialized views for popular, stable queries
    if (this.isPopularQuery(params) && period > 7) {
      return 'materialized_view';
    }
    
    // Use window functions for cohort and time-series analysis
    if (params.analysisType === 'cohort' || params.analysisType === 'timing') {
      return 'window_function';
    }
    
    // Use recursive CTEs for complex user journey analysis
    if (stepCount > 5 && params.includeUserJourneys) {
      return 'cte_recursive';
    }
    
    // Use partitioned queries for large datasets
    if (userCount > 1000000) {
      return 'partition_parallel';
    }
    
    return 'standard';
  }

  /**
   * Build materialized view query for common funnel metrics
   */
  private buildMaterializedViewQuery(params: FunnelQueryParams): OptimizedQuery {
    return {
      sql: `
        SELECT 
          step_index,
          SUM(unique_completions) as total_users,
          AVG(unique_completions / LAG(unique_completions) OVER (ORDER BY step_index)) as conversion_rate
        FROM funnel_step_completions 
        WHERE tenant_id = $1 AND workspace_id = $2 AND funnel_id = $3
          AND completion_date BETWEEN $4 AND $5
        GROUP BY step_index
        ORDER BY step_index
      `,
      params: [params.tenantId, params.workspaceId, params.funnelId, params.startDate, params.endDate],
      estimatedCost: 'low',
      cacheability: 'high'
    };
  }

  /**
   * Build window function query for advanced analytics
   */
  private buildWindowFunctionQuery(params: FunnelQueryParams): OptimizedQuery {
    return {
      sql: `
        WITH user_step_completion AS (
          SELECT 
            anonymous_id,
            step_index,
            completion_time,
            LAG(completion_time) OVER (PARTITION BY anonymous_id ORDER BY step_index) as prev_completion,
            LEAD(step_index) OVER (PARTITION BY anonymous_id ORDER BY step_index) as next_step
          FROM funnel_user_progressions
          WHERE tenant_id = $1 AND workspace_id = $2 AND funnel_id = $3
            AND completion_time BETWEEN $4 AND $5
        ),
        conversion_metrics AS (
          SELECT 
            step_index,
            COUNT(DISTINCT anonymous_id) as users_at_step,
            COUNT(DISTINCT CASE WHEN next_step IS NOT NULL THEN anonymous_id END) as users_continuing,
            AVG(EXTRACT(EPOCH FROM (completion_time - prev_completion))) as avg_time_from_previous
          FROM user_step_completion
          GROUP BY step_index
        )
        SELECT 
          step_index,
          users_at_step,
          users_continuing,
          COALESCE(users_continuing::decimal / NULLIF(users_at_step, 0), 0) as step_conversion_rate,
          avg_time_from_previous
        FROM conversion_metrics
        ORDER BY step_index
      `,
      params: [params.tenantId, params.workspaceId, params.funnelId, params.startDate, params.endDate],
      estimatedCost: 'medium',
      cacheability: 'medium'
    };
  }
}
```

#### Index Optimization Strategies

```sql
-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_funnel_analytics_composite_1 
ON event (tenant_id, workspace_id, timestamp) 
INCLUDE (anonymous_id, event_name, page, session_id)
WHERE timestamp > NOW() - INTERVAL '90 days';

-- Partial indexes for active funnels
CREATE INDEX CONCURRENTLY idx_active_funnel_versions 
ON funnel_version (funnel_id, version DESC) 
WHERE state = 'published';

-- Covering indexes for user journey queries
CREATE INDEX CONCURRENTLY idx_event_user_journey_covering 
ON event (tenant_id, workspace_id, anonymous_id, timestamp) 
INCLUDE (event_name, lead_id, session_id, page, utm, device, props);

-- BRIN indexes for time-series data
CREATE INDEX CONCURRENTLY idx_event_timestamp_brin 
ON event USING brin (timestamp) WITH (pages_per_range = 128);
```

### Caching Strategy

#### Funnel-Specific Cache Architecture

```typescript
export class FunnelCacheService extends AnalyticsCacheService {
  private readonly funnelCachePrefix = 'funnel-analytics';
  
  /**
   * Funnel-specific cache TTL strategy
   */
  getFunnelCacheTTL(
    queryType: FunnelQueryType, 
    period: PeriodType,
    realTimeMode: boolean = false
  ): number {
    
    if (realTimeMode) {
      return 30 * 1000; // 30 seconds for real-time data
    }
    
    const baseTTLs: Record<FunnelQueryType, number> = {
      'configuration': 60 * 60 * 1000,      // 1 hour - stable data
      'conversion': 15 * 60 * 1000,         // 15 minutes - semi-stable
      'dropoff': 10 * 60 * 1000,            // 10 minutes - analysis data
      'cohort': 30 * 60 * 1000,             // 30 minutes - historical analysis
      'segment': 20 * 60 * 1000,            // 20 minutes - segment data
      'timing': 5 * 60 * 1000,              // 5 minutes - timing sensitive
      'live': 30 * 1000,                    // 30 seconds - real-time
      'bottleneck': 2 * 60 * 1000,          // 2 minutes - critical alerts
      'attribution': 60 * 60 * 1000,        // 1 hour - attribution models
    };
    
    const periodMultipliers: Record<PeriodType, number> = {
      '24h': 0.5,    // Shorter cache for recent data
      '7d': 1.0,     // Standard cache duration
      '30d': 2.0,    // Longer cache for historical data
      'custom': 1.5, // Custom ranges get moderate caching
    };
    
    const baseTTL = baseTTLs[queryType] || baseTTLs['conversion'];
    const multiplier = periodMultipliers[period] || 1.0;
    
    return Math.floor(baseTTL * multiplier);
  }

  /**
   * Smart cache invalidation for funnel data
   */
  async invalidateFunnelCache(
    tenantId: string, 
    workspaceId: string, 
    funnelId: string,
    changeType: 'configuration' | 'data' | 'publication'
  ): Promise<void> {
    
    const invalidationPatterns = this.getInvalidationPatterns(
      tenantId, 
      workspaceId, 
      funnelId, 
      changeType
    );
    
    const invalidationPromises = invalidationPatterns.map(pattern => 
      this.invalidatePattern(pattern)
    );
    
    await Promise.all(invalidationPromises);
    
    this.logger.log('Funnel cache invalidated', {
      tenantId,
      workspaceId,
      funnelId,
      changeType,
      patternsCount: invalidationPatterns.length
    });
  }

  private getInvalidationPatterns(
    tenantId: string,
    workspaceId: string,
    funnelId: string,
    changeType: string
  ): string[] {
    const basePattern = `${this.funnelCachePrefix}:${tenantId}:${workspaceId}`;
    
    switch (changeType) {
      case 'configuration':
        return [
          `${basePattern}:${funnelId}:*`,           // All funnel data
          `${basePattern}:list:*`,                  // Funnel lists
          `${basePattern}:config:${funnelId}:*`,    // Configuration data
        ];
        
      case 'data':
        return [
          `${basePattern}:${funnelId}:conversion:*`,
          `${basePattern}:${funnelId}:dropoff:*`,
          `${basePattern}:${funnelId}:timing:*`,
          `${basePattern}:${funnelId}:live:*`,
        ];
        
      case 'publication':
        return [
          `${basePattern}:${funnelId}:*`,           // All funnel analytics
        ];
        
      default:
        return [`${basePattern}:${funnelId}:*`];
    }
  }

  /**
   * Preload critical funnel data
   */
  async warmFunnelCache(
    tenantId: string,
    workspaceId: string,
    funnelId: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<void> {
    
    const warmingQueries = this.getFunnelWarmingQueries(funnelId, priority);
    
    const warmingPromises = warmingQueries.map(async (query) => {
      try {
        const cacheKey = this.buildFunnelCacheKey(
          tenantId, 
          workspaceId, 
          query.endpoint, 
          query.params
        );
        
        const existing = await this.get(cacheKey);
        if (!existing) {
          // Mark for background loading
          await this.scheduleBackgroundLoad(cacheKey, query);
        }
      } catch (error) {
        this.logger.warn('Cache warming failed', { 
          funnelId, 
          query: query.endpoint, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    await Promise.allSettled(warmingPromises);
  }

  private getFunnelWarmingQueries(funnelId: string, priority: string) {
    const baseQueries = [
      { endpoint: 'conversion', params: { period: '7d', funnelId } },
      { endpoint: 'conversion', params: { period: '30d', funnelId } },
    ];

    if (priority === 'high') {
      return [
        ...baseQueries,
        { endpoint: 'dropoff', params: { period: '7d', funnelId } },
        { endpoint: 'live', params: { funnelId } },
        { endpoint: 'bottleneck', params: { funnelId } },
      ];
    }

    return baseQueries;
  }
}
```

### Real-time Processing Pipeline

#### Event Stream Processing Architecture

```typescript
export class FunnelRealtimeService {
  
  /**
   * Process incoming events for funnel progression
   */
  async processEventForFunnels(event: EventData): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. Find active funnels for this workspace
      const activeFunnels = await this.getActiveFunnels(
        event.tenantId, 
        event.workspaceId
      );
      
      // 2. Process event against each active funnel
      const processingPromises = activeFunnels.map(funnel =>
        this.processEventForFunnel(event, funnel)
      );
      
      await Promise.all(processingPromises);
      
      // 3. Update real-time metrics
      await this.updateRealtimeMetrics(event.tenantId, event.workspaceId);
      
      this.logger.debug('Event processed for funnels', {
        eventId: event.eventId,
        funnelCount: activeFunnels.length,
        processingTime: Date.now() - startTime,
      });
      
    } catch (error) {
      this.logger.error('Failed to process event for funnels', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      });
    }
  }

  /**
   * Process event against a specific funnel
   */
  private async processEventForFunnel(
    event: EventData, 
    funnel: FunnelConfig
  ): Promise<void> {
    
    // 1. Check if event matches any funnel steps
    const matchedSteps = await this.findMatchingSteps(event, funnel);
    
    if (matchedSteps.length === 0) {
      return;
    }
    
    // 2. Get or create user state for this funnel
    const userState = await this.getUserFunnelState(
      event.tenantId,
      event.workspaceId,
      funnel.id,
      event.anonymousId,
      event.leadId
    );
    
    // 3. Update user progression
    const progressionUpdate = await this.updateUserProgression(
      userState,
      matchedSteps,
      event
    );
    
    // 4. Check for conversion completion
    if (progressionUpdate.conversionCompleted) {
      await this.handleConversionCompletion(
        userState,
        funnel,
        event,
        progressionUpdate
      );
    }
    
    // 5. Update aggregated metrics
    await this.updateFunnelAggregates(
      funnel.id,
      progressionUpdate,
      event
    );
  }

  /**
   * Find steps that match the incoming event
   */
  private async findMatchingSteps(
    event: EventData, 
    funnel: FunnelConfig
  ): Promise<FunnelStepMatch[]> {
    
    const matchedSteps: FunnelStepMatch[] = [];
    
    for (const step of funnel.steps) {
      for (const match of step.matches) {
        if (await this.evaluateStepMatch(event, match)) {
          matchedSteps.push({
            stepIndex: step.orderIndex,
            stepId: step.id,
            matchRule: match,
            confidence: this.calculateMatchConfidence(event, match),
          });
        }
      }
    }
    
    return matchedSteps.sort((a, b) => a.stepIndex - b.stepIndex);
  }

  /**
   * Evaluate if an event matches a step rule
   */
  private async evaluateStepMatch(
    event: EventData, 
    match: FunnelStepMatchRule
  ): Promise<boolean> {
    
    switch (match.kind) {
      case 'event':
        return this.evaluateEventMatch(event, match.rules as EventMatchRules);
        
      case 'page':
        return this.evaluatePageMatch(event, match.rules as PageMatchRules);
        
      default:
        return false;
    }
  }

  private evaluateEventMatch(
    event: EventData, 
    rules: EventMatchRules
  ): boolean {
    
    // Check event name match
    if (event.eventName !== rules.eventName) {
      return false;
    }
    
    // Check property filters
    if (rules.propertyFilters) {
      return this.evaluatePropertyFilters(event.props || {}, rules.propertyFilters);
    }
    
    return true;
  }

  private evaluatePageMatch(
    event: EventData, 
    rules: PageMatchRules
  ): boolean {
    
    const pageUrl = event.page?.url;
    if (!pageUrl) {
      return false;
    }
    
    switch (rules.urlOperator || 'equals') {
      case 'equals':
        return pageUrl === rules.urlPattern;
        
      case 'contains':
        return pageUrl.includes(rules.urlPattern);
        
      case 'startsWith':
        return pageUrl.startsWith(rules.urlPattern);
        
      case 'regex':
        const regex = new RegExp(rules.urlPattern);
        return regex.test(pageUrl);
        
      default:
        return false;
    }
  }

  /**
   * State management for user funnel progression
   */
  private async getUserFunnelState(
    tenantId: string,
    workspaceId: string,
    funnelId: string,
    anonymousId: string,
    leadId?: string
  ): Promise<FunnelUserState> {
    
    const cacheKey = `funnel-state:${tenantId}:${workspaceId}:${funnelId}:${anonymousId}`;
    
    // Try cache first
    let userState = await this.cacheService.get<FunnelUserState>(cacheKey);
    
    if (!userState) {
      // Load from database
      userState = await this.funnelRepository.getUserState(
        tenantId,
        workspaceId,
        funnelId,
        anonymousId
      );
      
      if (!userState) {
        // Create new user state
        userState = await this.createUserFunnelState(
          tenantId,
          workspaceId,
          funnelId,
          anonymousId,
          leadId
        );
      }
      
      // Cache for fast access
      await this.cacheService.set(
        cacheKey,
        userState,
        5 * 60 * 1000 // 5 minutes
      );
    }
    
    return userState;
  }

  /**
   * Update user progression through funnel steps
   */
  private async updateUserProgression(
    userState: FunnelUserState,
    matchedSteps: FunnelStepMatch[],
    event: EventData
  ): Promise<ProgressionUpdate> {
    
    const update: ProgressionUpdate = {
      stepsCompleted: [],
      newStepsUnlocked: [],
      conversionCompleted: false,
      progressionEvents: [],
    };
    
    for (const matchedStep of matchedSteps) {
      // Check if step is next in sequence or allows out-of-order completion
      const canComplete = this.canCompleteStep(userState, matchedStep);
      
      if (canComplete && !userState.completedSteps.includes(matchedStep.stepIndex)) {
        // Mark step as completed
        userState.completedSteps.push(matchedStep.stepIndex);
        userState.currentStepIndex = Math.max(userState.currentStepIndex, matchedStep.stepIndex);
        userState.lastStepAt = event.timestamp;
        userState.totalEvents++;
        
        update.stepsCompleted.push(matchedStep.stepIndex);
        update.progressionEvents.push({
          stepIndex: matchedStep.stepIndex,
          completedAt: event.timestamp,
          eventId: event.eventId,
          sessionId: event.sessionId,
        });
        
        // Check if this completes the funnel
        if (this.isFinalStep(matchedStep.stepIndex, userState.funnelConfig)) {
          userState.conversionCompletedAt = event.timestamp;
          update.conversionCompleted = true;
        }
      }
    }
    
    // Save updated state
    await this.saveFunnelUserState(userState);
    
    return update;
  }

  /**
   * Handle conversion completion
   */
  private async handleConversionCompletion(
    userState: FunnelUserState,
    funnel: FunnelConfig,
    event: EventData,
    update: ProgressionUpdate
  ): Promise<void> {
    
    // 1. Record conversion event
    await this.recordConversionEvent(userState, funnel, event);
    
    // 2. Update real-time conversion metrics
    await this.updateConversionMetrics(funnel.id, userState);
    
    // 3. Trigger conversion webhooks/notifications
    await this.triggerConversionNotifications(userState, funnel, event);
    
    // 4. Update attribution models
    await this.updateAttributionData(userState, event);
    
    this.logger.log('Funnel conversion completed', {
      funnelId: funnel.id,
      userId: userState.anonymousId,
      conversionTime: event.timestamp,
      totalTimeInFunnel: Date.now() - new Date(userState.firstStepAt).getTime(),
      stepsCompleted: userState.completedSteps.length,
    });
  }
}
```

### Performance Optimization

#### Query Performance Strategies

```typescript
export class FunnelPerformanceOptimizer {
  
  /**
   * Optimize conversion rate calculations
   */
  async optimizeConversionCalculation(params: ConversionQueryParams): Promise<QueryPlan> {
    const complexity = await this.analyzeQueryComplexity(params);
    
    if (complexity.estimatedRows > 10_000_000) {
      return this.buildSamplingStrategy(params, complexity);
    }
    
    if (complexity.timeRange > 365) {
      return this.buildPartitionStrategy(params);
    }
    
    if (complexity.stepCount > 10) {
      return this.buildIncrementalStrategy(params);
    }
    
    return this.buildStandardStrategy(params);
  }

  /**
   * Statistical sampling for large datasets
   */
  private buildSamplingStrategy(
    params: ConversionQueryParams,
    complexity: QueryComplexity
  ): QueryPlan {
    
    const sampleRate = this.calculateOptimalSampleRate(complexity);
    
    return {
      strategy: 'sampling',
      sampleRate,
      confidenceInterval: this.calculateConfidenceInterval(sampleRate),
      query: this.buildSampledQuery(params, sampleRate),
      estimatedDuration: complexity.estimatedDuration * sampleRate,
      cacheability: 'medium'
    };
  }

  /**
   * Parallel processing for time-partitioned data
   */
  private buildPartitionStrategy(params: ConversionQueryParams): QueryPlan {
    const timePartitions = this.generateTimePartitions(
      params.startDate,
      params.endDate,
      'monthly'
    );
    
    return {
      strategy: 'parallel_partition',
      partitions: timePartitions,
      query: this.buildPartitionedQuery(params, timePartitions),
      aggregationMethod: 'sum_merge',
      estimatedDuration: Math.max(...timePartitions.map(p => p.estimatedDuration)),
      cacheability: 'high'
    };
  }

  /**
   * Incremental calculation for complex funnels
   */
  private buildIncrementalStrategy(params: ConversionQueryParams): QueryPlan {
    return {
      strategy: 'incremental',
      steps: this.buildIncrementalSteps(params),
      checkpoints: this.generateCheckpoints(params.funnelId),
      query: this.buildIncrementalQuery(params),
      estimatedDuration: this.estimateIncrementalDuration(params),
      cacheability: 'low'
    };
  }
}
```

#### Database Connection and Resource Management

```typescript
export class FunnelResourceManager {
  
  /**
   * Manage database connection pooling for funnel queries
   */
  async executeOptimizedQuery<T>(
    query: OptimizedQuery,
    priority: QueryPriority = 'medium'
  ): Promise<T> {
    
    const pool = this.getOptimalConnectionPool(query.estimatedCost, priority);
    const timeout = this.calculateQueryTimeout(query.estimatedCost, priority);
    
    const startTime = Date.now();
    
    try {
      const result = await pool.query({
        text: query.sql,
        values: query.params,
        timeout,
      });
      
      const duration = Date.now() - startTime;
      
      // Record performance metrics
      await this.recordQueryMetrics({
        queryType: query.type,
        duration,
        estimatedCost: query.estimatedCost,
        actualRows: result.rows.length,
        cacheHit: false,
      });
      
      return result.rows;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await this.recordQueryError({
        queryType: query.type,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        estimatedCost: query.estimatedCost,
      });
      
      throw error;
    }
  }

  private getOptimalConnectionPool(
    estimatedCost: QueryCost,
    priority: QueryPriority
  ): ConnectionPool {
    
    if (estimatedCost === 'high' || priority === 'low') {
      return this.analyticsPool; // Dedicated pool for heavy queries
    }
    
    if (priority === 'critical') {
      return this.priorityPool; // High-priority pool
    }
    
    return this.standardPool; // Standard application pool
  }

  private calculateQueryTimeout(
    estimatedCost: QueryCost,
    priority: QueryPriority
  ): number {
    
    const baseTimeouts = {
      low: 5000,      // 5 seconds
      medium: 15000,  // 15 seconds
      high: 60000,    // 60 seconds
    };
    
    const priorityMultipliers = {
      critical: 2.0,  // Allow more time for critical queries
      high: 1.5,
      medium: 1.0,
      low: 0.8,       // Shorter timeouts for low priority
    };
    
    const baseTimeout = baseTimeouts[estimatedCost] || baseTimeouts.medium;
    const multiplier = priorityMultipliers[priority] || 1.0;
    
    return Math.floor(baseTimeout * multiplier);
  }
}
```

### Error Handling and Monitoring

#### Comprehensive Error Handling

```typescript
export class FunnelErrorHandler {
  
  /**
   * Handle funnel-specific errors with appropriate responses
   */
  handleFunnelError(error: unknown, context: FunnelOperationContext): FunnelError {
    
    if (error instanceof PrismaClientKnownRequestError) {
      return this.handleDatabaseError(error, context);
    }
    
    if (error instanceof FunnelValidationError) {
      return this.handleValidationError(error, context);
    }
    
    if (error instanceof FunnelCalculationError) {
      return this.handleCalculationError(error, context);
    }
    
    if (error instanceof CacheError) {
      return this.handleCacheError(error, context);
    }
    
    return this.handleUnknownError(error, context);
  }

  private handleDatabaseError(
    error: PrismaClientKnownRequestError,
    context: FunnelOperationContext
  ): FunnelError {
    
    switch (error.code) {
      case 'P2002':
        return new FunnelDuplicateError('Funnel configuration already exists', {
          field: error.meta?.target,
          context,
        });
        
      case 'P2025':
        return new FunnelNotFoundError('Funnel or related entity not found', {
          model: error.meta?.cause,
          context,
        });
        
      case 'P2034':
        return new FunnelTransactionError('Database transaction failed', {
          cause: error.message,
          context,
        });
        
      default:
        return new FunnelDatabaseError('Database operation failed', {
          code: error.code,
          message: error.message,
          context,
        });
    }
  }

  private handleValidationError(
    error: FunnelValidationError,
    context: FunnelOperationContext
  ): FunnelError {
    
    return new FunnelValidationError(error.message, {
      validationErrors: error.validationErrors,
      field: error.field,
      context,
    });
  }

  private handleCalculationError(
    error: FunnelCalculationError,
    context: FunnelOperationContext
  ): FunnelError {
    
    // Log calculation errors for debugging
    this.logger.error('Funnel calculation failed', {
      funnelId: context.funnelId,
      operation: context.operation,
      error: error.message,
      calculationType: error.calculationType,
      parameters: error.parameters,
    });
    
    return new FunnelCalculationError('Calculation failed', {
      calculationType: error.calculationType,
      parameters: error.parameters,
      context,
    });
  }
}

// Custom error classes
export class FunnelError extends Error {
  constructor(
    message: string,
    public readonly details: {
      context: FunnelOperationContext;
      [key: string]: any;
    }
  ) {
    super(message);
    this.name = 'FunnelError';
  }
}

export class FunnelValidationError extends FunnelError {
  constructor(
    message: string,
    details: {
      validationErrors?: any[];
      field?: string;
      context: FunnelOperationContext;
    }
  ) {
    super(message, details);
    this.name = 'FunnelValidationError';
  }
}

export class FunnelCalculationError extends FunnelError {
  constructor(
    message: string,
    public readonly details: {
      calculationType: string;
      parameters: any;
      context: FunnelOperationContext;
    }
  ) {
    super(message, details);
    this.name = 'FunnelCalculationError';
  }
}
```

#### Monitoring and Observability

```typescript
export class FunnelMonitoringService {
  
  /**
   * Record funnel operation metrics
   */
  async recordFunnelMetrics(metrics: FunnelMetrics): Promise<void> {
    
    // Record response time metrics
    this.metricsService.recordHistogram('funnel_operation_duration', {
      operation: metrics.operation,
      funnel_id: metrics.funnelId,
      tenant_id: metrics.tenantId,
    }, metrics.duration);
    
    // Record query complexity metrics
    this.metricsService.recordGauge('funnel_query_complexity', {
      operation: metrics.operation,
      estimated_cost: metrics.estimatedCost,
    }, metrics.complexityScore);
    
    // Record cache performance
    if (metrics.cacheHit !== undefined) {
      this.metricsService.recordCounter('funnel_cache_operations', {
        operation: metrics.operation,
        result: metrics.cacheHit ? 'hit' : 'miss',
      });
    }
    
    // Record business metrics
    if (metrics.conversionRate !== undefined) {
      this.metricsService.recordGauge('funnel_conversion_rate', {
        funnel_id: metrics.funnelId,
        tenant_id: metrics.tenantId,
      }, metrics.conversionRate);
    }
  }

  /**
   * Monitor funnel health and performance
   */
  async monitorFunnelHealth(
    tenantId: string,
    workspaceId: string,
    funnelId: string
  ): Promise<FunnelHealthStatus> {
    
    const healthChecks = await Promise.allSettled([
      this.checkQueryPerformance(tenantId, workspaceId, funnelId),
      this.checkDataQuality(tenantId, workspaceId, funnelId),
      this.checkCacheHealth(tenantId, workspaceId, funnelId),
      this.checkRealtimeProcessing(tenantId, workspaceId, funnelId),
    ]);
    
    return this.aggregateHealthStatus(healthChecks);
  }

  private async checkQueryPerformance(
    tenantId: string,
    workspaceId: string,
    funnelId: string
  ): Promise<HealthCheck> {
    
    const recentMetrics = await this.getRecentQueryMetrics(tenantId, workspaceId, funnelId);
    
    const avgDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
    const errorRate = recentMetrics.filter(m => m.error).length / recentMetrics.length;
    
    return {
      component: 'query_performance',
      status: this.evaluatePerformanceHealth(avgDuration, errorRate),
      metrics: {
        avg_duration: avgDuration,
        error_rate: errorRate,
        query_count: recentMetrics.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Set up automated alerts for funnel issues
   */
  setupFunnelAlerts(): void {
    
    // Alert on high error rates
    this.alertManager.createAlert({
      name: 'funnel_high_error_rate',
      condition: 'rate(funnel_operation_errors[5m]) > 0.05', // > 5% error rate
      severity: 'warning',
      description: 'Funnel operations experiencing high error rate',
      runbook: 'Check database connections and query performance',
    });
    
    // Alert on slow queries
    this.alertManager.createAlert({
      name: 'funnel_slow_queries',
      condition: 'histogram_quantile(0.95, funnel_operation_duration) > 5000', // > 5 seconds
      severity: 'warning',
      description: 'Funnel queries running slower than expected',
      runbook: 'Check database performance and consider query optimization',
    });
    
    // Alert on cache degradation
    this.alertManager.createAlert({
      name: 'funnel_cache_degradation',
      condition: 'rate(funnel_cache_operations{result="miss"}[10m]) > 0.8', // > 80% miss rate
      severity: 'info',
      description: 'Funnel cache hit rate degraded',
      runbook: 'Check cache configuration and warming strategies',
    });
    
    // Alert on conversion rate anomalies
    this.alertManager.createAlert({
      name: 'funnel_conversion_anomaly',
      condition: 'abs(funnel_conversion_rate - funnel_conversion_rate offset 7d) > 0.2', // 20% change
      severity: 'info',
      description: 'Significant change in funnel conversion rates detected',
      runbook: 'Investigate recent changes to funnel configuration or user behavior',
    });
  }
}
```

## Integration Points

### API Key Authentication Extension

```typescript
// Extended API key scopes for funnel operations
export const FunnelScopes = {
  FUNNELS_READ: 'funnels:read',
  FUNNELS_WRITE: 'funnels:write',
  FUNNELS_ADMIN: 'funnels:admin',
  FUNNELS_REALTIME: 'funnels:realtime',
  FUNNELS_EXPORT: 'funnels:export',
} as const;

// Scope validation middleware
export class FunnelAuthGuard extends ApiKeyGuard {
  
  protected async validateScope(
    requiredScope: string,
    userScopes: string[],
    context: ExecutionContext
  ): Promise<boolean> {
    
    const request = context.switchToHttp().getRequest();
    const { operation } = this.extractOperationInfo(request);
    
    // Map operations to required scopes
    const scopeMapping = {
      'create_funnel': FunnelScopes.FUNNELS_WRITE,
      'update_funnel': FunnelScopes.FUNNELS_WRITE,
      'delete_funnel': FunnelScopes.FUNNELS_ADMIN,
      'view_analytics': FunnelScopes.FUNNELS_READ,
      'export_data': FunnelScopes.FUNNELS_EXPORT,
      'realtime_data': FunnelScopes.FUNNELS_REALTIME,
    };
    
    const requiredScopeForOperation = scopeMapping[operation] || FunnelScopes.FUNNELS_READ;
    
    return userScopes.includes(requiredScopeForOperation) || 
           userScopes.includes(FunnelScopes.FUNNELS_ADMIN);
  }
}
```

### Event Processing Integration

```typescript
// Integration with existing event processing pipeline
export class FunnelEventProcessor {
  
  /**
   * Hook into existing event processing pipeline
   */
  async processIncomingEvent(event: IncomingEvent): Promise<void> {
    
    // 1. Process event through existing pipeline
    const processedEvent = await this.eventProcessor.process(event);
    
    // 2. Process event for funnel tracking
    await this.funnelRealtimeService.processEventForFunnels(processedEvent);
    
    // 3. Update funnel metrics asynchronously
    setImmediate(() => {
      this.updateFunnelMetricsAsync(processedEvent);
    });
  }

  private async updateFunnelMetricsAsync(event: ProcessedEvent): Promise<void> {
    try {
      await this.funnelAnalyticsService.updateEventMetrics(event);
    } catch (error) {
      this.logger.warn('Failed to update funnel metrics', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
- Set up FunnelAnalyticsModule structure
- Implement basic funnel configuration CRUD operations
- Create database indexes and materialized views
- Set up funnel-specific caching layer
- Unit tests for configuration management

### Phase 2: Core Analytics (Week 2)
- Implement conversion rate calculations
- Build drop-off analysis functionality  
- Create cohort analysis system
- Develop segment analysis capabilities
- Integration tests for analytics accuracy

### Phase 3: Real-time & Advanced Features (Week 3)
- Implement real-time event processing pipeline
- Build user progression tracking system
- Create bottleneck detection algorithms
- Develop multi-path funnel support
- Performance optimization and query tuning

### Phase 4: Advanced Analytics & Polish (Week 4)
- Implement attribution analysis features
- Build timing and velocity analytics
- Create export functionality
- Complete monitoring and alerting setup
- Final integration testing and documentation

## Risk Assessment & Mitigation

### High-Risk Items

**RISK-1: Database Performance Impact**
- **Risk**: Complex funnel calculations may overwhelm database with expensive queries
- **Impact**: System-wide performance degradation, timeout errors
- **Mitigation**: 
  - Implement query complexity analysis and automatic optimization
  - Use materialized views for common calculations
  - Set up separate connection pools for analytics queries
  - Implement query timeouts and circuit breakers

**RISK-2: Cache Invalidation Complexity**
- **Risk**: Complex funnel data relationships may cause cache inconsistencies
- **Impact**: Stale data in analytics, user confusion
- **Mitigation**:
  - Design granular cache invalidation patterns
  - Implement cache versioning and validation
  - Use cache warming for critical data
  - Monitor cache hit rates and data freshness

**RISK-3: Real-time Processing Latency**
- **Risk**: Real-time funnel tracking may introduce system latency
- **Impact**: Delayed analytics, poor user experience
- **Mitigation**:
  - Implement asynchronous processing with fallbacks
  - Use Redis for fast state management
  - Set up monitoring for processing delays
  - Design graceful degradation strategies

### Medium-Risk Items

**RISK-4: Memory Usage for Large Funnels**
- **Risk**: Complex funnels with many users may consume excessive memory
- **Mitigation**: Implement streaming calculations and result pagination

**RISK-5: Attribution Model Accuracy**
- **Risk**: Complex attribution calculations may produce inconsistent results
- **Mitigation**: Extensive testing with known datasets and statistical validation

## Success Metrics

### Technical Performance Metrics
- API response time P50 < 200ms, P95 < 2s, P99 < 5s
- Database query optimization: 50% improvement in common query performance
- Cache hit ratio > 70% for analytics queries
- Real-time processing delay < 30 seconds
- System availability > 99.9% during business hours

### Functional Success Metrics
- All 20+ endpoint requirements implemented and tested
- 100% multi-tenant data isolation compliance
- Zero critical security vulnerabilities
- Complete TypeScript type coverage
- Integration with all existing authentication and authorization systems

### Business Impact Metrics
- Customer adoption of funnel features > 80% within 30 days post-launch
- Customer satisfaction score > 4.5/5 for funnel analytics functionality
- Support ticket volume related to funnel features < 2% of total tickets
- Feature usage growth > 25% month-over-month
- Customer retention improvement of 10% for users actively using funnel analytics

This comprehensive design document provides the technical foundation for implementing sophisticated funnel analysis capabilities while maintaining Mercurio's high performance and reliability standards.
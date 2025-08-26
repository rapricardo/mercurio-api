# Funnel Analysis Endpoints - Implementation Notes

## Overview

This document provides technical implementation guidance, architectural decisions, and development considerations for the funnel analysis endpoints in the Mercurio API.

## Architecture Decisions

### 1. Module Organization

The funnel analysis functionality extends the existing `AnalyticsModule` through a new `FunnelAnalyticsModule` that follows the established architectural patterns:

```
src/analytics/
├── analytics.module.ts           # Main analytics module
├── funnels/                      # New funnel analysis module
│   ├── funnel-analytics.module.ts
│   ├── controllers/
│   │   └── funnel.controller.ts
│   ├── services/
│   │   ├── funnel-config.service.ts      # CRUD operations
│   │   ├── funnel-analytics.service.ts   # Analytics calculations
│   │   ├── funnel-realtime.service.ts    # Real-time tracking
│   │   └── funnel-export.service.ts      # Export functionality
│   ├── repositories/
│   │   ├── funnel.repository.ts          # Data access layer
│   │   └── funnel-analytics.repository.ts
│   ├── dto/
│   │   ├── funnel-request.dto.ts         # Request schemas
│   │   ├── funnel-response.dto.ts        # Response schemas
│   │   └── funnel-query.dto.ts           # Query parameters
│   ├── types/
│   │   └── funnel.types.ts               # Type definitions
│   └── utils/
│       ├── funnel-calculations.util.ts   # Calculation helpers
│       └── funnel-validation.util.ts     # Validation utilities
```

### 2. Database Query Optimization

#### Indexing Strategy
```sql
-- Core funnel queries performance indexes
CREATE INDEX CONCURRENTLY idx_funnel_tenant_workspace_status 
  ON funnel (tenant_id, workspace_id, status) 
  WHERE status != 'archived';

CREATE INDEX CONCURRENTLY idx_funnel_version_publication
  ON funnel_version (funnel_id, state, created_at DESC);

CREATE INDEX CONCURRENTLY idx_funnel_step_order
  ON funnel_step (funnel_version_id, "order");

-- Analytics performance indexes
CREATE INDEX CONCURRENTLY idx_event_funnel_analytics
  ON event (tenant_id, workspace_id, event_name, timestamp)
  WHERE timestamp >= NOW() - INTERVAL '90 days';

CREATE INDEX CONCURRENTLY idx_event_funnel_user_progression
  ON event (tenant_id, workspace_id, anonymous_id, timestamp)
  WHERE timestamp >= NOW() - INTERVAL '90 days';

-- Session-based funnel analysis
CREATE INDEX CONCURRENTLY idx_session_funnel_analytics
  ON session (tenant_id, workspace_id, started_at, ended_at)
  WHERE started_at >= NOW() - INTERVAL '90 days';
```

#### Query Performance Patterns
```typescript
// Example of optimized funnel conversion calculation
const getFunnelConversionRates = async (
  funnelId: string, 
  dateFrom: Date, 
  dateTo: Date
): Promise<ConversionMetrics> => {
  // Use window functions for efficient step-by-step analysis
  const query = `
    WITH funnel_steps AS (
      SELECT step_id, "order", matching_rules
      FROM funnel_step fs
      JOIN funnel_version fv ON fs.funnel_version_id = fv.id
      JOIN funnel_publication fp ON fv.funnel_id = fp.funnel_id 
        AND fv.version = fp.version
      WHERE fp.funnel_id = $1 
        AND fp.published_at <= $2
      ORDER BY fs."order"
    ),
    step_completions AS (
      SELECT 
        fs."order" as step_order,
        COUNT(DISTINCT e.anonymous_id) as completions,
        LAG(COUNT(DISTINCT e.anonymous_id), 1) OVER (ORDER BY fs."order") as previous_completions
      FROM funnel_steps fs
      JOIN funnel_step_match fsm ON fs.step_id = fsm.funnel_step_id
      JOIN event e ON (
        (fsm.kind = 'event' AND e.event_name = (fsm.rules->>'event_name'))
        OR (fsm.kind = 'page' AND e.page->>'url' ~ (fsm.rules->>'url_pattern'))
      )
      WHERE e.tenant_id = $3 
        AND e.workspace_id = $4
        AND e.timestamp BETWEEN $5 AND $6
      GROUP BY fs."order"
    )
    SELECT 
      step_order,
      completions,
      CASE 
        WHEN previous_completions IS NOT NULL 
        THEN (completions::float / previous_completions::float) * 100
        ELSE 100.0
      END as conversion_rate
    FROM step_completions
    ORDER BY step_order;
  `;
  
  return await this.prisma.$queryRaw(query, 
    funnelId, dateTo, tenantId, workspaceId, dateFrom, dateTo
  );
};
```

### 3. Caching Architecture

#### Multi-Layer Caching Strategy
```typescript
interface CacheStrategy {
  // L1: In-memory application cache (hot data)
  applicationCache: {
    funnelConfigs: Map<string, FunnelConfig>;
    liveMetrics: Map<string, LiveMetrics>;
    ttl: 30000; // 30 seconds
  };
  
  // L2: Redis distributed cache (warm data)
  redisCache: {
    conversionMetrics: string; // 15 minutes TTL
    cohortAnalysis: string;    // 1 hour TTL
    dropoffAnalysis: string;   // 15 minutes TTL
    pathAnalysis: string;      // 30 minutes TTL
  };
  
  // L3: Pre-computed materialized views (cold data)
  materializedViews: {
    dailyFunnelMetrics: boolean;   // Updated nightly
    weeklyTrends: boolean;         // Updated weekly
    monthlyReports: boolean;       // Updated monthly
  };
}

// Implementation example
class FunnelCacheService {
  private readonly L1_TTL = 30 * 1000; // 30 seconds
  private readonly L2_TTL = 15 * 60 * 1000; // 15 minutes
  
  async getConversionMetrics(
    funnelId: string, 
    query: ConversionQuery
  ): Promise<ConversionMetrics> {
    const cacheKey = this.buildCacheKey('conversion', funnelId, query);
    
    // L1: Check application cache
    const l1Result = this.applicationCache.get(cacheKey);
    if (l1Result && !this.isExpired(l1Result, this.L1_TTL)) {
      return l1Result.data;
    }
    
    // L2: Check Redis cache
    const l2Result = await this.redisCache.get(cacheKey);
    if (l2Result) {
      // Populate L1 cache
      this.applicationCache.set(cacheKey, {
        data: JSON.parse(l2Result),
        timestamp: Date.now()
      });
      return JSON.parse(l2Result);
    }
    
    // L3: Calculate from database
    const data = await this.calculateConversionMetrics(funnelId, query);
    
    // Populate caches
    await this.redisCache.setex(cacheKey, this.L2_TTL / 1000, JSON.stringify(data));
    this.applicationCache.set(cacheKey, { data, timestamp: Date.now() });
    
    return data;
  }
}
```

### 4. Real-time Processing Architecture

#### Event-Driven Funnel Updates
```typescript
// Event processing pipeline for real-time funnel tracking
class FunnelEventProcessor {
  constructor(
    private readonly eventBus: EventBus,
    private readonly funnelProgressService: FunnelProgressService
  ) {}
  
  @EventPattern('event.ingested')
  async handleEventIngested(payload: EventIngestedPayload): Promise<void> {
    const { event, tenantId, workspaceId } = payload;
    
    // Get active funnels for this tenant/workspace
    const activeFunnels = await this.getActiveFunnels(tenantId, workspaceId);
    
    for (const funnel of activeFunnels) {
      // Check if event matches any funnel steps
      const matchingSteps = await this.findMatchingSteps(event, funnel);
      
      if (matchingSteps.length > 0) {
        // Update user progression asynchronously
        await this.funnelProgressService.updateUserProgression(
          funnel.id,
          event.anonymous_id,
          matchingSteps,
          event.timestamp
        );
        
        // Update live metrics
        await this.updateLiveMetrics(funnel.id, matchingSteps);
        
        // Check for bottleneck alerts
        await this.checkBottleneckAlerts(funnel.id, matchingSteps);
      }
    }
  }
  
  private async updateLiveMetrics(
    funnelId: string, 
    completedSteps: MatchingStep[]
  ): Promise<void> {
    // Update Redis counters for live metrics
    const pipeline = this.redisClient.pipeline();
    
    for (const step of completedSteps) {
      const metricKey = `funnel:live:${funnelId}:step:${step.order}`;
      pipeline.incr(`${metricKey}:completions`);
      pipeline.expire(`${metricKey}:completions`, 3600); // 1 hour TTL
    }
    
    await pipeline.exec();
  }
}
```

### 5. Performance Optimization Techniques

#### Query Optimization Strategies
```typescript
// 1. Partitioning strategy for large datasets
const getPartitionedFunnelData = async (
  query: FunnelQuery
): Promise<FunnelData> => {
  const partitions = this.calculateDatePartitions(query.dateFrom, query.dateTo);
  
  // Execute queries in parallel for each partition
  const partitionPromises = partitions.map(partition =>
    this.queryFunnelDataForPartition(partition, query)
  );
  
  const partitionResults = await Promise.all(partitionPromises);
  
  // Merge results efficiently
  return this.mergeFunnelResults(partitionResults);
};

// 2. Batch processing for complex calculations
class FunnelBatchProcessor {
  private readonly batchSize = 1000;
  private readonly concurrencyLimit = 5;
  
  async processUserJourneys(
    userIds: string[], 
    funnelConfig: FunnelConfig
  ): Promise<UserJourney[]> {
    const batches = this.createBatches(userIds, this.batchSize);
    
    // Process batches with concurrency limit
    const results: UserJourney[] = [];
    for (let i = 0; i < batches.length; i += this.concurrencyLimit) {
      const batchSlice = batches.slice(i, i + this.concurrencyLimit);
      const batchPromises = batchSlice.map(batch =>
        this.processBatch(batch, funnelConfig)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
    }
    
    return results;
  }
}

// 3. Incremental calculation patterns
class IncrementalFunnelCalculator {
  async updateFunnelMetrics(
    funnelId: string,
    newEvents: Event[]
  ): Promise<void> {
    // Get last calculation timestamp
    const lastCalculation = await this.getLastCalculationTimestamp(funnelId);
    
    // Only process new events since last calculation
    const relevantEvents = newEvents.filter(
      event => event.timestamp > lastCalculation
    );
    
    if (relevantEvents.length === 0) return;
    
    // Incremental update of metrics
    await this.incrementalUpdate(funnelId, relevantEvents);
    
    // Update last calculation timestamp
    await this.updateLastCalculationTimestamp(funnelId, new Date());
  }
}
```

### 6. Error Handling & Resilience

#### Comprehensive Error Handling Strategy
```typescript
// Custom exception hierarchy
class FunnelAnalyticsException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'FunnelAnalyticsException';
  }
}

class FunnelConfigurationException extends FunnelAnalyticsException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'FUNNEL_CONFIG_ERROR', context);
  }
}

class FunnelCalculationException extends FunnelAnalyticsException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'FUNNEL_CALCULATION_ERROR', context);
  }
}

// Retry logic with exponential backoff
class RetryableOperations {
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second
  
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: Record<string, any>
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on validation errors
        if (error instanceof FunnelConfigurationException) {
          throw error;
        }
        
        if (attempt < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
          
          this.logger.warn('Retrying failed operation', {
            ...context,
            attempt,
            delay,
            error: error.message
          });
        }
      }
    }
    
    throw new FunnelCalculationException(
      `Operation failed after ${this.maxRetries} attempts`,
      { ...context, lastError: lastError.message }
    );
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Circuit breaker pattern for external dependencies
class CircuitBreakerService {
  private failures = new Map<string, number>();
  private readonly maxFailures = 5;
  private readonly resetTimeout = 60000; // 1 minute
  
  async execute<T>(
    operationKey: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (this.isCircuitOpen(operationKey)) {
      throw new Error(`Circuit breaker open for operation: ${operationKey}`);
    }
    
    try {
      const result = await operation();
      this.recordSuccess(operationKey);
      return result;
    } catch (error) {
      this.recordFailure(operationKey);
      throw error;
    }
  }
  
  private isCircuitOpen(operationKey: string): boolean {
    const failures = this.failures.get(operationKey) || 0;
    return failures >= this.maxFailures;
  }
}
```

### 7. Testing Strategies

#### Comprehensive Test Coverage
```typescript
// Unit test example for funnel calculations
describe('FunnelCalculationService', () => {
  let service: FunnelCalculationService;
  let mockRepository: jest.Mocked<FunnelRepository>;
  
  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new FunnelCalculationService(mockRepository);
  });
  
  describe('calculateConversionRates', () => {
    it('should calculate accurate conversion rates for linear funnel', async () => {
      // Arrange
      const funnelConfig = createTestFunnelConfig();
      const testEvents = createTestEventSequence();
      mockRepository.getFunnelEvents.mockResolvedValue(testEvents);
      
      // Act
      const result = await service.calculateConversionRates(
        'uf_test123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );
      
      // Assert
      expect(result.overallConversionRate).toBeCloseTo(23.5, 1);
      expect(result.stepConversions).toHaveLength(4);
      expect(result.stepConversions[0].conversionRate).toBe(100); // First step
    });
    
    it('should handle multi-path funnels correctly', async () => {
      // Test multi-path funnel calculation logic
    });
    
    it('should throw error for invalid date ranges', async () => {
      // Test error handling
    });
  });
});

// Integration test example
describe('Funnel Analytics API Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get<PrismaService>(PrismaService);
  });
  
  describe('POST /v1/analytics/funnels', () => {
    it('should create funnel with valid configuration', async () => {
      const funnelRequest = createValidFunnelRequest();
      
      const response = await request(app.getHttpServer())
        .post('/v1/analytics/funnels')
        .set('Authorization', 'Bearer test-api-key')
        .send(funnelRequest)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.funnel_id).toMatch(/^uf_/);
      
      // Verify database state
      const createdFunnel = await prisma.funnel.findUnique({
        where: { id: response.body.data.funnel_id }
      });
      expect(createdFunnel).toBeTruthy();
    });
  });
});

// Load test example using Artillery
const loadTestConfig = {
  config: {
    target: 'http://localhost:3020',
    phases: [
      { duration: 60, arrivalRate: 10 }, // Ramp up
      { duration: 300, arrivalRate: 50 }, // Sustained load
      { duration: 60, arrivalRate: 100 } // Peak load
    ]
  },
  scenarios: [
    {
      name: 'Funnel Analytics Load Test',
      weight: 100,
      flow: [
        {
          get: {
            url: '/v1/analytics/funnels/{{ funnelId }}/conversion',
            headers: {
              'Authorization': 'Bearer {{ apiKey }}'
            }
          }
        }
      ]
    }
  ]
};
```

### 8. Monitoring & Observability

#### Comprehensive Monitoring Setup
```typescript
// Metrics collection
class FunnelMetricsCollector {
  private readonly prometheusMetrics = {
    endpointDuration: new Histogram({
      name: 'funnel_endpoint_duration_milliseconds',
      help: 'Duration of funnel endpoint requests',
      labelNames: ['endpoint', 'method', 'status']
    }),
    
    calculationDuration: new Histogram({
      name: 'funnel_calculation_duration_milliseconds', 
      help: 'Duration of funnel calculations',
      labelNames: ['calculation_type', 'complexity']
    }),
    
    cacheHitRatio: new Counter({
      name: 'funnel_cache_hits_total',
      help: 'Number of cache hits for funnel data',
      labelNames: ['cache_layer', 'data_type']
    }),
    
    activeCalculations: new Gauge({
      name: 'funnel_active_calculations',
      help: 'Number of active funnel calculations'
    })
  };
  
  recordEndpointDuration(
    endpoint: string,
    method: string,
    status: number,
    duration: number
  ): void {
    this.prometheusMetrics.endpointDuration
      .labels(endpoint, method, status.toString())
      .observe(duration);
  }
}

// Health checks
@Controller('health')
export class FunnelHealthController {
  constructor(
    private readonly funnelService: FunnelAnalyticsService,
    private readonly cacheService: CacheService
  ) {}
  
  @Get('funnels')
  async checkFunnelHealth(): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkDatabaseConnection(),
      this.checkCacheConnection(),
      this.checkCalculationPerformance()
    ]);
    
    const status = checks.every(check => 
      check.status === 'fulfilled'
    ) ? 'healthy' : 'unhealthy';
    
    return {
      status,
      timestamp: new Date().toISOString(),
      checks: checks.map((check, index) => ({
        name: ['database', 'cache', 'calculations'][index],
        status: check.status,
        details: check.status === 'rejected' ? check.reason : null
      }))
    };
  }
  
  private async checkCalculationPerformance(): Promise<void> {
    const startTime = Date.now();
    
    // Perform a simple calculation test
    await this.funnelService.testCalculation();
    
    const duration = Date.now() - startTime;
    if (duration > 5000) { // 5 second threshold
      throw new Error(`Calculation performance degraded: ${duration}ms`);
    }
  }
}

// Alerting rules
const alertingRules = {
  highLatency: {
    condition: 'avg(funnel_endpoint_duration_milliseconds) > 2000',
    duration: '5m',
    severity: 'warning',
    message: 'Funnel endpoint latency is high'
  },
  
  lowCacheHitRatio: {
    condition: 'rate(funnel_cache_hits_total[5m]) < 0.7',
    duration: '10m',
    severity: 'warning',
    message: 'Funnel cache hit ratio is low'
  },
  
  calculationFailures: {
    condition: 'rate(funnel_calculation_errors_total[5m]) > 0.05',
    duration: '2m',
    severity: 'critical',
    message: 'High rate of funnel calculation failures'
  }
};
```

### 9. Security Considerations

#### Data Privacy & Security
```typescript
// Data anonymization for exports
class FunnelDataAnonymizer {
  async anonymizeExportData(
    data: FunnelExportData,
    privacyLevel: 'minimal' | 'standard' | 'strict'
  ): Promise<AnonymizedFunnelData> {
    const anonymized = { ...data };
    
    switch (privacyLevel) {
      case 'strict':
        // Remove all PII and user identifiers
        anonymized.userJourneys = anonymized.userJourneys.map(journey => ({
          ...journey,
          userId: this.hashUserId(journey.userId),
          sessionIds: journey.sessionIds.map(id => this.hashSessionId(id)),
          personalData: undefined
        }));
        break;
        
      case 'standard':
        // Hash user identifiers but keep aggregated data
        anonymized.userJourneys = anonymized.userJourneys.map(journey => ({
          ...journey,
          userId: this.hashUserId(journey.userId)
        }));
        break;
        
      case 'minimal':
        // Only remove direct PII
        anonymized.userJourneys = anonymized.userJourneys.map(journey => ({
          ...journey,
          personalData: undefined
        }));
        break;
    }
    
    return anonymized;
  }
  
  private hashUserId(userId: string): string {
    return crypto
      .createHash('sha256')
      .update(userId + process.env.HASH_SALT)
      .digest('hex')
      .substring(0, 16);
  }
}

// Access control validation
class FunnelAccessControl {
  async validateAccess(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: string,
    operation: 'read' | 'write' | 'admin'
  ): Promise<boolean> {
    // Verify funnel belongs to tenant/workspace
    const funnel = await this.funnelRepository.findFunnel(funnelId);
    
    if (!funnel || 
        funnel.tenantId !== tenantId || 
        funnel.workspaceId !== workspaceId) {
      return false;
    }
    
    // Additional access control checks based on operation
    switch (operation) {
      case 'admin':
        return this.validateAdminAccess(tenantId, workspaceId);
      case 'write':
        return this.validateWriteAccess(tenantId, workspaceId);
      default:
        return true; // Read access validated by tenant/workspace check
    }
  }
}
```

### 10. Deployment Considerations

#### Database Migration Strategy
```sql
-- Migration file: add_funnel_analytics_indexes.sql
BEGIN;

-- Add performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funnel_analytics_performance
  ON funnel (tenant_id, workspace_id, status, created_at)
  WHERE status IN ('draft', 'published');

-- Add partition for large event tables (if needed)
CREATE TABLE IF NOT EXISTS event_funnel_analytics 
  PARTITION OF event FOR VALUES FROM ('2024-01-01') TO ('2024-12-31');

-- Create materialized view for daily funnel metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_funnel_metrics AS
SELECT 
  funnel_id,
  DATE(e.timestamp) as metric_date,
  COUNT(DISTINCT e.anonymous_id) as unique_users,
  COUNT(*) as total_events
FROM event e
JOIN funnel_step_match fsm ON (
  e.event_name = (fsm.rules->>'event_name')
)
JOIN funnel_step fs ON fsm.funnel_step_id = fs.step_id
JOIN funnel_version fv ON fs.funnel_version_id = fv.id
WHERE e.timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY funnel_id, DATE(e.timestamp);

-- Create refresh job
CREATE OR REPLACE FUNCTION refresh_daily_funnel_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_funnel_metrics;
END;
$$ LANGUAGE plpgsql;

COMMIT;
```

#### Environment Configuration
```typescript
// environment.ts
interface FunnelConfig {
  cache: {
    ttl: {
      funnelConfig: number;      // 5 minutes
      conversionMetrics: number; // 15 minutes
      liveMetrics: number;       // 30 seconds
    };
    redis: {
      maxMemoryPolicy: 'allkeys-lru';
      maxMemory: '512mb';
    };
  };
  
  performance: {
    maxQueryTimeoutMs: number;    // 30 seconds
    maxConcurrentCalculations: number; // 10
    batchSize: number;            // 1000
  };
  
  alerts: {
    latencyThresholdMs: number;   // 2000
    errorRateThreshold: number;   // 0.05 (5%)
    cacheHitRatioThreshold: number; // 0.7 (70%)
  };
}
```

This implementation guide provides comprehensive technical guidance for building robust, performant, and scalable funnel analysis endpoints that integrate seamlessly with the existing Mercurio API infrastructure.
# Analytics Endpoints Basic - Implementation Tasks

## Executive Summary

This document provides a comprehensive task breakdown for implementing the foundational analytics endpoints in the Mercurio API. The implementation leverages the existing multi-tenant NestJS architecture with Prisma ORM, adds robust caching strategies, and ensures optimal performance through query optimization and proper data isolation.

The 6 core analytics endpoints will provide traffic managers with essential metrics and insights including overview metrics, time-series data, top events ranking, user analytics, detailed event filtering, and export functionality.

## Technical Architecture Overview

### Module Integration
- **Analytics Module**: Dedicated module with services, repositories, DTOs, and utilities
- **Common Module Integration**: Leverages existing authentication, caching, logging, and rate limiting
- **Database Layer**: Utilizes existing Prisma schema with optimized indexes for analytics queries
- **Caching Strategy**: Multi-layer approach with in-memory and Redis caching for performance

### Performance Targets
- p50 response time < 100ms for all analytics endpoints
- p95 response time < 500ms for all analytics endpoints  
- >90% cache hit rate for frequently accessed metrics
- Support 100+ concurrent requests per workspace

---

## Detailed Task Breakdown

### Phase 1: Foundation and Core Services (Week 1)

#### ANLT-001: Analytics Module Infrastructure
**Priority**: Critical  
**Complexity**: Medium  
**Estimated Effort**: 2 days

##### Description
Set up the foundational analytics module structure with proper dependency injection and integration with existing common services.

##### Technical Requirements
- Create `AnalyticsModule` with proper imports and provider configuration
- Integrate with existing `CommonModule` for auth, caching, logging services
- Set up proper module exports for potential future dependencies
- Configure TypeScript strict mode compliance

##### Acceptance Criteria
- [x] `AnalyticsModule` is properly configured with all required providers
- [x] Module integrates cleanly with existing `CommonModule` services
- [x] All services are properly injectable and follow existing patterns
- [x] Module follows established NestJS patterns in codebase
- [x] TypeScript compilation passes with strict mode

##### Implementation Details
```typescript
// src/analytics/analytics.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { MetricsService } from './services/metrics.service';
import { TimeSeriesService } from './services/time-series.service';
import { AnalyticsCacheService } from './services/analytics-cache.service';
import { ExportService } from './services/export.service';

@Module({
  imports: [CommonModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsRepository,
    MetricsService,
    TimeSeriesService,
    AnalyticsCacheService,
    ExportService,
  ],
  exports: [
    AnalyticsService,
    AnalyticsRepository,
    MetricsService,
  ],
})
export class AnalyticsModule {}
```

##### Testing Requirements
- Unit tests for module configuration and dependency injection
- Integration test verifying clean startup with `AppModule`

##### Dependencies
- Existing `CommonModule` and its services
- Prisma service integration

---

#### ANLT-002: Analytics Repository Implementation  
**Priority**: Critical  
**Complexity**: High  
**Estimated Effort**: 3 days

##### Description
Implement the core analytics repository with optimized database queries leveraging existing indexes for multi-tenant data access.

##### Technical Requirements
- Implement efficient aggregation queries using existing database indexes
- Ensure strict multi-tenant isolation in all queries
- Optimize query performance for time-range operations
- Use Prisma ORM with proper type safety

##### Acceptance Criteria
- [x] All repository methods enforce tenant/workspace isolation
- [x] Queries utilize existing database indexes optimally
- [x] Aggregation queries perform efficiently for large datasets
- [x] Methods handle edge cases (null values, empty results)
- [x] Query performance meets p95 < 10 seconds target
- [x] Proper error handling and logging integration

##### Implementation Details
```typescript
// src/analytics/repositories/analytics.repository.ts
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOverviewMetrics(
    tenantId: bigint,
    workspaceId: bigint,
    startDate: Date,
    endDate: Date,
  ): Promise<OverviewMetrics> {
    // Optimized single query for overview metrics
    const result = await this.prisma.$queryRaw<OverviewMetricsRaw[]>`
      SELECT 
        COUNT(*)::int as total_events,
        COUNT(DISTINCT anonymous_id)::int as unique_visitors,
        COUNT(DISTINCT session_id)::int as total_sessions,
        COUNT(DISTINCT CASE WHEN lead_id IS NOT NULL THEN anonymous_id END)::int as conversions,
        MODE() WITHIN GROUP (ORDER BY event_name) as top_event
      FROM event
      WHERE tenant_id = ${tenantId}
        AND workspace_id = ${workspaceId}
        AND timestamp >= ${startDate}
        AND timestamp <= ${endDate}
    `;
    
    return this.transformOverviewMetrics(result[0]);
  }

  async getTimeSeriesData(
    tenantId: bigint,
    workspaceId: bigint,
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week',
    metrics: string[],
  ): Promise<TimeSeriesDataPoint[]> {
    const timeFormat = this.getTimeFormat(granularity);
    
    return this.prisma.$queryRaw`
      WITH time_series AS (
        SELECT generate_series(
          date_trunc(${granularity}, ${startDate}::timestamp),
          date_trunc(${granularity}, ${endDate}::timestamp),
          '1 ${granularity}'::interval
        ) AS timestamp
      ),
      event_aggregations AS (
        SELECT 
          date_trunc(${granularity}, timestamp) as period,
          ${this.buildMetricSelections(metrics)}
        FROM event
        WHERE tenant_id = ${tenantId}
          AND workspace_id = ${workspaceId}
          AND timestamp >= ${startDate}
          AND timestamp <= ${endDate}
        GROUP BY date_trunc(${granularity}, timestamp)
      )
      SELECT 
        time_series.timestamp,
        ${this.buildCoalesceSelections(metrics)}
      FROM time_series
      LEFT JOIN event_aggregations ON time_series.timestamp = event_aggregations.period
      ORDER BY time_series.timestamp ASC
    `;
  }

  private buildMetricSelections(metrics: string[]): Prisma.Sql {
    const selections = [];
    
    if (metrics.includes('events')) {
      selections.push('COUNT(*)::int as events');
    }
    if (metrics.includes('visitors')) {
      selections.push('COUNT(DISTINCT anonymous_id)::int as visitors');
    }
    if (metrics.includes('sessions')) {
      selections.push('COUNT(DISTINCT session_id)::int as sessions');
    }
    if (metrics.includes('conversions')) {
      selections.push('COUNT(DISTINCT CASE WHEN lead_id IS NOT NULL THEN anonymous_id END)::int as conversions');
    }
    
    return Prisma.raw(selections.join(', '));
  }
}
```

##### Testing Requirements
- Unit tests for all repository methods with mock data
- Integration tests with actual database using test containers
- Performance tests to validate query optimization
- Multi-tenant isolation tests

##### Dependencies
- Existing Prisma service and database schema
- Database indexes on (tenant_id, workspace_id, timestamp)

---

#### ANLT-003: DTOs and Type Definitions
**Priority**: Critical  
**Complexity**: Medium  
**Estimated Effort**: 2 days

##### Description
Create comprehensive Data Transfer Objects and TypeScript type definitions for all analytics endpoints with proper validation.

##### Technical Requirements
- Use class-validator for input validation following existing patterns
- Implement proper date/time handling with timezone support
- Create response DTOs matching API specification exactly
- Ensure type safety across all analytics operations

##### Acceptance Criteria
- [x] All query DTOs have proper validation decorators
- [x] Response DTOs match specification exactly
- [x] Custom validation for date ranges and periods implemented
- [x] Timezone handling is correctly implemented
- [x] Error responses follow existing API patterns

##### Implementation Details
```typescript
// src/analytics/dto/query.dto.ts
export class PeriodQueryDto {
  @IsEnum(['24h', '7d', '30d', 'custom'])
  @IsNotEmpty()
  period: '24h' | '7d' | '30d' | 'custom';

  @IsDateString()
  @ValidateIf((o) => o.period === 'custom')
  @IsNotEmpty()
  start_date?: string;

  @IsDateString()
  @ValidateIf((o) => o.period === 'custom')
  @IsNotEmpty()
  end_date?: string;

  @IsOptional()
  @IsString()
  @IsIn(moment.tz.names()) // Validate timezone
  timezone?: string = 'UTC';

  @Transform(({ obj }) => obj.period === 'custom' 
    ? moment.tz(obj.start_date, obj.timezone).toDate()
    : this.getPeriodStartDate(obj.period, obj.timezone)
  )
  get startDate(): Date {
    return this.period === 'custom' 
      ? moment.tz(this.start_date!, this.timezone).toDate()
      : this.getPeriodStartDate(this.period, this.timezone);
  }
  
  @Transform(({ obj }) => obj.period === 'custom'
    ? moment.tz(obj.end_date, obj.timezone).toDate() 
    : moment.tz(obj.timezone).toDate()
  )
  get endDate(): Date {
    return this.period === 'custom'
      ? moment.tz(this.end_date!, this.timezone).toDate()
      : moment.tz(this.timezone).toDate();
  }

  private getPeriodStartDate(period: string, timezone: string): Date {
    const now = moment.tz(timezone);
    switch (period) {
      case '24h': return now.subtract(24, 'hours').toDate();
      case '7d': return now.subtract(7, 'days').toDate();
      case '30d': return now.subtract(30, 'days').toDate();
      default: throw new Error('Invalid period');
    }
  }
  
  @IsOptional()
  @Validate(DateRangeValidator) // Custom validator
  validateDateRange() {
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
    const rangeMs = this.endDate.getTime() - this.startDate.getTime();
    
    if (rangeMs > maxRangeMs) {
      return false;
    }
    
    if (this.startDate >= this.endDate) {
      return false;
    }
    
    return true;
  }
}
```

##### Testing Requirements
- Unit tests for all DTO validation scenarios
- Integration tests with controller validation pipe
- Edge case testing for timezone conversion

##### Dependencies
- class-validator and class-transformer libraries
- moment-timezone for timezone handling

---

#### ANLT-004: Analytics Cache Service Implementation
**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2 days

##### Description
Implement specialized caching service for analytics queries with configurable TTL and cache warming strategies.

##### Technical Requirements
- Multi-layer caching (in-memory + Redis if available)
- Dynamic TTL based on data freshness requirements
- Cache key strategies that include tenant isolation
- Cache invalidation patterns for data updates

##### Acceptance Criteria
- [x] Cache service provides get/set/delete operations
- [x] TTL is configurable per query type
- [x] Cache keys include tenant/workspace isolation
- [x] Cache hit rate monitoring is implemented
- [x] Graceful degradation when cache is unavailable

##### Implementation Details
```typescript
// src/analytics/services/analytics-cache.service.ts
@Injectable()
export class AnalyticsCacheService {
  private readonly cachePrefix = 'analytics';
  
  constructor(
    private readonly cacheService: CacheService, // From CommonModule
    private readonly logger: MercurioLogger,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      return this.cacheService.get<T>(this.buildKey(key));
    } catch (error) {
      this.logger.warn('Analytics cache get failed', { key, error: error.message });
      return null; // Graceful degradation
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      this.cacheService.set(this.buildKey(key), value, ttlMs);
    } catch (error) {
      this.logger.warn('Analytics cache set failed', { key, error: error.message });
    }
  }

  buildCacheKey(
    endpoint: string,
    tenantContext: TenantContext,
    query: any,
  ): string {
    const keyParts = [
      endpoint,
      tenantContext.tenantId.toString(),
      tenantContext.workspaceId.toString(),
      this.hashQuery(query),
    ];
    
    return keyParts.join(':');
  }

  getCacheTTL(period: string): number {
    switch (period) {
      case '24h': return 5 * 60 * 1000;  // 5 minutes
      case '7d': return 15 * 60 * 1000;  // 15 minutes  
      case '30d': return 60 * 60 * 1000; // 1 hour
      case 'custom': return 30 * 60 * 1000; // 30 minutes
      default: return 15 * 60 * 1000;
    }
  }

  private hashQuery(query: any): string {
    return crypto.createHash('md5').update(JSON.stringify(query)).digest('hex').substring(0, 8);
  }
}
```

##### Testing Requirements
- Unit tests for cache operations and key generation
- Integration tests with actual cache backend
- Performance tests for cache hit/miss scenarios

##### Dependencies
- Existing `CacheService` from CommonModule
- Crypto module for query hashing

---

### Phase 2: Core Analytics Endpoints (Week 2)

#### ANLT-005: Overview Metrics Endpoint Implementation
**Priority**: Critical  
**Complexity**: Medium  
**Estimated Effort**: 2 days

##### Description
Implement the overview metrics endpoint providing high-level aggregate metrics for a workspace within a specified time period.

##### Technical Requirements
- Calculate overview metrics: total events, unique visitors, sessions, conversion rate, etc.
- Implement period-over-period comparison logic
- Ensure efficient database queries with proper caching
- Handle timezone conversions correctly

##### Acceptance Criteria
- [x] Endpoint returns accurate aggregate metrics for specified period
- [x] Period-over-period comparisons are calculated correctly
- [x] Response time meets performance targets (p50 < 100ms)
- [x] Proper error handling for invalid date ranges
- [x] Timezone handling works for all supported zones
- [x] Caching reduces database load significantly

##### Implementation Details
```typescript
// src/analytics/services/analytics.service.ts
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly cache: AnalyticsCacheService,
    private readonly logger: MercurioLogger,
  ) {}

  async getOverviewMetrics(
    tenantContext: TenantContext,
    query: PeriodQueryDto,
  ): Promise<OverviewMetricsResponse> {
    const cacheKey = this.cache.buildCacheKey('overview', tenantContext, query);
    
    // Check cache first
    const cached = await this.cache.get<OverviewMetricsResponse>(cacheKey);
    if (cached) {
      this.logger.debug('Analytics overview cache hit', { cacheKey });
      return cached;
    }

    // Calculate current period metrics
    const currentMetrics = await this.repository.getOverviewMetrics(
      tenantContext.tenantId,
      tenantContext.workspaceId,
      query.startDate,
      query.endDate,
    );

    // Calculate previous period metrics for comparison
    const previousPeriod = this.calculatePreviousPeriod(query.startDate, query.endDate);
    const previousMetrics = await this.repository.getOverviewMetrics(
      tenantContext.tenantId,
      tenantContext.workspaceId,
      previousPeriod.start,
      previousPeriod.end,
    );

    // Build response with comparisons
    const response: OverviewMetricsResponse = {
      period: {
        type: query.period,
        start: query.startDate.toISOString(),
        end: query.endDate.toISOString(),
        timezone: query.timezone,
      },
      metrics: currentMetrics,
      comparisons: this.buildComparisons(currentMetrics, previousMetrics),
    };

    // Cache with appropriate TTL
    const ttl = this.cache.getCacheTTL(query.period);
    await this.cache.set(cacheKey, response, ttl);

    return response;
  }

  private buildComparisons(current: any, previous: any): any {
    return {
      total_events: this.calculateChange(current.total_events, previous.total_events),
      unique_visitors: this.calculateChange(current.unique_visitors, previous.unique_visitors),
      total_sessions: this.calculateChange(current.total_sessions, previous.total_sessions),
    };
  }

  private calculateChange(current: number, previous: number): MetricComparison {
    if (previous === 0) {
      return {
        value: current,
        change_pct: current > 0 ? 100 : 0,
        previous: 0,
        direction: current > 0 ? 'up' : 'stable',
      };
    }

    const changePct = ((current - previous) / previous) * 100;
    
    return {
      value: current,
      change_pct: Math.round(changePct * 100) / 100,
      previous,
      direction: changePct > 1 ? 'up' : changePct < -1 ? 'down' : 'stable',
    };
  }
}
```

##### Testing Requirements
- Unit tests for metrics calculation and comparison logic
- Integration tests with database queries
- Performance testing for response time targets
- Cache behavior testing

##### Dependencies
- `AnalyticsRepository` for data access
- `AnalyticsCacheService` for caching

---

#### ANLT-006: Time-Series Data Endpoint Implementation
**Priority**: Critical  
**Complexity**: High  
**Estimated Effort**: 3 days

##### Description
Implement time-series data endpoint providing configurable granularity data for charts and trend analysis.

##### Technical Requirements
- Support multiple granularities (hour, day, week)
- Handle multiple metrics in single request
- Ensure complete time series (no gaps in data points)
- Optimize queries for different time ranges

##### Acceptance Criteria
- [x] Supports multiple metrics in single request
- [x] Granularity options work correctly for all time periods
- [x] Data points are complete with no gaps in time series
- [x] Aggregation logic is accurate for each granularity level
- [x] Response includes proper timestamp formatting
- [x] Performance remains acceptable for large date ranges

##### Implementation Details
```typescript
// src/analytics/services/time-series.service.ts
@Injectable()
export class TimeSeriesService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly logger: MercurioLogger,
  ) {}

  async getTimeSeriesData(
    tenantContext: TenantContext,
    query: TimeSeriesQueryDto,
  ): Promise<TimeSeriesResponse> {
    // Validate granularity against period
    this.validateGranularityForPeriod(query.period, query.granularity);

    const data = await this.repository.getTimeSeriesData(
      tenantContext.tenantId,
      tenantContext.workspaceId,
      query.startDate,
      query.endDate,
      query.granularity,
      query.metrics,
    );

    return {
      period: {
        type: query.period,
        start: query.startDate.toISOString(),
        end: query.endDate.toISOString(),
        granularity: query.granularity,
        timezone: query.timezone,
      },
      data: data.map(point => ({
        timestamp: point.timestamp.toISOString(),
        ...this.extractMetrics(point, query.metrics),
      })),
    };
  }

  private validateGranularityForPeriod(period: string, granularity: string): void {
    const restrictions = {
      '24h': ['hour'],
      '7d': ['hour', 'day'],
      '30d': ['day', 'week'],
      'custom': ['hour', 'day', 'week'],
    };

    if (!restrictions[period as keyof typeof restrictions]?.includes(granularity)) {
      throw new BadRequestException({
        error: {
          code: 'invalid_granularity',
          message: `Granularity '${granularity}' not supported for period '${period}'`,
          details: {
            period,
            granularity,
            supported: restrictions[period as keyof typeof restrictions] || [],
          },
        },
      });
    }
  }

  private extractMetrics(dataPoint: any, requestedMetrics: string[]): any {
    const result: any = {};
    
    requestedMetrics.forEach(metric => {
      if (dataPoint[metric] !== undefined) {
        result[metric] = dataPoint[metric];
      }
    });
    
    return result;
  }
}
```

##### Testing Requirements
- Unit tests for granularity validation and data processing
- Integration tests with various time ranges and granularities
- Performance tests for large date ranges
- Data completeness validation tests

##### Dependencies
- `AnalyticsRepository` for time-series data queries
- Date/time utilities for granularity handling

---

#### ANLT-007: Top Events Ranking Endpoint Implementation
**Priority**: Critical  
**Complexity**: Medium  
**Estimated Effort**: 2 days

##### Description  
Implement event ranking endpoint with frequency analysis, percentage calculations, and trend indicators.

##### Technical Requirements
- Rank events by frequency with proper sorting
- Calculate percentages relative to total events
- Implement period-over-period trend calculations
- Support configurable result limits

##### Acceptance Criteria
- [x] Events are correctly ranked by count in descending order
- [x] Percentage calculations are accurate relative to total events
- [x] Unique visitor counts are deduplicated correctly
- [x] Trend calculations compare to previous period accurately
- [x] Limit parameter restricts results appropriately
- [x] Handles edge cases (ties in ranking, zero events)

##### Implementation Details
```typescript
// src/analytics/services/metrics.service.ts
@Injectable()
export class MetricsService {
  constructor(
    private readonly repository: AnalyticsRepository,
  ) {}

  async getTopEvents(
    tenantContext: TenantContext,
    query: TopEventsQueryDto,
  ): Promise<TopEventsResponse> {
    const [currentEvents, previousEvents, totalEvents] = await Promise.all([
      this.repository.getTopEvents(
        tenantContext.tenantId,
        tenantContext.workspaceId,
        query.startDate,
        query.endDate,
        query.limit || 10,
      ),
      this.repository.getTopEvents(
        tenantContext.tenantId,
        tenantContext.workspaceId,
        ...this.calculatePreviousPeriod(query.startDate, query.endDate),
        query.limit || 10,
      ),
      this.repository.getTotalEventsCount(
        tenantContext.tenantId,
        tenantContext.workspaceId,
        query.startDate,
        query.endDate,
      ),
    ]);

    // Build events with trend data
    const eventsWithTrends = currentEvents.map((event, index) => {
      const previousEvent = previousEvents.find(p => p.event_name === event.event_name);
      const trend = this.calculateEventTrend(event.count, previousEvent?.count || 0);

      return {
        rank: index + 1,
        event_name: event.event_name,
        count: event.count,
        percentage: totalEvents > 0 ? Math.round((event.count / totalEvents) * 10000) / 100 : 0,
        unique_visitors: event.unique_visitors,
        avg_per_visitor: event.avg_per_visitor,
        trend,
      };
    });

    return {
      period: {
        type: query.period,
        start: query.startDate.toISOString(),
        end: query.endDate.toISOString(),
        timezone: query.timezone,
      },
      total_events: totalEvents,
      events: eventsWithTrends,
    };
  }

  private calculateEventTrend(current: number, previous: number): EventTrendData {
    if (previous === 0) {
      return {
        change_pct: current > 0 ? 100 : 0,
        direction: current > 0 ? 'up' : 'stable',
      };
    }

    const changePct = ((current - previous) / previous) * 100;
    
    return {
      change_pct: Math.round(changePct * 100) / 100,
      direction: changePct > 1 ? 'up' : changePct < -1 ? 'down' : 'stable',
    };
  }
}
```

##### Testing Requirements
- Unit tests for ranking logic and percentage calculations
- Integration tests with various event datasets
- Edge case testing (empty data, ties, etc.)

##### Dependencies
- `AnalyticsRepository` for top events queries

---

#### ANLT-008: User Analytics Endpoint Implementation
**Priority**: Critical  
**Complexity**: High  
**Estimated Effort**: 3 days

##### Description
Implement user analytics endpoint providing insights into user behavior patterns, activity levels, and conversion metrics.

##### Technical Requirements
- Segment users by activity levels (high, medium, low)
- Calculate identification rates and conversion funnels
- Implement visitor vs lead analytics differentiation
- Provide meaningful activity level descriptions

##### Acceptance Criteria
- [x] User segmentation works correctly (visitors vs leads)
- [x] Activity level calculations are accurate and meaningful
- [x] Identification rate calculation is correct
- [x] Returning vs new visitor logic is implemented properly
- [x] Conversion funnel stages reflect actual user journey
- [x] Segment filtering affects all relevant metrics

##### Implementation Details
```typescript
// src/analytics/services/analytics.service.ts (continued)
async getUserAnalytics(
  tenantContext: TenantContext,
  query: UserAnalyticsQueryDto,
): Promise<UserAnalyticsResponse> {
  const [summary, activityLevels, conversionFunnel] = await Promise.all([
    this.repository.getUserSummary(
      tenantContext.tenantId,
      tenantContext.workspaceId,
      query.startDate,
      query.endDate,
      query.segment,
    ),
    this.repository.getUserActivityLevels(
      tenantContext.tenantId,
      tenantContext.workspaceId,
      query.startDate,
      query.endDate,
    ),
    this.repository.getConversionFunnel(
      tenantContext.tenantId,
      tenantContext.workspaceId,
      query.startDate,
      query.endDate,
    ),
  ]);

  return {
    period: {
      type: query.period,
      start: query.startDate.toISOString(),
      end: query.endDate.toISOString(),
      timezone: query.timezone,
    },
    summary: {
      total_visitors: summary.total_visitors,
      identified_leads: summary.identified_leads,
      identification_rate: summary.total_visitors > 0 
        ? Math.round((summary.identified_leads / summary.total_visitors) * 10000) / 100
        : 0,
      returning_visitors: summary.returning_visitors,
      new_visitors: summary.new_visitors,
    },
    activity_levels: activityLevels.map(level => ({
      level: level.level as 'high_activity' | 'medium_activity' | 'low_activity',
      description: this.getActivityDescription(level.level),
      visitors: level.visitors,
      percentage: level.percentage,
      avg_events_per_session: level.avg_events_per_session,
    })),
    conversion_funnel: this.buildConversionFunnel(conversionFunnel),
  };
}

private getActivityDescription(level: string): string {
  const descriptions = {
    high_activity: '10+ events per session',
    medium_activity: '3-9 events per session',
    low_activity: '1-2 events per session',
  };
  
  return descriptions[level as keyof typeof descriptions] || 'Unknown activity level';
}

private buildConversionFunnel(data: any): ConversionFunnel {
  const stages = [
    { stage: 'visitor', count: data.visitors, percentage: 100.0 },
    { 
      stage: 'engaged', 
      count: data.sessions_created, 
      percentage: data.visitors > 0 ? Math.round((data.sessions_created / data.visitors) * 10000) / 100 : 0
    },
    { 
      stage: 'identified', 
      count: data.leads_identified, 
      percentage: data.visitors > 0 ? Math.round((data.leads_identified / data.visitors) * 10000) / 100 : 0
    },
  ];

  return {
    visitors: data.visitors,
    sessions_created: data.sessions_created,
    events_generated: data.events_generated,
    leads_identified: data.leads_identified,
    conversion_stages: stages,
  };
}
```

##### Testing Requirements
- Unit tests for activity level calculations
- Integration tests for conversion funnel logic
- Segment filtering validation tests

##### Dependencies
- `AnalyticsRepository` for user analytics queries

---

### Phase 3: Advanced Features and Controllers (Week 3)

#### ANLT-009: Analytics Controller Implementation
**Priority**: Critical  
**Complexity**: Medium  
**Estimated Effort**: 2 days

##### Description
Implement the main analytics controller with proper authentication, validation, rate limiting, and error handling following existing patterns.

##### Technical Requirements
- Follow existing controller patterns from events module
- Implement proper authentication with API key scopes
- Add rate limiting and request validation
- Comprehensive error handling with structured responses

##### Acceptance Criteria
- [x] All endpoints require proper authentication and scopes
- [x] Rate limiting is properly configured for analytics endpoints
- [x] Input validation follows existing patterns
- [x] Error responses are structured and consistent
- [x] Request context and logging are implemented

##### Implementation Details
```typescript
// src/analytics/controllers/analytics.controller.ts
@Controller('v1/analytics')
@UseGuards(ApiKeyGuard, RateLimitGuard)
@RequireScopes(['analytics:read', 'read'])
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly timeSeriesService: TimeSeriesService,
    private readonly metricsService: MetricsService,
    private readonly exportService: ExportService,
    private readonly logger: MercurioLogger,
  ) {}

  @Get('overview')
  @RateLimit({ endpoint: 'analytics' })
  async getOverview(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PeriodQueryDto,
    @Req() request: FastifyRequest,
  ): Promise<OverviewMetricsResponse> {
    const requestContext = request[REQUEST_CONTEXT_KEY];
    
    try {
      this.validateDateRange(query.startDate, query.endDate);
      
      const result = await this.analyticsService.getOverviewMetrics(tenant, query);
      
      this.logger.log('Analytics overview requested', {
        requestId: requestContext?.requestId,
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
      }, {
        category: 'analytics_endpoint',
        endpoint: 'overview',
        period: query.period,
        timezone: query.timezone,
      });

      return result;
    } catch (error) {
      if (error instanceof ValidationException) {
        throw new BadRequestException({
          error: {
            code: 'validation_failed',
            message: error.message,
            details: error.details,
          },
        });
      }
      
      this.logger.error('Analytics overview failed', error, {
        requestId: requestContext?.requestId,
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
      });
      
      throw error;
    }
  }

  @Get('timeseries')
  @RateLimit({ endpoint: 'analytics' })
  async getTimeSeries(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TimeSeriesQueryDto,
    @Req() request: FastifyRequest,
  ): Promise<TimeSeriesResponse> {
    const requestContext = request[REQUEST_CONTEXT_KEY];
    
    try {
      this.validateDateRange(query.startDate, query.endDate);
      
      const result = await this.timeSeriesService.getTimeSeriesData(tenant, query);
      
      this.logger.log('Analytics time series requested', {
        requestId: requestContext?.requestId,
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
      }, {
        category: 'analytics_endpoint',
        endpoint: 'timeseries',
        period: query.period,
        granularity: query.granularity,
        metrics: query.metrics,
      });

      return result;
    } catch (error) {
      this.handleControllerError(error, requestContext, tenant, 'timeseries');
    }
  }

  @Get('events/top')
  @RateLimit({ endpoint: 'analytics' })
  async getTopEvents(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TopEventsQueryDto,
    @Req() request: FastifyRequest,
  ): Promise<TopEventsResponse> {
    const requestContext = request[REQUEST_CONTEXT_KEY];
    
    try {
      this.validateDateRange(query.startDate, query.endDate);
      
      const result = await this.metricsService.getTopEvents(tenant, query);
      
      this.logger.log('Analytics top events requested', {
        requestId: requestContext?.requestId,
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
      }, {
        category: 'analytics_endpoint',
        endpoint: 'top_events',
        period: query.period,
        limit: query.limit,
      });

      return result;
    } catch (error) {
      this.handleControllerError(error, requestContext, tenant, 'top_events');
    }
  }

  private validateDateRange(startDate: Date, endDate: Date): void {
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
    const rangeMs = endDate.getTime() - startDate.getTime();
    
    if (rangeMs > maxRangeMs) {
      throw new ValidationException('Date range cannot exceed 1 year', {
        field: 'date_range',
        max_days: 365,
        requested_days: Math.ceil(rangeMs / (24 * 60 * 60 * 1000)),
      });
    }

    if (startDate >= endDate) {
      throw new ValidationException('Start date must be before end date', {
        field: 'date_range',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });
    }
  }

  private handleControllerError(
    error: any, 
    requestContext: any, 
    tenant: TenantContext, 
    endpoint: string,
  ): never {
    if (error instanceof ValidationException || error instanceof BadRequestException) {
      throw error;
    }
    
    this.logger.error(`Analytics ${endpoint} failed`, error, {
      requestId: requestContext?.requestId,
      tenantId: tenant.tenantId.toString(),
      workspaceId: tenant.workspaceId.toString(),
    });
    
    throw new InternalServerErrorException({
      error: {
        code: 'internal_server_error',
        message: 'An internal error occurred while processing the analytics request',
      },
    });
  }
}
```

##### Testing Requirements
- Unit tests for all controller methods
- Integration tests with authentication and rate limiting
- Error handling scenario tests

##### Dependencies
- All analytics services
- Existing authentication and rate limiting infrastructure

---

#### ANLT-010: Event Details with Advanced Filtering Implementation  
**Priority**: High  
**Complexity**: High  
**Estimated Effort**: 3 days

##### Description
Implement detailed event data endpoint with advanced filtering capabilities, pagination, and proper data anonymization.

##### Technical Requirements
- Support multiple filter combinations
- Implement efficient pagination for large result sets
- Add data anonymization for PII protection
- Optimize database queries for performance

##### Acceptance Criteria
- [x] All filter combinations work correctly
- [x] Pagination handles large result sets efficiently
- [x] Sorting options work for all supported fields
- [x] Event data includes all available context
- [x] Filter validation prevents invalid combinations
- [x] Proper handling of missing or null values
- [x] PII data is properly anonymized

##### Implementation Details
```typescript
// src/analytics/services/analytics.service.ts (continued)
async getEventDetails(
  tenantContext: TenantContext,
  query: EventDetailsQueryDto,
): Promise<EventDetailsResponse> {
  // Validate filter combinations
  this.validateEventFilters(query);

  const [events, totalCount] = await Promise.all([
    this.repository.getEventDetails(
      tenantContext.tenantId,
      tenantContext.workspaceId,
      query,
    ),
    this.repository.getEventDetailsCount(
      tenantContext.tenantId,
      tenantContext.workspaceId,
      query,
    ),
  ]);

  const totalPages = Math.ceil(totalCount / query.limit!);
  
  return {
    pagination: {
      page: query.page!,
      limit: query.limit!,
      total_events: totalCount,
      total_pages: totalPages,
      has_next: query.page! < totalPages,
      has_prev: query.page! > 1,
    },
    filters: this.extractAppliedFilters(query),
    events: events.map(event => this.anonymizeEventData(event)),
  };
}

private validateEventFilters(query: EventDetailsQueryDto): void {
  // Validate mutually exclusive filters
  if (query.anonymous_id && query.lead_id) {
    throw new BadRequestException({
      error: {
        code: 'invalid_filter_combination',
        message: 'Cannot filter by both anonymous_id and lead_id',
        details: {
          conflicting_filters: ['anonymous_id', 'lead_id'],
        },
      },
    });
  }

  // Validate has_lead filter with specific ID filters
  if (query.has_lead !== undefined && (query.anonymous_id || query.lead_id)) {
    throw new BadRequestException({
      error: {
        code: 'invalid_filter_combination',
        message: 'Cannot use has_lead filter with specific ID filters',
        details: {
          conflicting_filters: ['has_lead', 'anonymous_id', 'lead_id'],
        },
      },
    });
  }
}

private anonymizeEventData(event: EventDetailItem): EventDetailItem {
  return {
    ...event,
    // Hash lead_id for privacy
    lead_id: event.lead_id ? this.hashLeadId(event.lead_id) : undefined,
    // Anonymize geo data (remove precise location)
    geo: event.geo ? this.anonymizeGeoData(event.geo) : undefined,
  };
}

private hashLeadId(leadId: string): string {
  return `ld_${crypto.createHash('sha256').update(leadId).digest('hex').substring(0, 16)}`;
}

private anonymizeGeoData(geo: any): any {
  return {
    country: geo.country,
    region: geo.region,
    city: geo.city,
    // Remove IP address and precise coordinates
  };
}
```

##### Testing Requirements
- Unit tests for filter validation and data anonymization
- Integration tests with various filter combinations
- Performance tests for large datasets
- Pagination behavior tests

##### Dependencies
- `AnalyticsRepository` with advanced filtering support
- Crypto module for data anonymization

---

#### ANLT-011: Export Functionality Implementation
**Priority**: Medium  
**Complexity**: High  
**Estimated Effort**: 4 days

##### Description
Implement data export functionality supporting multiple formats (JSON, CSV) with async processing and secure download links.

##### Technical Requirements
- Support asynchronous export processing for large datasets
- Generate secure, time-limited download URLs
- Support multiple export formats (JSON, CSV)
- Implement export job status tracking

##### Acceptance Criteria
- [x] Supports all major analytics datasets
- [x] CSV format includes proper headers and escaping
- [x] JSON format maintains data type integrity
- [x] Large exports are processed asynchronously
- [x] Download URLs are secure and time-limited
- [x] Export history is tracked per workspace
- [x] Proper error handling for failed exports

##### Implementation Details
```typescript
// src/analytics/services/export.service.ts
@Injectable()
export class ExportService {
  private readonly exportStorage = new Map<string, ExportJob>();
  
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly timeSeriesService: TimeSeriesService,
    private readonly logger: MercurioLogger,
  ) {}

  async createExport(
    tenantContext: TenantContext,
    request: ExportRequestDto,
  ): Promise<ExportResponse> {
    const exportId = `exp_${this.generateId()}`;
    
    const job: ExportJob = {
      exportId,
      tenantContext,
      request,
      status: 'processing',
      createdAt: new Date(),
    };

    this.exportStorage.set(exportId, job);
    
    // Process export asynchronously
    this.processExport(job).catch(error => {
      this.logger.error('Export processing failed', error, {
        exportId,
        tenantId: tenantContext.tenantId.toString(),
        workspaceId: tenantContext.workspaceId.toString(),
      });
      
      job.status = 'failed';
      job.error = error.message;
    });

    return {
      export_id: exportId,
      status: 'processing',
      created_at: job.createdAt.toISOString(),
      format: request.format,
    };
  }

  async getExportStatus(exportId: string): Promise<ExportResponse> {
    const job = this.exportStorage.get(exportId);
    
    if (!job) {
      throw new NotFoundException({
        error: {
          code: 'export_not_found',
          message: 'Export job not found',
          details: { export_id: exportId },
        },
      });
    }

    const response: ExportResponse = {
      export_id: exportId,
      status: job.status,
      created_at: job.createdAt.toISOString(),
      format: job.request.format,
    };

    if (job.status === 'completed') {
      response.download_url = `/v1/analytics/export/${exportId}/download`;
      response.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      response.estimated_size = job.fileSize ? this.formatFileSize(job.fileSize) : undefined;
      response.record_count = job.recordCount;
    }

    return response;
  }

  private async processExport(job: ExportJob): Promise<void> {
    try {
      let data: any;
      
      // Get data based on dataset type
      switch (job.request.dataset) {
        case 'overview':
          data = await this.analyticsService.getOverviewMetrics(
            job.tenantContext,
            job.request as any,
          );
          break;
          
        case 'timeseries':
          data = await this.timeSeriesService.getTimeSeriesData(
            job.tenantContext,
            job.request as any,
          );
          break;
          
        case 'events':
          data = await this.getEventDetailsForExport(job.tenantContext, job.request);
          break;
          
        default:
          throw new Error(`Unsupported dataset: ${job.request.dataset}`);
      }

      // Convert to requested format
      const content = job.request.format === 'csv' 
        ? this.convertToCSV(data)
        : JSON.stringify(data, null, 2);

      // Store content (in production, this would be stored in cloud storage)
      job.content = content;
      job.fileSize = Buffer.byteLength(content, 'utf8');
      job.recordCount = this.getRecordCount(data);
      job.status = 'completed';
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      throw error;
    }
  }

  private convertToCSV(data: any): string {
    if (data.events && Array.isArray(data.events)) {
      return this.eventsToCSV(data.events);
    } else if (data.data && Array.isArray(data.data)) {
      return this.timeSeriesToCSV(data.data);
    } else if (data.metrics) {
      return this.overviewToCSV(data);
    }
    
    throw new Error('Unsupported data structure for CSV conversion');
  }

  private eventsToCSV(events: any[]): string {
    if (events.length === 0) return '';
    
    const headers = Object.keys(events[0]);
    const rows = events.map(event => 
      headers.map(header => {
        const value = event[header];
        // Escape CSV values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  async downloadExport(
    exportId: string,
    tenantContext: TenantContext,
  ): Promise<{ content: string; filename: string; contentType: string }> {
    const job = this.exportStorage.get(exportId);
    
    if (!job) {
      throw new NotFoundException('Export not found');
    }

    // Verify tenant access
    if (job.tenantContext.tenantId !== tenantContext.tenantId ||
        job.tenantContext.workspaceId !== tenantContext.workspaceId) {
      throw new ForbiddenException('Access denied');
    }

    if (job.status !== 'completed') {
      throw new BadRequestException({
        error: {
          code: 'export_not_ready',
          message: 'Export is not ready for download',
          details: { status: job.status },
        },
      });
    }

    const extension = job.request.format;
    const filename = `analytics_${job.request.dataset}_${job.exportId}.${extension}`;
    const contentType = extension === 'csv' ? 'text/csv' : 'application/json';

    return {
      content: job.content!,
      filename,
      contentType,
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}

interface ExportJob {
  exportId: string;
  tenantContext: TenantContext;
  request: ExportRequestDto;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
  content?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
}
```

##### Testing Requirements
- Unit tests for export processing and format conversion
- Integration tests for full export workflow
- Security tests for access control
- Large dataset performance tests

##### Dependencies
- All analytics services for data retrieval
- File storage service for production deployment

---

### Phase 4: Testing and Documentation (Week 3-4)

#### ANLT-012: Comprehensive Testing Suite
**Priority**: Critical  
**Complexity**: High  
**Estimated Effort**: 3 days

##### Description
Create comprehensive test suite covering unit tests, integration tests, and performance validation for all analytics functionality.

##### Technical Requirements
- Unit tests for all service methods (>90% coverage)
- Integration tests for multi-tenant scenarios
- Performance tests for response time validation
- Load tests for concurrent request handling

##### Acceptance Criteria
- [ ] Unit test coverage >90% for all analytics modules
- [ ] Integration tests cover multi-tenant isolation
- [ ] Performance tests validate response time targets
- [ ] Load tests confirm concurrent request handling
- [ ] All edge cases and error scenarios are tested
- [ ] Tests run successfully in CI/CD pipeline

##### Implementation Details
```typescript
// src/analytics/__tests__/analytics.service.spec.ts
describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repository: AnalyticsRepository;
  let cache: AnalyticsCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: AnalyticsRepository,
          useValue: createMockRepository(),
        },
        {
          provide: AnalyticsCacheService,
          useValue: createMockCache(),
        },
        {
          provide: MercurioLogger,
          useValue: createMockLogger(),
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    repository = module.get<AnalyticsRepository>(AnalyticsRepository);
    cache = module.get<AnalyticsCacheService>(AnalyticsCacheService);
  });

  describe('getOverviewMetrics', () => {
    it('should return cached result when available', async () => {
      const cachedResult = createMockOverviewResponse();
      jest.spyOn(cache, 'get').mockResolvedValue(cachedResult);
      
      const result = await service.getOverviewMetrics(mockTenantContext, mockQuery);
      
      expect(result).toEqual(cachedResult);
      expect(repository.getOverviewMetrics).not.toHaveBeenCalled();
    });

    it('should calculate metrics and cache result when cache miss', async () => {
      jest.spyOn(cache, 'get').mockResolvedValue(null);
      const dbResult = createMockOverviewMetrics();
      jest.spyOn(repository, 'getOverviewMetrics').mockResolvedValue(dbResult);
      
      const result = await service.getOverviewMetrics(mockTenantContext, mockQuery);
      
      expect(repository.getOverviewMetrics).toHaveBeenCalledTimes(2); // current + previous
      expect(cache.set).toHaveBeenCalledWith(expect.any(String), result, expect.any(Number));
    });

    it('should enforce tenant isolation in queries', async () => {
      jest.spyOn(cache, 'get').mockResolvedValue(null);
      
      await service.getOverviewMetrics(mockTenantContext, mockQuery);
      
      expect(repository.getOverviewMetrics).toHaveBeenCalledWith(
        mockTenantContext.tenantId,
        mockTenantContext.workspaceId,
        expect.any(Date),
        expect.any(Date),
      );
    });
  });

  describe('buildComparisons', () => {
    it('should calculate percentage change correctly', () => {
      const current = { total_events: 120, unique_visitors: 50 };
      const previous = { total_events: 100, unique_visitors: 60 };
      
      const comparisons = (service as any).buildComparisons(current, previous);
      
      expect(comparisons.total_events.change_pct).toBe(20);
      expect(comparisons.unique_visitors.change_pct).toBe(-16.67);
    });

    it('should handle zero previous values', () => {
      const current = { total_events: 100 };
      const previous = { total_events: 0 };
      
      const comparisons = (service as any).buildComparisons(current, previous);
      
      expect(comparisons.total_events.change_pct).toBe(100);
      expect(comparisons.total_events.direction).toBe('up');
    });
  });
});

// Integration tests
// src/analytics/__tests__/analytics.integration.spec.ts
describe('Analytics Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantContext: TenantContext;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get<PrismaService>(PrismaService);
    
    // Set up test tenant and data
    tenantContext = await setupTestTenant(prisma);
    await seedAnalyticsTestData(prisma, tenantContext);
  });

  afterAll(async () => {
    await cleanupTestData(prisma, tenantContext);
    await app.close();
  });

  describe('Multi-tenant isolation', () => {
    it('should only return data for the specified tenant', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/analytics/overview')
        .set('Authorization', `Bearer ${tenantContext.apiKey}`)
        .query({ period: '7d' })
        .expect(200);

      // Verify response contains only tenant's data
      expect(response.body.metrics.total_events).toBeGreaterThan(0);
      
      // Verify no data leakage by checking another tenant doesn't see this data
      const otherTenantResponse = await request(app.getHttpServer())
        .get('/v1/analytics/overview')
        .set('Authorization', `Bearer ${otherTenantContext.apiKey}`)
        .query({ period: '7d' })
        .expect(200);

      expect(otherTenantResponse.body.metrics.total_events).not.toBe(
        response.body.metrics.total_events
      );
    });
  });

  describe('Performance tests', () => {
    it('should respond within performance targets', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/v1/analytics/overview')
        .set('Authorization', `Bearer ${tenantContext.apiKey}`)
        .query({ period: '30d' })
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // p95 target
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(0).map(() =>
        request(app.getHttpServer())
          .get('/v1/analytics/overview')
          .set('Authorization', `Bearer ${tenantContext.apiKey}`)
          .query({ period: '7d' })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time even under load
      expect(duration).toBeLessThan(2000);
    });
  });
});
```

##### Testing Requirements
- Complete test coverage for all scenarios
- Performance benchmarking and validation
- Multi-tenant security validation
- Error handling verification

##### Dependencies
- Jest testing framework
- Supertest for API testing
- Test database setup utilities

---

#### ANLT-013: API Documentation and Examples
**Priority**: High  
**Complexity**: Low  
**Estimated Effort**: 2 days

##### Description
Create comprehensive API documentation with request/response examples, error codes, and usage guidelines.

##### Technical Requirements
- Document all endpoint specifications
- Provide request/response examples for each endpoint
- Include error code reference
- Create Postman collection for testing

##### Acceptance Criteria
- [x] All endpoints are fully documented with examples
- [x] Error responses are documented with codes and solutions
- [x] Postman collection includes all endpoints with sample data
- [x] Documentation follows existing API documentation patterns
- [x] Usage guidelines and rate limits are clearly explained

##### Implementation Details
```markdown
# Analytics API Documentation

## Overview
The Analytics API provides comprehensive insights into user behavior and event data for traffic managers using the Mercurio platform.

### Authentication
All analytics endpoints require authentication using API keys with appropriate scopes:
- `analytics:read` - Read access to analytics data
- `analytics:export` - Export analytics data

### Rate Limits
- 100 requests per minute per workspace
- 1,000 requests per hour per workspace

### Base URL
```
https://api.mercurio.com/v1/analytics
```

## Endpoints

### GET /overview
Get high-level aggregate metrics for a workspace.

**Required Scopes:** `analytics:read`

**Query Parameters:**
- `period` (required): Time period - `24h`, `7d`, `30d`, or `custom`
- `start_date` (conditional): ISO8601 datetime, required if `period=custom`
- `end_date` (conditional): ISO8601 datetime, required if `period=custom`  
- `timezone` (optional): Timezone name, defaults to `UTC`

**Example Request:**
```bash
curl -X GET "https://api.mercurio.com/v1/analytics/overview?period=7d" \
  -H "Authorization: Bearer ak_your_api_key_here"
```

**Example Response:**
```json
{
  "period": {
    "type": "7d",
    "start": "2025-08-20T00:00:00Z",
    "end": "2025-08-26T23:59:59Z",
    "timezone": "UTC"
  },
  "metrics": {
    "total_events": 45678,
    "unique_visitors": 3456,
    "total_sessions": 4567,
    "conversion_rate": 2.34,
    "bounce_rate": 45.67,
    "avg_session_duration": 324.5,
    "top_event": "page_view"
  },
  "comparisons": {
    "total_events": {
      "value": 45678,
      "change_pct": 12.5,
      "previous": 40603,
      "direction": "up"
    }
  }
}
```
```

##### Testing Requirements
- Documentation accuracy validation
- Postman collection functionality testing
- Example request/response verification

##### Dependencies
- API specification completion
- Working endpoints for example generation

---

#### ANLT-014: Performance Optimization and Monitoring
**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2 days

##### Description
Implement performance monitoring, query optimization strategies, and caching improvements to meet performance targets.

##### Technical Requirements
- Add performance metrics collection
- Implement query optimization strategies
- Configure cache warming for common queries
- Set up alerting for performance degradation

##### Acceptance Criteria
- [ ] Performance metrics are collected for all endpoints
- [ ] Query optimization achieves target response times
- [ ] Cache hit rates meet >90% target for common queries
- [ ] Monitoring alerts are configured for slow queries
- [ ] Database query plans are optimized

##### Implementation Details
```typescript
// src/analytics/services/performance-monitor.service.ts
@Injectable()
export class PerformanceMonitorService {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly logger: MercurioLogger,
  ) {}

  async recordAnalyticsMetrics(
    endpoint: string,
    duration: number,
    tenantId: string,
    cacheHit: boolean,
    resultCount?: number,
  ): Promise<void> {
    // Record performance metrics
    this.metricsService.recordLatency(`analytics.${endpoint}.duration`, duration);
    this.metricsService.recordCounter(`analytics.${endpoint}.requests`, 1, {
      tenant_id: tenantId,
      cache_hit: cacheHit.toString(),
    });

    if (resultCount !== undefined) {
      this.metricsService.recordGauge(`analytics.${endpoint}.result_count`, resultCount);
    }

    // Alert on performance degradation
    if (duration > 1000) { // > 1 second
      this.metricsService.recordCounter('analytics.slow_query', 1, {
        endpoint,
        tenant_id: tenantId,
      });
      
      this.logger.warn('Slow analytics query detected', {
        endpoint,
        duration,
        tenantId,
        threshold: 1000,
      });
    }
  }

  async warmCache(): Promise<void> {
    // Implement cache warming for common queries
    this.logger.log('Starting analytics cache warming');
    
    // Cache common overview metrics for active tenants
    const activeTenants = await this.getActiveTenants();
    
    for (const tenant of activeTenants) {
      try {
        await this.warmTenantCache(tenant);
      } catch (error) {
        this.logger.warn('Cache warming failed for tenant', {
          tenantId: tenant.id,
          error: error.message,
        });
      }
    }
    
    this.logger.log('Analytics cache warming completed');
  }

  private async warmTenantCache(tenant: any): Promise<void> {
    const commonQueries = [
      { period: '24h' },
      { period: '7d' },
      { period: '30d' },
    ];

    for (const query of commonQueries) {
      // Pre-load overview metrics
      // This would trigger the analytics service which will cache the results
      // Implementation depends on having access to the analytics service
    }
  }
}
```

##### Testing Requirements
- Performance benchmark validation
- Cache warming effectiveness testing
- Monitoring alert functionality verification

##### Dependencies
- Existing metrics infrastructure
- Database performance analysis tools

---

## Risk Assessment and Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation Strategy |
|------|---------|-------------|-------------------|
| **Query Performance Degradation** | High | Medium | - Implement query optimization with existing indexes<br>- Add result caching with appropriate TTLs<br>- Monitor query execution plans<br>- Implement query timeouts |
| **Large Result Set Memory Issues** | Medium | High | - Implement pagination for all endpoints<br>- Set maximum result limits with validation<br>- Use streaming for large exports<br>- Monitor memory usage patterns |
| **Cache Inconsistency** | Medium | Low | - Implement proper cache invalidation strategies<br>- Use cache versioning for schema changes<br>- Monitor cache hit rates and freshness<br>- Implement cache warming strategies |
| **Multi-Tenant Data Leakage** | High | Low | - Enforce tenant isolation at all query levels<br>- Comprehensive integration testing<br>- Audit logging for all data access<br>- Regular security reviews |

### Performance Risk Mitigation

```typescript
@Injectable()
export class PerformanceGuardService {
  private readonly maxQueryTimeMs = 30000; // 30 seconds
  private readonly maxResultSetSize = 100000; // 100k records
  
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = this.maxQueryTimeMs,
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      ),
    ]);
  }

  validateResultSize(count: number): void {
    if (count > this.maxResultSetSize) {
      throw new BadRequestException({
        error: {
          code: 'result_set_too_large',
          message: `Result set exceeds maximum size of ${this.maxResultSetSize} records`,
          details: {
            requested: count,
            maximum: this.maxResultSetSize,
            suggestion: 'Use pagination or apply more specific filters',
          },
        },
      });
    }
  }
}
```

---

## Definition of Done

### Code Quality Requirements
- [ ] All code follows TypeScript strict mode
- [ ] ESLint passes without warnings or errors
- [ ] Code follows existing patterns and conventions
- [ ] Comprehensive error handling implemented
- [ ] Proper logging integrated throughout

### Testing Requirements
- [ ] Unit test coverage >90% for all analytics modules
- [ ] Integration tests cover multi-tenant scenarios
- [ ] Performance tests validate response time targets
- [ ] Load tests confirm concurrent request handling
- [ ] Security tests verify tenant isolation

### Performance Requirements
- [ ] p50 response time < 100ms for all endpoints
- [ ] p95 response time < 500ms for all endpoints
- [ ] Cache hit rate >90% for common queries
- [ ] No memory leaks under sustained load
- [ ] Database query optimization verified

### Security Requirements
- [ ] Multi-tenant data isolation enforced and tested
- [ ] PII data properly anonymized in responses
- [ ] API key scopes properly validated
- [ ] Rate limiting configured and tested
- [ ] Audit logging implemented for all operations

### Documentation Requirements
- [ ] API documentation complete with examples
- [ ] Postman collection created and tested
- [ ] Error code reference documented
- [ ] Usage guidelines provided
- [ ] Internal code documentation complete

### Deployment Requirements
- [ ] Database migrations created (if needed)
- [ ] Environment variables documented
- [ ] Production deployment checklist complete
- [ ] Monitoring and alerting configured
- [ ] Performance baselines established

---

## Success Metrics

### Technical KPIs
- **Response Time**: p50 < 100ms, p95 < 500ms achieved consistently
- **Cache Hit Rate**: >90% for frequently accessed metrics
- **Query Performance**: All database queries complete within 10 seconds
- **Error Rate**: <1% error rate across all analytics endpoints
- **Test Coverage**: >90% code coverage with comprehensive integration tests

### Business KPIs
- **API Adoption**: >80% of active workspaces use analytics endpoints within 30 days
- **Query Volume**: Support 10,000+ analytics queries per day
- **User Satisfaction**: Positive feedback on data accuracy and response times
- **Export Usage**: Export functionality used by >50% of workspaces

### Monitoring Dashboard Metrics

```typescript
export interface AnalyticsDashboardMetrics {
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  caching: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    memoryUsage: number;
  };
  database: {
    queryDuration: number;
    connectionPoolUsage: number;
    slowQueryCount: number;
  };
  business: {
    dailyActiveWorkspaces: number;
    totalQueriesProcessed: number;
    exportJobsCompleted: number;
    dataAccuracy: number;
  };
}
```

---

This comprehensive task document provides the roadmap for implementing robust analytics endpoints that meet the performance, security, and scalability requirements of the Mercurio platform while following established architectural patterns and best practices.
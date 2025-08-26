import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import { HybridAuthGuard } from '../../common/auth/hybrid-auth.guard';
import { CurrentTenant } from '../../common/context/tenant-context.provider';
import type { HybridTenantContext } from '../../common/types/tenant-context.type';
import { ApiKeyService } from '../../common/auth/api-key.service';
import {
  PeriodQueryDto,
  TimeSeriesQueryDto,
  TopEventsQueryDto,
  UserAnalyticsQueryDto,
  EventDetailsQueryDto,
  ExportRequestDto,
} from '../dto/query.dto';
import {
  OverviewMetricsResponse,
  TimeSeriesResponse,
  TopEventsResponse,
  UserAnalyticsResponse,
  EventDetailsResponse,
  ExportResponse,
} from '../dto/response.dto';
import { MetricsService } from '../../common/services/metrics.service';

@Controller('v1/analytics')
@UseGuards(HybridAuthGuard)
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly metrics: MetricsService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  /**
   * Record analytics metrics for endpoint performance
   */
  private recordMetrics(
    endpoint: string,
    duration: number,
    tenantId: string,
    cacheHit: boolean = false,
    resultCount?: number,
  ): void {
    // Increment endpoint request counter
    this.metrics.incrementCounter(`analytics.${endpoint}_requests`);
    
    // Record query latency
    this.metrics.recordLatency('analytics.query_latency', duration);
    
    // Record cache metrics
    if (cacheHit) {
      this.metrics.incrementCounter('analytics.cache_hits');
    } else {
      this.metrics.incrementCounter('analytics.cache_misses');
    }

    // Alert on slow queries
    if (duration > 1000) {
      this.metrics.incrementCounter('analytics.slow_queries');
      this.logger.warn('Slow analytics query detected', {
        endpoint,
        duration,
        tenantId,
        threshold: 1000,
        performance_alert: true,
      });
    }

    // Log performance data
    this.logger.log('Analytics performance metrics recorded', {
      endpoint,
      duration,
      tenantId,
      cacheHit,
      resultCount,
      slow_query: duration > 1000,
    });
  }

  /**
   * GET /v1/analytics/overview
   * Get overview metrics with period comparisons
   */
  @Get('overview')
  @HttpCode(HttpStatus.OK)
  async getOverview(
    @Query() query: PeriodQueryDto,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<OverviewMetricsResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new Error('Read permission required for analytics overview');
    }
    const startTime = Date.now();

    try {
      const result = await this.analyticsService.getOverviewMetrics(
        tenant.tenantId,
        tenant.workspaceId,
        query,
      );

      const duration = Date.now() - startTime;
      
      // Record performance metrics
      this.recordMetrics('overview', duration, tenant.tenantId.toString(), false);

      this.logger.log('Overview metrics retrieved', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        period: query.period,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Still record metrics for failed requests
      this.recordMetrics('overview', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to get overview metrics', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * GET /v1/analytics/timeseries
   * Get time-series data with configurable granularity
   */
  @Get('timeseries')
  @HttpCode(HttpStatus.OK)
  async getTimeSeries(
    @Query() query: TimeSeriesQueryDto,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<TimeSeriesResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new Error('Read permission required for time-series data');
    }
    const startTime = Date.now();

    try {
      const result = await this.analyticsService.getTimeSeries(
        tenant.tenantId,
        tenant.workspaceId,
        query,
      );

      const duration = Date.now() - startTime;
      
      // Record performance metrics
      this.recordMetrics('timeseries', duration, tenant.tenantId.toString(), false, result.data.length);

      this.logger.log('Time-series data retrieved', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        granularity: query.granularity,
        metrics: query.metrics,
        dataPoints: result.data.length,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Still record metrics for failed requests
      this.recordMetrics('timeseries', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to get time-series data', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * GET /v1/analytics/events/top
   * Get top events with trends and rankings
   */
  @Get('events/top')
  @HttpCode(HttpStatus.OK)
  async getTopEvents(
    @Query() query: TopEventsQueryDto,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<TopEventsResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new Error('Read permission required for top events');
    }
    const startTime = Date.now();

    try {
      const result = await this.analyticsService.getTopEvents(
        tenant.tenantId,
        tenant.workspaceId,
        query,
      );

      const duration = Date.now() - startTime;
      
      // Record performance metrics
      this.recordMetrics('top_events', duration, tenant.tenantId.toString(), false, result.events?.length);

      this.logger.log('Top events retrieved', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        eventCount: result.events.length,
        totalEvents: result.total_events,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Still record metrics for failed requests
      this.recordMetrics('top_events', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to get top events', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * GET /v1/analytics/users
   * Get user analytics with activity levels and conversion funnels
   */
  @Get('users')
  @HttpCode(HttpStatus.OK)
  async getUserAnalytics(
    @Query() query: UserAnalyticsQueryDto,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<UserAnalyticsResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new Error('Read permission required for user analytics');
    }
    const startTime = Date.now();

    try {
      const result = await this.analyticsService.getUserAnalytics(
        tenant.tenantId,
        tenant.workspaceId,
        query,
      );

      const duration = Date.now() - startTime;
      
      // Record performance metrics
      this.recordMetrics('users', duration, tenant.tenantId.toString(), false);

      this.logger.log('User analytics retrieved', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        totalVisitors: result.summary.total_visitors,
        identificationRate: result.summary.identification_rate,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Still record metrics for failed requests
      this.recordMetrics('users', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to get user analytics', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * GET /v1/analytics/events/details
   * Get detailed event data with filtering and pagination
   */
  @Get('events/details')
  @HttpCode(HttpStatus.OK)
  async getEventDetails(
    @Query() query: EventDetailsQueryDto,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<EventDetailsResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new Error('Read permission required for event details');
    }
    const startTime = Date.now();

    try {
      const result = await this.analyticsService.getEventDetails(
        tenant.tenantId,
        tenant.workspaceId,
        query,
      );

      const duration = Date.now() - startTime;
      
      // Record performance metrics
      this.recordMetrics('details', duration, tenant.tenantId.toString(), false, result.events?.length);

      this.logger.log('Event details retrieved', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        eventCount: result.events.length,
        totalCount: result.pagination.total_count,
        page: query.page,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Still record metrics for failed requests
      this.recordMetrics('details', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to get event details', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * GET /v1/analytics/export
   * Request data export in various formats
   */
  @Get('export')
  @HttpCode(HttpStatus.ACCEPTED)
  async exportData(
    @Query() query: ExportRequestDto,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<ExportResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new Error('Read permission required for data export');
    }
    const startTime = Date.now();

    try {
      const result = await this.analyticsService.exportData(
        tenant.tenantId,
        tenant.workspaceId,
        query,
      );

      const duration = Date.now() - startTime;
      
      // Record performance metrics
      this.recordMetrics('export', duration, tenant.tenantId.toString(), false);

      this.logger.log('Export requested', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        exportId: result.export_id,
        dataType: query.dataset,
        format: query.format,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Still record metrics for failed requests  
      this.recordMetrics('export', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to request export', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * GET /v1/analytics/exports/:exportId
   * Check export status and get download link
   */
  @Get('exports/:exportId')
  @HttpCode(HttpStatus.OK)
  async getExportStatus(
    @Param('exportId') exportId: string,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<ExportResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new Error('Read permission required for export status');
    }
    const startTime = Date.now();

    try {
      const result = await this.analyticsService.getExportStatus(
        tenant.tenantId,
        tenant.workspaceId,
        exportId,
      );

      this.logger.log('Export status retrieved', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        exportId,
        status: result.status,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to get export status', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        exportId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }
}
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { TimeSeriesService } from './time-series.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';
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
import { PeriodUtils } from '../utils/period.utils';
import { TimezoneUtils } from '../utils/timezone.utils';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly metricsService: MetricsService,
    private readonly timeSeriesService: TimeSeriesService,
    private readonly cacheService: AnalyticsCacheService,
    private readonly analyticsRepository: AnalyticsRepository,
  ) {}

  /**
   * Get overview metrics with comparisons
   */
  async getOverviewMetrics(
    tenantId: bigint,
    workspaceId: bigint,
    query: PeriodQueryDto,
  ): Promise<OverviewMetricsResponse> {
    // Validate inputs
    this.validateTenantWorkspace(tenantId, workspaceId);
    this.validateTimezone(query.timezone);

    // Build cache key
    const cacheKey = this.cacheService.buildCacheKey(
      'overview',
      tenantId.toString(),
      workspaceId.toString(),
      {
        period: query.period,
        startDate: query.startDate?.toISOString(),
        endDate: query.endDate?.toISOString(),
        timezone: query.timezone,
      },
    );

    // Try cache first
    const { start: startDate, end: endDate } = PeriodUtils.calculatePeriod(
      query.period,
      query.startDate,
      query.endDate,
      query.timezone,
    );

    if (this.cacheService.shouldCache(query.period, startDate, endDate)) {
      const cached = await this.cacheService.get<OverviewMetricsResponse>(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached overview metrics', { tenantId, workspaceId });
        return cached;
      }
    }

    // Calculate metrics
    const startTime = Date.now();
    const result = await this.metricsService.calculateOverviewMetrics(
      tenantId,
      workspaceId,
      query,
    );

    const duration = Date.now() - startTime;
    this.logger.log('Overview metrics calculated', {
      tenantId,
      workspaceId,
      duration,
      period: query.period,
    });

    // Cache the result
    if (this.cacheService.shouldCache(query.period, startDate, endDate)) {
      const ttl = this.cacheService.getCacheTTL(query.period, 'overview');
      await this.cacheService.set(cacheKey, result, ttl);
    }

    return result;
  }

  /**
   * Get time-series data
   */
  async getTimeSeries(
    tenantId: bigint,
    workspaceId: bigint,
    query: TimeSeriesQueryDto,
  ): Promise<TimeSeriesResponse> {
    // Validate inputs
    this.validateTenantWorkspace(tenantId, workspaceId);
    this.validateTimezone(query.timezone);
    this.timeSeriesService.validateMetrics(query.metrics);

    // Build cache key
    const cacheKey = this.cacheService.buildCacheKey(
      'timeseries',
      tenantId.toString(),
      workspaceId.toString(),
      {
        period: query.period,
        startDate: query.startDate?.toISOString(),
        endDate: query.endDate?.toISOString(),
        granularity: query.granularity,
        metrics: query.metrics.sort(), // Sort for consistent caching
        timezone: query.timezone,
      },
    );

    // Try cache first
    const { start: startDate, end: endDate } = PeriodUtils.calculatePeriod(
      query.period,
      query.startDate,
      query.endDate,
      query.timezone,
    );

    if (this.cacheService.shouldCache(query.period, startDate, endDate)) {
      const cached = await this.cacheService.get<TimeSeriesResponse>(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached time series', { tenantId, workspaceId });
        return cached;
      }
    }

    // Generate time series
    const startTime = Date.now();
    const result = await this.timeSeriesService.generateTimeSeries(
      tenantId,
      workspaceId,
      query,
    );

    const duration = Date.now() - startTime;
    const dataPointCount = result.data.length;
    
    this.logger.log('Time series generated', {
      tenantId,
      workspaceId,
      duration,
      dataPoints: dataPointCount,
      granularity: query.granularity,
    });

    // Cache the result
    if (this.cacheService.shouldCache(query.period, startDate, endDate)) {
      const ttl = this.cacheService.getCacheTTL(query.period, 'timeseries');
      await this.cacheService.set(cacheKey, result, ttl);
    }

    return result;
  }

  /**
   * Get top events
   */
  async getTopEvents(
    tenantId: bigint,
    workspaceId: bigint,
    query: TopEventsQueryDto,
  ): Promise<TopEventsResponse> {
    // Validate inputs
    this.validateTenantWorkspace(tenantId, workspaceId);
    this.validateTimezone(query.timezone);
    this.validateLimit(query.limit, 50);

    // Build cache key
    const cacheKey = this.cacheService.buildCacheKey(
      'events-top',
      tenantId.toString(),
      workspaceId.toString(),
      {
        period: query.period,
        startDate: query.startDate?.toISOString(),
        endDate: query.endDate?.toISOString(),
        limit: query.limit,
        timezone: query.timezone,
      },
    );

    // Try cache first
    const { start: startDate, end: endDate } = PeriodUtils.calculatePeriod(
      query.period,
      query.startDate,
      query.endDate,
      query.timezone,
    );

    if (this.cacheService.shouldCache(query.period, startDate, endDate)) {
      const cached = await this.cacheService.get<TopEventsResponse>(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached top events', { tenantId, workspaceId });
        return cached;
      }
    }

    // Calculate top events
    const startTime = Date.now();
    const result = await this.metricsService.calculateTopEvents(
      tenantId,
      workspaceId,
      query,
    );

    const duration = Date.now() - startTime;
    this.logger.log('Top events calculated', {
      tenantId,
      workspaceId,
      duration,
      eventCount: result.events.length,
    });

    // Cache the result
    if (this.cacheService.shouldCache(query.period, startDate, endDate)) {
      const ttl = this.cacheService.getCacheTTL(query.period, 'events-top');
      await this.cacheService.set(cacheKey, result, ttl);
    }

    return result;
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(
    tenantId: bigint,
    workspaceId: bigint,
    query: UserAnalyticsQueryDto,
  ): Promise<UserAnalyticsResponse> {
    // Validate inputs
    this.validateTenantWorkspace(tenantId, workspaceId);
    this.validateTimezone(query.timezone);

    // Build cache key
    const cacheKey = this.cacheService.buildCacheKey(
      'users',
      tenantId.toString(),
      workspaceId.toString(),
      {
        period: query.period,
        startDate: query.startDate?.toISOString(),
        endDate: query.endDate?.toISOString(),
        segment: query.segment,
        timezone: query.timezone,
      },
    );

    // Try cache first
    const { start: startDate, end: endDate } = PeriodUtils.calculatePeriod(
      query.period,
      query.startDate,
      query.endDate,
      query.timezone,
    );

    if (this.cacheService.shouldCache(query.period, startDate, endDate)) {
      const cached = await this.cacheService.get<UserAnalyticsResponse>(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached user analytics', { tenantId, workspaceId });
        return cached;
      }
    }

    // Calculate user analytics
    const startTime = Date.now();
    const result = await this.metricsService.calculateUserAnalytics(
      tenantId,
      workspaceId,
      query,
    );

    const duration = Date.now() - startTime;
    this.logger.log('User analytics calculated', {
      tenantId,
      workspaceId,
      duration,
      totalVisitors: result.summary.total_visitors,
    });

    // Cache the result
    if (this.cacheService.shouldCache(query.period, startDate, endDate)) {
      const ttl = this.cacheService.getCacheTTL(query.period, 'users');
      await this.cacheService.set(cacheKey, result, ttl);
    }

    return result;
  }

  /**
   * Get event details with filtering and pagination
   */
  async getEventDetails(
    tenantId: bigint,
    workspaceId: bigint,
    query: EventDetailsQueryDto,
  ): Promise<EventDetailsResponse> {
    // Validate inputs
    this.validateTenantWorkspace(tenantId, workspaceId);
    this.validateTimezone(query.timezone);
    this.validatePagination(query.page, query.limit);

    // Event details are typically not cached due to frequent changes and specific filtering
    const { start: startDate, end: endDate } = PeriodUtils.calculatePeriod(
      query.period,
      query.startDate,
      query.endDate,
      query.timezone,
    );

    // Get event details
    const startTime = Date.now();
    const { events, totalCount } = await this.analyticsRepository.getEventDetails(
      tenantId,
      workspaceId,
      startDate,
      endDate,
      {
        eventName: query.event_name,
        anonymousId: query.anonymous_id,
        leadId: query.lead_id,
        sessionId: query.session_id,
        hasLead: query.has_lead,
      },
      {
        page: query.page || 1,
        limit: query.limit || 50,
        sortBy: query.sort_by || 'timestamp',
        sortOrder: query.sort_order || 'desc',
      },
    );

    const duration = Date.now() - startTime;
    this.logger.log('Event details retrieved', {
      tenantId,
      workspaceId,
      duration,
      eventCount: events.length,
      totalCount,
      page: query.page,
    });

    // Calculate pagination info
    const page = query.page || 1;
    const limit = query.limit || 50;
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      period: PeriodUtils.createPeriodInfo(
        query.period,
        startDate,
        endDate,
        query.timezone || 'UTC',
      ),
      events,
      pagination: {
        page,
        limit,
        total_count: totalCount,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_previous_page: hasPreviousPage,
      },
      filters: {
        event_name: query.event_name,
        anonymous_id: query.anonymous_id,
        lead_id: query.lead_id,
        session_id: query.session_id,
        has_lead: query.has_lead,
      },
    };
  }

  /**
   * Export analytics data
   */
  async exportData(
    tenantId: bigint,
    workspaceId: bigint,
    query: ExportRequestDto,
  ): Promise<ExportResponse> {
    // Validate inputs
    this.validateTenantWorkspace(tenantId, workspaceId);
    this.validateTimezone(query.timezone);

    // Generate export ID
    const exportId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log('Export requested', {
      exportId,
      tenantId,
      workspaceId,
      dataType: query.dataset,
      format: query.format,
    });

    // For now, return immediate response indicating async processing
    // In a real implementation, this would queue a background job
    return {
      export_id: exportId,
      status: 'processing',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      format: query.format,
    };
  }

  /**
   * Get export status
   */
  async getExportStatus(
    tenantId: bigint,
    workspaceId: bigint,
    exportId: string,
  ): Promise<ExportResponse> {
    // Validate inputs
    this.validateTenantWorkspace(tenantId, workspaceId);

    if (!exportId.startsWith('exp_')) {
      throw new BadRequestException('Invalid export ID format');
    }

    // In a real implementation, this would check a database or queue system
    // For now, simulate completion
    const isRecent = exportId.includes(Date.now().toString().substr(0, 10));
    
    if (isRecent) {
      return {
        export_id: exportId,
        status: 'completed',
        download_url: `/v1/analytics/exports/${exportId}/download`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
        format: 'json', // Default format
      };
    }

    throw new NotFoundException('Export not found or expired');
  }

  /**
   * Clear analytics cache for tenant/workspace
   */
  async clearCache(tenantId: bigint, workspaceId: bigint): Promise<void> {
    await this.cacheService.clearTenantCache(
      tenantId.toString(),
      workspaceId.toString(),
    );

    this.logger.log('Analytics cache cleared', { tenantId, workspaceId });
  }

  // Validation helpers
  private validateTenantWorkspace(tenantId: bigint, workspaceId: bigint): void {
    if (!tenantId || tenantId <= 0) {
      throw new BadRequestException('Invalid tenant ID');
    }
    if (!workspaceId || workspaceId <= 0) {
      throw new BadRequestException('Invalid workspace ID');
    }
  }

  private validateTimezone(timezone: string | undefined): void {
    const tz = timezone || 'UTC';
    if (!TimezoneUtils.isValidTimezone(tz)) {
      throw new BadRequestException(`Invalid timezone: ${tz}`);
    }
  }

  private validateLimit(limit: number | undefined, max: number = 100): void {
    const l = limit || 10;
    if (l < 1 || l > max) {
      throw new BadRequestException(`Limit must be between 1 and ${max}`);
    }
  }

  private validatePagination(page: number | undefined, limit: number | undefined): void {
    const p = page || 1;
    const l = limit || 50;
    if (p < 1) {
      throw new BadRequestException('Page must be >= 1');
    }
    if (l < 1 || l > 1000) {
      throw new BadRequestException('Limit must be between 1 and 1000');
    }
  }
}
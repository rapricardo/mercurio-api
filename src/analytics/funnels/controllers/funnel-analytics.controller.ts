import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { FunnelAnalyticsService } from '../services/funnel-analytics.service'
import { BottleneckDetectionService } from '../services/bottleneck-detection.service'
import { FunnelPathAnalysisService } from '../services/funnel-path-analysis.service'
import { FunnelAttributionService } from '../services/funnel-attribution.service'
import { FunnelComparisonService } from '../services/funnel-comparison.service'
import { FunnelExportService } from '../services/funnel-export.service'
import { HybridAuthGuard } from '../../../common/auth/hybrid-auth.guard'
import { CurrentTenant } from '../../../common/context/tenant-context.provider'
import { HybridTenantContext } from '../../../common/types/tenant-context.type'
import { ApiKeyService } from '../../../common/auth/api-key.service'
import { MetricsService } from '../../../common/services/metrics.service'
import {
  ConversionAnalysisRequest,
  DropoffAnalysisRequest,
  CohortAnalysisRequest,
  TimingAnalysisRequest,
} from '../dto/analytics-request.dto'
import { BottleneckDetectionRequest } from '../dto/bottleneck-detection.dto'
import { PathAnalysisRequest } from '../dto/path-analysis.dto'
import { AttributionAnalysisRequest } from '../dto/attribution-analysis.dto'
import { FunnelComparisonRequest } from '../dto/funnel-comparison.dto'
import { FunnelExportRequest } from '../dto/funnel-export.dto'
import {
  ConversionAnalysisResponse,
  DropoffAnalysisResponse,
  CohortAnalysisResponse,
  TimingAnalysisResponse,
} from '../dto/analytics-response.dto'
import { BottleneckDetectionResponse } from '../dto/bottleneck-detection.dto'
import { PathAnalysisResponse } from '../dto/path-analysis.dto'
import { AttributionAnalysisResponse } from '../dto/attribution-analysis.dto'
import { FunnelComparisonResponse } from '../dto/funnel-comparison.dto'
import { FunnelExportResponse, ExportStatusResponse } from '../dto/funnel-export.dto'

/**
 * Phase 2: Core Analytics Engine Controller
 * Advanced funnel analytics endpoints with statistical analysis
 */
@Controller('v1/analytics/funnels')
@UseGuards(HybridAuthGuard)
export class FunnelAnalyticsController {
  private readonly logger = new Logger(FunnelAnalyticsController.name)

  constructor(
    private readonly funnelAnalyticsService: FunnelAnalyticsService,
    private readonly bottleneckDetectionService: BottleneckDetectionService,
    private readonly pathAnalysisService: FunnelPathAnalysisService,
    private readonly attributionService: FunnelAttributionService,
    private readonly comparisonService: FunnelComparisonService,
    private readonly exportService: FunnelExportService,
    private readonly apiKeyService: ApiKeyService,
    private readonly metrics: MetricsService
  ) {}

  /**
   * GET /v1/analytics/funnels/:id/conversion
   * Task 2.1: Conversion Rate Calculation Engine
   *
   * Comprehensive conversion rate analysis with:
   * - Step-by-step conversion metrics
   * - Segment analysis (device, traffic source, etc.)
   * - Time-series data with trends
   * - Statistical significance testing
   * - Performance benchmarks
   */
  @Get(':id/conversion')
  @HttpCode(HttpStatus.OK)
  async getConversionAnalysis(
    @Param('id') funnelId: string,
    @Query() query: ConversionAnalysisRequest,
    @CurrentTenant() tenant: HybridTenantContext
  ): Promise<ConversionAnalysisResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new BadRequestException({
        error: {
          code: 'insufficient_permissions',
          message: 'Read permission required for funnel analytics',
          suggestion: 'Ensure your API key has read:events scope or use proper JWT authentication',
        },
      })
    }

    const startTime = Date.now()
    const funnelIdBigInt = this.parseIdToBigInt(funnelId, 'Funnel ID')

    try {
      // Validate request parameters
      this.validateConversionAnalysisRequest(query)

      // Execute conversion analysis
      const result = await this.funnelAnalyticsService.getConversionAnalysis(
        tenant.tenantId,
        tenant.workspaceId,
        funnelIdBigInt,
        query
      )

      // Record performance metrics
      this.recordAnalyticsMetrics(
        'conversion',
        Date.now() - startTime,
        tenant.tenantId.toString(),
        result.query_performance?.cache_hit || false
      )

      this.logger.log('Conversion analysis completed', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId,
        overallConversionRate: result.overall_metrics.conversion_rate,
        totalEntries: result.overall_metrics.total_entries,
        includeSegments: query.include_segments,
        includeTimeseries: query.include_timeseries,
        duration: Date.now() - startTime,
      })

      return result
    } catch (error) {
      this.recordAnalyticsMetrics(
        'conversion',
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      this.logger.error('Failed to get conversion analysis', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      })

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException({
        error: {
          code: 'analysis_failed',
          message: 'Failed to perform conversion analysis',
          details: {
            error: error instanceof Error ? error.message : 'Internal error',
          },
        },
      })
    }
  }

  /**
   * GET /v1/analytics/funnels/:id/dropoff
   * Task 2.2: Drop-off Analysis & Bottleneck Detection
   *
   * Comprehensive drop-off analysis with:
   * - Step-by-step drop-off rates
   * - Critical bottleneck identification
   * - Exit path analysis
   * - Automated optimization recommendations
   */
  @Get(':id/dropoff')
  @HttpCode(HttpStatus.OK)
  async getDropoffAnalysis(
    @Param('id') funnelId: string,
    @Query() query: DropoffAnalysisRequest,
    @CurrentTenant() tenant: HybridTenantContext
  ): Promise<DropoffAnalysisResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new BadRequestException({
        error: {
          code: 'insufficient_permissions',
          message: 'Read permission required for funnel analytics',
        },
      })
    }

    const startTime = Date.now()
    const funnelIdBigInt = this.parseIdToBigInt(funnelId, 'Funnel ID')

    try {
      this.validateDropoffAnalysisRequest(query)

      const result = await this.funnelAnalyticsService.getDropoffAnalysis(
        tenant.tenantId,
        tenant.workspaceId,
        funnelIdBigInt,
        query
      )

      this.recordAnalyticsMetrics(
        'dropoff',
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false
      )

      this.logger.log('Drop-off analysis completed', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId,
        totalDropoffs: result.summary.total_drop_offs,
        biggestBottleneck: result.summary.biggest_bottleneck_step,
        optimizationPotential: result.summary.optimization_potential,
        duration: Date.now() - startTime,
      })

      return result
    } catch (error) {
      this.recordAnalyticsMetrics(
        'dropoff',
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      this.logger.error('Failed to get drop-off analysis', {
        tenantId: tenant.tenantId.toString(),
        funnelId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new BadRequestException({
        error: {
          code: 'dropoff_analysis_failed',
          message: 'Failed to perform drop-off analysis',
          details: { error: error instanceof Error ? error.message : 'Internal error' },
        },
      })
    }
  }

  /**
   * GET /v1/analytics/funnels/:id/cohorts
   * Task 2.3: Cohort Analysis System
   *
   * Comprehensive cohort analysis with:
   * - Cohort grouping by period (daily, weekly, monthly)
   * - Cohort progression tracking
   * - Retention curve analysis
   * - Cross-cohort statistical comparisons
   */
  @Get(':id/cohorts')
  @HttpCode(HttpStatus.OK)
  async getCohortAnalysis(
    @Param('id') funnelId: string,
    @Query() query: CohortAnalysisRequest,
    @CurrentTenant() tenant: HybridTenantContext
  ): Promise<CohortAnalysisResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new BadRequestException({
        error: {
          code: 'insufficient_permissions',
          message: 'Read permission required for funnel analytics',
        },
      })
    }

    const startTime = Date.now()
    const funnelIdBigInt = this.parseIdToBigInt(funnelId, 'Funnel ID')

    try {
      this.validateCohortAnalysisRequest(query)

      const result = await this.funnelAnalyticsService.getCohortAnalysis(
        tenant.tenantId,
        tenant.workspaceId,
        funnelIdBigInt,
        query
      )

      this.recordAnalyticsMetrics(
        'cohorts',
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false
      )

      this.logger.log('Cohort analysis completed', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId,
        cohortPeriod: result.cohort_period,
        cohortCount: result.cohorts.length,
        duration: Date.now() - startTime,
      })

      return result
    } catch (error) {
      this.recordAnalyticsMetrics(
        'cohorts',
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      this.logger.error('Failed to get cohort analysis', {
        tenantId: tenant.tenantId.toString(),
        funnelId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new BadRequestException({
        error: {
          code: 'cohort_analysis_failed',
          message: 'Failed to perform cohort analysis',
          details: { error: error instanceof Error ? error.message : 'Internal error' },
        },
      })
    }
  }

  /**
   * GET /v1/analytics/funnels/:id/timing
   * Task 2.4: Time-to-Conversion Analytics
   *
   * Comprehensive timing analysis with:
   * - Conversion timing distributions
   * - Step-by-step timing breakdown
   * - Conversion velocity trends
   * - Segment-based timing comparisons
   */
  @Get(':id/timing')
  @HttpCode(HttpStatus.OK)
  async getTimingAnalysis(
    @Param('id') funnelId: string,
    @Query() query: TimingAnalysisRequest,
    @CurrentTenant() tenant: HybridTenantContext
  ): Promise<TimingAnalysisResponse> {
    // Validate read permissions
    if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
      throw new BadRequestException({
        error: {
          code: 'insufficient_permissions',
          message: 'Read permission required for funnel analytics',
        },
      })
    }

    const startTime = Date.now()
    const funnelIdBigInt = this.parseIdToBigInt(funnelId, 'Funnel ID')

    try {
      this.validateTimingAnalysisRequest(query)

      const result = await this.funnelAnalyticsService.getTimingAnalysis(
        tenant.tenantId,
        tenant.workspaceId,
        funnelIdBigInt,
        query
      )

      this.recordAnalyticsMetrics(
        'timing',
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false
      )

      this.logger.log('Timing analysis completed', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId,
        averageTimeToConvert: result.overall_timing.statistics.mean_seconds,
        medianTimeToConvert: result.overall_timing.statistics.median_seconds,
        conversionCount: result.conversion_velocity_trends.length,
        duration: Date.now() - startTime,
      })

      return result
    } catch (error) {
      this.recordAnalyticsMetrics(
        'timing',
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      this.logger.error('Failed to get timing analysis', {
        tenantId: tenant.tenantId.toString(),
        funnelId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new BadRequestException({
        error: {
          code: 'timing_analysis_failed',
          message: 'Failed to perform timing analysis',
          details: { error: error instanceof Error ? error.message : 'Internal error' },
        },
      })
    }
  }

  /**
   * Private helper methods
   */
  private parseIdToBigInt(id: string, fieldName: string): bigint {
    const parsed = BigInt(id)
    if (parsed <= 0) {
      throw new BadRequestException({
        error: {
          code: 'invalid_id',
          message: `${fieldName} must be a positive integer`,
          details: { provided_id: id },
        },
      })
    }
    return parsed
  }

  private validateConversionAnalysisRequest(request: ConversionAnalysisRequest): void {
    const errors: string[] = []

    if (!request.start_date || !request.end_date) {
      errors.push('Both start_date and end_date are required')
    }

    if (request.start_date && request.end_date) {
      const startDate = new Date(request.start_date)
      const endDate = new Date(request.end_date)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.push('Invalid date format. Use YYYY-MM-DD format')
      } else {
        if (startDate >= endDate) {
          errors.push('start_date must be before end_date')
        }

        const maxRangeDays = 90
        const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysDiff > maxRangeDays) {
          errors.push(`Date range cannot exceed ${maxRangeDays} days`)
        }
      }
    }

    if (
      request.statistical_confidence_level &&
      ![90, 95, 99].includes(request.statistical_confidence_level)
    ) {
      errors.push('Statistical confidence level must be 90, 95, or 99')
    }

    if (
      request.timeseries_granularity &&
      !['hourly', 'daily', 'weekly'].includes(request.timeseries_granularity)
    ) {
      errors.push('Timeseries granularity must be hourly, daily, or weekly')
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'invalid_request',
          message: 'Request validation failed',
          details: { errors },
        },
      })
    }
  }

  private validateDropoffAnalysisRequest(request: DropoffAnalysisRequest): void {
    const errors: string[] = []

    if (!request.start_date || !request.end_date) {
      errors.push('Both start_date and end_date are required')
    }

    if (request.bottleneck_threshold !== undefined) {
      if (request.bottleneck_threshold < 0 || request.bottleneck_threshold > 100) {
        errors.push('Bottleneck threshold must be between 0 and 100')
      }
    }

    if (request.min_sample_size !== undefined) {
      if (request.min_sample_size < 1 || request.min_sample_size > 10000) {
        errors.push('Minimum sample size must be between 1 and 10,000')
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'invalid_request',
          message: 'Request validation failed',
          details: { errors },
        },
      })
    }
  }

  private validateCohortAnalysisRequest(request: CohortAnalysisRequest): void {
    const errors: string[] = []

    if (!request.start_date || !request.end_date || !request.cohort_period) {
      errors.push('start_date, end_date, and cohort_period are required')
    }

    if (request.cohort_period && !['daily', 'weekly', 'monthly'].includes(request.cohort_period)) {
      errors.push('Cohort period must be daily, weekly, or monthly')
    }

    if (request.confidence_level && ![90, 95, 99].includes(request.confidence_level)) {
      errors.push('Confidence level must be 90, 95, or 99')
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'invalid_request',
          message: 'Request validation failed',
          details: { errors },
        },
      })
    }
  }

  private validateTimingAnalysisRequest(request: TimingAnalysisRequest): void {
    const errors: string[] = []

    if (!request.start_date || !request.end_date) {
      errors.push('Both start_date and end_date are required')
    }

    if (request.percentiles) {
      const validPercentiles = request.percentiles.every((p) => p > 0 && p <= 100)
      if (!validPercentiles) {
        errors.push('All percentiles must be between 0 and 100')
      }
    }

    if (request.time_unit && !['seconds', 'minutes', 'hours', 'days'].includes(request.time_unit)) {
      errors.push('Time unit must be seconds, minutes, hours, or days')
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'invalid_request',
          message: 'Request validation failed',
          details: { errors },
        },
      })
    }
  }

  private validateBottleneckDetectionRequest(request: BottleneckDetectionRequest): void {
    const errors: string[] = []

    if (!request.funnel_id) {
      errors.push('funnel_id is required')
    }

    if (request.time_window_hours !== undefined) {
      if (request.time_window_hours < 1 || request.time_window_hours > 168) {
        errors.push('time_window_hours must be between 1 and 168 (1 week)')
      }
    }

    if (request.comparison_period_days !== undefined) {
      if (request.comparison_period_days < 1 || request.comparison_period_days > 30) {
        errors.push('comparison_period_days must be between 1 and 30')
      }
    }

    if (
      request.sensitivity_level &&
      !['low', 'medium', 'high'].includes(request.sensitivity_level)
    ) {
      errors.push('sensitivity_level must be low, medium, or high')
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'invalid_request',
          message: 'Request validation failed',
          details: { errors },
        },
      })
    }
  }

  private validatePathAnalysisRequest(request: PathAnalysisRequest): void {
    const errors: string[] = []

    if (!request.funnel_id) {
      errors.push('funnel_id is required')
    }

    if (!request.start_date || !request.end_date) {
      errors.push('Both start_date and end_date are required')
    }

    if (request.start_date && request.end_date) {
      const startDate = new Date(request.start_date)
      const endDate = new Date(request.end_date)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.push('Invalid date format. Use YYYY-MM-DD format')
      } else {
        if (startDate >= endDate) {
          errors.push('start_date must be before end_date')
        }

        const maxRangeDays = 90
        const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysDiff > maxRangeDays) {
          errors.push(`Date range cannot exceed ${maxRangeDays} days`)
        }
      }
    }

    if (request.min_path_volume !== undefined) {
      if (request.min_path_volume < 1 || request.min_path_volume > 100) {
        errors.push('min_path_volume must be between 1 and 100')
      }
    }

    if (request.max_path_length !== undefined) {
      if (request.max_path_length < 3 || request.max_path_length > 20) {
        errors.push('max_path_length must be between 3 and 20')
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'invalid_request',
          message: 'Request validation failed',
          details: { errors },
        },
      })
    }
  }

  private validateAttributionAnalysisRequest(request: AttributionAnalysisRequest): void {
    const errors: string[] = []

    if (!request.funnel_id) {
      errors.push('funnel_id is required')
    }

    if (!request.start_date || !request.end_date) {
      errors.push('Both start_date and end_date are required')
    }

    if (request.start_date && request.end_date) {
      const startDate = new Date(request.start_date)
      const endDate = new Date(request.end_date)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.push('Invalid date format. Use YYYY-MM-DD format')
      } else {
        if (startDate >= endDate) {
          errors.push('start_date must be before end_date')
        }

        const maxRangeDays = 180 // Attribution analysis can have longer lookback
        const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysDiff > maxRangeDays) {
          errors.push(`Date range cannot exceed ${maxRangeDays} days`)
        }
      }
    }

    if (request.attribution_models) {
      const validModels = [
        'first_touch',
        'last_touch',
        'linear',
        'time_decay',
        'position_based',
        'data_driven',
        'custom',
      ]
      const invalidModels = request.attribution_models.filter(
        (model) => !validModels.includes(model)
      )
      if (invalidModels.length > 0) {
        errors.push(`Invalid attribution models: ${invalidModels.join(', ')}`)
      }

      if (request.attribution_models.includes('custom') && !request.custom_model_weights) {
        errors.push('custom_model_weights is required when using custom attribution model')
      }
    }

    if (request.custom_model_weights) {
      const weights = request.custom_model_weights
      if (
        weights.first_touch_weight < 0 ||
        weights.first_touch_weight > 1 ||
        weights.last_touch_weight < 0 ||
        weights.last_touch_weight > 1 ||
        weights.middle_touches_weight < 0 ||
        weights.middle_touches_weight > 1
      ) {
        errors.push('All custom model weights must be between 0 and 1')
      }

      const totalWeight =
        weights.first_touch_weight + weights.last_touch_weight + weights.middle_touches_weight
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        errors.push('Custom model weights must sum to 1.0')
      }
    }

    if (request.dimension_breakdown) {
      const validDimensions = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'device_type',
        'browser',
        'traffic_source',
        'referrer_domain',
      ]
      const invalidDimensions = request.dimension_breakdown.filter(
        (dim) => !validDimensions.includes(dim)
      )
      if (invalidDimensions.length > 0) {
        errors.push(`Invalid attribution dimensions: ${invalidDimensions.join(', ')}`)
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'invalid_request',
          message: 'Request validation failed',
          details: { errors },
        },
      })
    }
  }

  private validateFunnelComparisonRequest(request: FunnelComparisonRequest): void {
    const errors: string[] = []

    if (!request.funnel_ids || request.funnel_ids.length < 2) {
      errors.push('At least 2 funnel IDs are required for comparison')
    }

    if (request.funnel_ids && request.funnel_ids.length > 5) {
      errors.push('Maximum 5 funnels allowed per comparison')
    }

    if (!request.comparison_period) {
      errors.push('comparison_period is required')
    }

    if (request.comparison_period) {
      if (!request.comparison_period.start_date || !request.comparison_period.end_date) {
        errors.push('Both start_date and end_date are required in comparison_period')
      }

      if (request.comparison_period.start_date && request.comparison_period.end_date) {
        const startDate = new Date(request.comparison_period.start_date)
        const endDate = new Date(request.comparison_period.end_date)

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          errors.push('Invalid date format in comparison_period. Use YYYY-MM-DD format')
        } else {
          if (startDate >= endDate) {
            errors.push('start_date must be before end_date in comparison_period')
          }

          const maxRangeDays = 180 // Longer range for comparison analysis
          const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          if (daysDiff > maxRangeDays) {
            errors.push(`Comparison period cannot exceed ${maxRangeDays} days`)
          }
        }
      }
    }

    // Validate baseline funnel ID if provided
    if (
      request.baseline_funnel_id &&
      request.funnel_ids &&
      !request.funnel_ids.includes(request.baseline_funnel_id)
    ) {
      errors.push('baseline_funnel_id must be one of the funnel_ids in the comparison')
    }

    // Validate A/B test configuration if provided
    if (request.ab_test_configuration) {
      const abConfig = request.ab_test_configuration

      if (!abConfig.test_name || abConfig.test_name.trim().length === 0) {
        errors.push('test_name is required for A/B test configuration')
      }

      if (!abConfig.test_hypothesis || abConfig.test_hypothesis.trim().length === 0) {
        errors.push('test_hypothesis is required for A/B test configuration')
      }

      if (abConfig.confidence_level && ![90, 95, 99].includes(abConfig.confidence_level)) {
        errors.push('confidence_level must be 90, 95, or 99')
      }

      if (abConfig.minimum_sample_size !== undefined) {
        if (abConfig.minimum_sample_size < 100 || abConfig.minimum_sample_size > 100000) {
          errors.push('minimum_sample_size must be between 100 and 100,000')
        }
      }

      if (abConfig.expected_effect_size !== undefined) {
        if (abConfig.expected_effect_size <= 0 || abConfig.expected_effect_size > 1) {
          errors.push('expected_effect_size must be between 0 and 1')
        }
      }
    }

    // Validate segment dimensions if provided
    if (request.segment_dimensions) {
      const validDimensions = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'device_type',
        'browser',
        'traffic_source',
        'referrer_domain',
      ]
      const invalidDimensions = request.segment_dimensions.filter(
        (dim) => !validDimensions.includes(dim)
      )
      if (invalidDimensions.length > 0) {
        errors.push(`Invalid segment dimensions: ${invalidDimensions.join(', ')}`)
      }
    }

    // Validate time series granularity if provided
    if (
      request.time_series_granularity &&
      !['hourly', 'daily', 'weekly'].includes(request.time_series_granularity)
    ) {
      errors.push('time_series_granularity must be hourly, daily, or weekly')
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'invalid_request',
          message: 'Request validation failed',
          details: { errors },
        },
      })
    }
  }

  /**
   * Validate funnel access for current tenant/workspace
   */
  private validateFunnelAccess(funnelId: string, tenant: HybridTenantContext): void {
    // Basic validation - funnel ID format
    if (!funnelId || funnelId.trim().length === 0) {
      throw new BadRequestException('Funnel ID is required')
    }

    // Additional security validation could be added here
    // For now, we rely on the service layer to validate tenant access
  }

  private getDefaultStartDate(): string {
    const date = new Date()
    date.setDate(date.getDate() - 30) // 30 days ago
    return date.toISOString().split('T')[0]
  }

  private getDefaultEndDate(): string {
    const date = new Date()
    return date.toISOString().split('T')[0]
  }

  private recordAnalyticsMetrics(
    endpoint: string,
    duration: number,
    tenantId: string,
    cacheHit: boolean = false,
    error: boolean = false
  ): void {
    // Increment endpoint request counter
    this.metrics.incrementCounter(`funnel_analytics.${endpoint}_requests`)

    // Record query latency
    this.metrics.recordLatency('funnel_analytics.query_latency', duration)

    // Record cache metrics
    if (cacheHit) {
      this.metrics.incrementCounter('funnel_analytics.cache_hits')
    } else {
      this.metrics.incrementCounter('funnel_analytics.cache_misses')
    }

    // Track errors
    if (error) {
      this.metrics.incrementCounter(`funnel_analytics.${endpoint}_errors`)
    }

    // Alert on slow queries
    if (duration > 2000) {
      this.metrics.incrementCounter('funnel_analytics.slow_queries')
      this.logger.warn('Slow funnel analytics query detected', {
        endpoint,
        duration,
        tenantId,
        threshold: 2000,
        performance_alert: true,
      })
    }

    // Log performance data
    this.logger.debug('Funnel analytics performance metrics recorded', {
      endpoint,
      duration,
      tenantId,
      cacheHit,
      error,
      slow_query: duration > 2000,
    })
  }

  /**
   * GET /v1/analytics/funnels/:id/bottlenecks
   * Task 3.3: Advanced Bottleneck Detection System
   *
   * ML-based bottleneck detection with automated recommendations
   */
  @Get(':id/bottlenecks')
  @HttpCode(HttpStatus.OK)
  async getBottlenecks(
    @Param('id') funnelId: string,
    @Query() query: Partial<BottleneckDetectionRequest>,
    @CurrentTenant() tenant: HybridTenantContext
  ): Promise<BottleneckDetectionResponse> {
    const startTime = Date.now()
    const endpoint = 'bottlenecks'

    try {
      // Validate read permissions
      if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
        throw new BadRequestException({
          error: {
            code: 'insufficient_permissions',
            message: 'Read analytics permission required',
          },
        })
      }

      // Validate funnel ID
      const parsedFunnelId = this.parseIdToBigInt(funnelId, 'funnel_id')

      // Build and validate request with defaults
      const request: BottleneckDetectionRequest = {
        funnel_id: funnelId,
        time_window_hours: Math.max(1, Math.min(168, query.time_window_hours || 24)), // 1h to 1 week
        sensitivity_level: query.sensitivity_level || 'medium',
        include_recommendations: query.include_recommendations !== false,
        comparison_period_days: Math.max(1, Math.min(30, query.comparison_period_days || 7)), // 1-30 days
      }

      this.validateBottleneckDetectionRequest(request)

      this.logger.debug('Processing bottleneck detection request', {
        funnelId: parsedFunnelId.toString(),
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        request,
      })

      const result = await this.bottleneckDetectionService.detectBottlenecks(
        tenant.tenantId.toString(),
        tenant.workspaceId.toString(),
        funnelId,
        request
      )

      // Record successful request metrics
      this.recordAnalyticsMetrics(endpoint, Date.now() - startTime, tenant.tenantId.toString())

      this.logger.debug('Bottleneck detection completed successfully', {
        funnelId,
        bottlenecksFound: result.detected_bottlenecks.length,
        anomaliesFound: result.performance_anomalies.length,
        recommendationsGenerated: result.recommendations.length,
        processingTime: Date.now() - startTime,
      })

      return result
    } catch (error) {
      this.logger.error(
        `Bottleneck detection error for funnel ${funnelId}`,
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
          funnelId,
        }
      )

      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException('Failed to analyze bottlenecks')
    }
  }

  /**
   * GET /v1/analytics/funnels/:id/live
   * Task 3.2: Live Metrics & User Progression Tracking
   *
   * Real-time funnel metrics for dashboard with configurable refresh intervals
   */
  @Get(':id/live')
  @HttpCode(HttpStatus.OK)
  async getLiveMetrics(
    @Param('id') funnelId: string,
    @Query('refresh_interval') refreshInterval: string = '30',
    @CurrentTenant() tenant: HybridTenantContext
  ) {
    const startTime = Date.now()
    const endpoint = 'live_metrics'

    try {
      // Validate read permissions
      if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
        throw new BadRequestException({
          error: {
            code: 'insufficient_permissions',
            message: 'Read analytics permission required',
          },
        })
      }

      // Validate refresh interval
      const refreshIntervalNum = Math.max(15, Math.min(300, parseInt(refreshInterval) || 30)) // 15-300 seconds

      const result = await this.funnelAnalyticsService.getLiveMetrics(
        tenant.tenantId,
        tenant.workspaceId,
        BigInt(funnelId),
        refreshIntervalNum
      )

      // Record successful request metrics
      this.recordAnalyticsMetrics(endpoint, Date.now() - startTime, tenant.tenantId.toString())

      return result
    } catch (error) {
      this.logger.error(`Live metrics error for funnel ${funnelId}`, error)
      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException('Failed to get live metrics')
    }
  }

  /**
   * GET /v1/analytics/funnels/:id/paths
   * Task 3.4: Multi-path Funnel Analysis
   *
   * Analyze alternative conversion paths and optimization opportunities
   */
  @Get(':id/paths')
  @HttpCode(HttpStatus.OK)
  async getPathAnalysis(
    @Param('id') funnelId: string,
    @Query() query: Partial<PathAnalysisRequest>,
    @CurrentTenant() tenant: HybridTenantContext
  ): Promise<PathAnalysisResponse> {
    const startTime = Date.now()
    const endpoint = 'path_analysis'

    try {
      // Validate read permissions
      if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
        throw new BadRequestException({
          error: {
            code: 'insufficient_permissions',
            message: 'Read analytics permission required',
          },
        })
      }

      // Validate funnel ID
      const parsedFunnelId = this.parseIdToBigInt(funnelId, 'funnel_id')

      // Build and validate request with defaults
      const request: PathAnalysisRequest = {
        funnel_id: funnelId,
        start_date: query.start_date || this.getDefaultStartDate(),
        end_date: query.end_date || this.getDefaultEndDate(),
        include_alternative_paths: query.include_alternative_paths !== false,
        min_path_volume: Math.max(1, Math.min(100, query.min_path_volume || 10)),
        max_path_length: Math.max(3, Math.min(20, query.max_path_length || 10)),
        include_efficiency_scoring: query.include_efficiency_scoring !== false,
        include_branching_analysis: query.include_branching_analysis !== false,
      }

      this.validatePathAnalysisRequest(request)

      this.logger.debug('Processing path analysis request', {
        funnelId: parsedFunnelId.toString(),
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        request,
      })

      const result = await this.pathAnalysisService.analyzeConversionPaths(
        tenant.tenantId.toString(),
        tenant.workspaceId.toString(),
        funnelId,
        request
      )

      // Record successful request metrics
      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        result.query_performance.cache_hit
      )

      this.logger.debug('Path analysis completed successfully', {
        funnelId,
        pathsFound: result.conversion_paths.length,
        alternativePathsFound: result.alternative_paths.length,
        optimizationOpportunities: result.path_optimization_opportunities.length,
        processingTime: Date.now() - startTime,
      })

      return result
    } catch (error) {
      this.logger.error(
        `Path analysis error for funnel ${funnelId}`,
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
          funnelId,
        }
      )

      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException('Failed to analyze conversion paths')
    }
  }

  /**
   * GET /v1/analytics/funnels/:id/users/:userId
   * Task 3.2: Individual User Progression Tracking
   *
   * Track individual user journey through funnel with performance indicators
   */
  @Get(':id/users/:userId')
  @HttpCode(HttpStatus.OK)
  async getUserProgression(
    @Param('id') funnelId: string,
    @Param('userId') userId: string,
    @Query('type') userType: 'user_id' | 'anonymous_id' = 'anonymous_id',
    @CurrentTenant() tenant: HybridTenantContext
  ) {
    const startTime = Date.now()
    const endpoint = 'user_progression'

    try {
      // Validate read permissions
      if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
        throw new BadRequestException({
          error: {
            code: 'insufficient_permissions',
            message: 'Read analytics permission required',
          },
        })
      }

      // Determine if this is a user ID or anonymous ID
      const isUserId = userType === 'user_id' || !userId.startsWith('a_')

      const result = await this.funnelAnalyticsService.getUserProgression(
        tenant.tenantId,
        tenant.workspaceId,
        BigInt(funnelId),
        isUserId ? userId : undefined,
        isUserId ? undefined : userId
      )

      // Record successful request metrics
      this.recordAnalyticsMetrics(endpoint, Date.now() - startTime, tenant.tenantId.toString())

      return result
    } catch (error) {
      this.logger.error(`User progression error for funnel ${funnelId}, user ${userId}`, error)
      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException('Failed to get user progression')
    }
  }

  /**
   * GET /v1/analytics/funnels/:id/attribution
   * Task 4.1: Attribution Analysis System
   *
   * Multi-touch attribution analysis with multiple models and cross-channel tracking
   */
  @Get(':id/attribution')
  @HttpCode(HttpStatus.OK)
  async getAttributionAnalysis(
    @Param('id') funnelId: string,
    @Query() query: Partial<AttributionAnalysisRequest>,
    @CurrentTenant() tenant: HybridTenantContext
  ): Promise<AttributionAnalysisResponse> {
    const startTime = Date.now()
    const endpoint = 'attribution_analysis'

    try {
      // Validate read permissions
      if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
        throw new BadRequestException({
          error: {
            code: 'insufficient_permissions',
            message: 'Read analytics permission required for attribution analysis',
          },
        })
      }

      // Validate funnel ID
      const parsedFunnelId = this.parseIdToBigInt(funnelId, 'funnel_id')

      // Build and validate request with defaults
      const request: AttributionAnalysisRequest = {
        funnel_id: funnelId,
        start_date: query.start_date || this.getDefaultStartDate(),
        end_date: query.end_date || this.getDefaultEndDate(),
        attribution_models: query.attribution_models || [
          'first_touch',
          'last_touch',
          'linear',
          'time_decay',
        ],
        cross_channel: query.cross_channel !== false,
        include_custom_model: query.include_custom_model || false,
        custom_model_weights: query.custom_model_weights,
        dimension_breakdown: query.dimension_breakdown,
        include_model_comparison: query.include_model_comparison !== false,
      }

      this.validateAttributionAnalysisRequest(request)

      this.logger.debug('Processing attribution analysis request', {
        funnelId: parsedFunnelId.toString(),
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        request,
      })

      const result = await this.attributionService.analyzeAttribution(
        tenant.tenantId.toString(),
        tenant.workspaceId.toString(),
        funnelId,
        request
      )

      // Record successful request metrics
      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        result.query_performance.cache_hit
      )

      this.logger.debug('Attribution analysis completed successfully', {
        funnelId,
        modelsAnalyzed: result.attribution_results.length,
        touchpointsAnalyzed: result.query_performance.touchpoints_analyzed,
        conversionsAnalyzed: result.query_performance.conversions_analyzed,
        processingTime: Date.now() - startTime,
      })

      return result
    } catch (error) {
      this.logger.error(
        `Attribution analysis error for funnel ${funnelId}`,
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
          funnelId,
        }
      )

      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException('Failed to perform attribution analysis')
    }
  }

  /**
   * POST /v1/analytics/funnels/compare
   * Task 4.2: Funnel Comparison & A/B Testing
   *
   * Statistical comparison of multiple funnels with A/B testing capabilities
   */
  @Post('compare')
  @HttpCode(HttpStatus.OK)
  async compareFunnels(
    @Body() request: FunnelComparisonRequest,
    @CurrentTenant() tenant: HybridTenantContext
  ): Promise<FunnelComparisonResponse> {
    const startTime = Date.now()
    const endpoint = 'funnel_comparison'

    try {
      // Validate read permissions
      if (!this.apiKeyService.canReadEvents(tenant.scopes)) {
        throw new BadRequestException({
          error: {
            code: 'insufficient_permissions',
            message: 'Read analytics permission required for funnel comparison',
          },
        })
      }

      // Validate request
      this.validateFunnelComparisonRequest(request)

      // Validate funnel IDs format
      for (const funnelId of request.funnel_ids) {
        this.parseIdToBigInt(funnelId, 'funnel_id')
      }

      this.logger.debug('Processing funnel comparison request', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelIds: request.funnel_ids,
        comparisonPeriod: request.comparison_period,
        abTest: !!request.ab_test_configuration,
      })

      const result = await this.comparisonService.compareFunnels(
        tenant.tenantId.toString(),
        tenant.workspaceId.toString(),
        request
      )

      // Record successful request metrics
      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        result.query_performance.cache_hit
      )

      this.logger.debug('Funnel comparison completed successfully', {
        comparisonId: result.comparison_id,
        funnelsAnalyzed: result.funnels_compared.length,
        statisticallySignificant:
          result.statistical_comparison.overall_significance.is_statistically_significant,
        abTestWinner: result.ab_test_results?.statistical_results.winner,
        processingTime: Date.now() - startTime,
      })

      return result
    } catch (error) {
      this.logger.error(
        'Funnel comparison error',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
          funnelIds: request.funnel_ids,
        }
      )

      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException('Failed to perform funnel comparison')
    }
  }

  /**
   * POST /v1/analytics/funnels/:id/export
   * Task 4.3: Export & Integration Capabilities
   *
   * Create funnel export with multiple format support:
   * - CSV, JSON, Excel formats
   * - Email delivery or download links
   * - Data anonymization options
   * - Large dataset streaming support
   * - Progress tracking and status monitoring
   */
  @Post(':id/export')
  @HttpCode(HttpStatus.ACCEPTED)
  async createFunnelExport(
    @Param('id') funnelId: string,
    @Body() request: FunnelExportRequest,
    @CurrentTenant() tenant: HybridTenantContext
  ): Promise<FunnelExportResponse> {
    const endpoint = 'createFunnelExport'
    const startTime = Date.now()

    try {
      this.logger.log(`Creating export for funnel ${funnelId}`, {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        exportFormat: request.format,
        exportType: request.export_type,
        deliveryMethod: request.delivery_method,
      })

      // Validate tenant has permission for this funnel
      this.validateFunnelAccess(funnelId, tenant)

      // Create export job
      const result = await this.exportService.createExport(funnelId, request, {
        tenantId: tenant.tenantId,
        workspaceId: tenant.workspaceId,
      })

      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        true,
        false
      )

      return result
    } catch (error) {
      this.logger.error(
        'Funnel export creation error',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
          funnelId,
        }
      )

      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException('Failed to create funnel export')
    }
  }

  /**
   * GET /v1/analytics/exports/:exportId/status
   * Check export status and progress
   */
  @Get('/exports/:exportId/status')
  async getExportStatus(
    @Param('exportId') exportId: string,
    @CurrentTenant() tenant: HybridTenantContext
  ): Promise<ExportStatusResponse> {
    const endpoint = 'getExportStatus'
    const startTime = Date.now()

    try {
      this.logger.log(`Getting export status for ${exportId}`, {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        exportId,
      })

      const result = await this.exportService.getExportStatus(exportId)

      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        true,
        false
      )

      return result
    } catch (error) {
      this.logger.error(
        'Export status check error',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
          exportId,
        }
      )

      this.recordAnalyticsMetrics(
        endpoint,
        Date.now() - startTime,
        tenant.tenantId.toString(),
        false,
        true
      )

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException('Failed to get export status')
    }
  }
}

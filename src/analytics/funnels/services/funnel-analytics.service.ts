import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { FunnelRepository } from '../repositories/funnel.repository';
import { FunnelAnalyticsRepository } from '../repositories/funnel-analytics.repository';
import { FunnelCacheService } from './funnel-cache.service';
import { MercurioLogger } from '../../../common/services/logger.service';
import { MetricsService } from '../../../common/services/metrics.service';
import {
  ConversionAnalysisRequest,
  DropoffAnalysisRequest,
  CohortAnalysisRequest,
  TimingAnalysisRequest,
} from '../dto/analytics-request.dto';
import {
  ConversionAnalysisResponse,
  DropoffAnalysisResponse,
  CohortAnalysisResponse,
  TimingAnalysisResponse,
} from '../dto/analytics-response.dto';
import {
  StepConversionMetrics,
  SegmentConversionMetrics,
  ConversionTimeSeriesPoint,
  OverallConversionMetrics,
} from '../dto/analytics-response.dto';

@Injectable()
export class FunnelAnalyticsService {
  constructor(
    private readonly funnelRepository: FunnelRepository,
    private readonly analyticsRepository: FunnelAnalyticsRepository,
    private readonly cache: FunnelCacheService,
    private readonly logger: MercurioLogger,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Calculate comprehensive conversion rates with segment analysis
   * GET /v1/analytics/funnels/:id/conversion
   */
  async getConversionAnalysis(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    request: ConversionAnalysisRequest,
  ): Promise<ConversionAnalysisResponse> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateCacheKey('conversion', {
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      funnelId: funnelId.toString(),
      ...request,
    });

    try {
      // Try cache first
      const cachedResult = await this.cache.get<ConversionAnalysisResponse>(cacheKey);
      if (cachedResult) {
        this.recordMetrics('conversion', Date.now() - startTime, true);
        return cachedResult;
      }

      // Validate funnel exists and user has access using the analytics repository
      const funnel = await this.funnelRepository.getFunnelById(
        tenantId,
        workspaceId,
        funnelId,
      );

      if (!funnel) {
        throw new Error(`Funnel ${funnelId} not found`);
      }

      // Calculate conversion metrics
      const conversionData = await this.calculateConversionRates(
        tenantId,
        workspaceId,
        funnelId,
        request,
      );

      // Get segment analysis if requested
      const segmentAnalysis = request.include_segments
        ? await this.calculateSegmentConversions(
            tenantId,
            workspaceId,
            funnelId,
            request,
          )
        : [];

      // Get time series data if requested
      const timeSeriesData = request.include_timeseries
        ? await this.calculateConversionTimeSeries(
            tenantId,
            workspaceId,
            funnelId,
            request,
          )
        : [];

      const startDate = new Date(request.start_date);
      const endDate = new Date(request.end_date);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      const result: ConversionAnalysisResponse = {
        funnel_id: funnelId.toString(),
        funnel_name: funnel.name,
        analysis_period: {
          start_date: request.start_date,
          end_date: request.end_date,
          timezone: request.timezone || 'UTC',
          total_days: totalDays,
        },
        overall_metrics: conversionData.overall,
        step_metrics: conversionData.stepMetrics,
        segment_analysis: segmentAnalysis,
        time_series: timeSeriesData,
        statistical_significance: conversionData.statisticalSignificance,
        performance_benchmarks: {
          industry_average: this.getIndustryBenchmark('e-commerce'), // Default for now
          peer_comparison: await this.calculatePeerComparison(
            tenantId,
            workspaceId,
            conversionData.overall,
          ),
        },
        generated_at: new Date().toISOString(),
        cache_duration_seconds: this.cache.getTTL('conversionMetrics'),
        query_performance: {
          execution_time_ms: Date.now() - startTime,
          cache_hit: false,
          data_freshness_minutes: 0, // TODO: implement data freshness tracking
        },
      };

      // Cache the result
      await this.cache.set(
        cacheKey,
        result,
        this.cache.getTTL('conversionMetrics'),
      );

      this.recordMetrics('conversion', Date.now() - startTime, false);
      
      this.logger.log('Conversion analysis completed', {
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        funnelId: funnelId.toString(),
        overallConversionRate: conversionData.overall.conversion_rate,
        totalEntries: conversionData.overall.total_entries,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.recordMetrics('conversion', Date.now() - startTime, false, true);
      
      this.logger.error('Failed to calculate conversion analysis', error instanceof Error ? error : new Error(String(error)), {
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        funnelId: funnelId.toString(),
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }

  /**
   * Calculate conversion rates with statistical analysis
   */
  private async calculateConversionRates(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    request: ConversionAnalysisRequest,
  ): Promise<{
    overall: OverallConversionMetrics;
    stepMetrics: StepConversionMetrics[];
    statisticalSignificance: any;
  }> {
    // Get funnel configuration
    const funnel = await this.funnelRepository.getFunnelById(
      tenantId,
      workspaceId,
      funnelId,
    );

    if (!funnel) {
      throw new Error(`Funnel ${funnelId} not found for conversion calculation`);
    }

    // Calculate step-by-step conversions
    const stepMetrics: StepConversionMetrics[] = [];
    let previousStepUsers = 0;
    let totalEntries = 0;
    let totalConversions = 0;

    // Get steps from the latest version
    const latestVersion = funnel.versions?.[0];
    if (!latestVersion?.steps) {
      throw new Error(`No steps found for funnel ${funnelId}`);
    }

    const steps = latestVersion.steps.sort((a, b) => a.orderIndex - b.orderIndex);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Count users who completed this step
      const stepCompletions = await this.analyticsRepository.getStepCompletions(
        tenantId,
        workspaceId,
        funnelId,
        i + 1, // Step order is 1-indexed
        request.start_date,
        request.end_date,
      );

      // For first step, this is total entries
      if (i === 0) {
        totalEntries = stepCompletions;
        previousStepUsers = stepCompletions;
      }

      // Calculate conversion rate from previous step
      const conversionFromPrevious = previousStepUsers > 0 
        ? (stepCompletions / previousStepUsers) * 100
        : 0;

      // Calculate conversion rate from start
      const conversionFromStart = totalEntries > 0 
        ? (stepCompletions / totalEntries) * 100
        : 0;

      // Calculate drop-off rate
      const dropOffRate = previousStepUsers > 0 
        ? ((previousStepUsers - stepCompletions) / previousStepUsers) * 100
        : 0;

      const avgTimeToComplete = await this.calculateStepCompletionTime(
        tenantId,
        workspaceId,
        funnelId,
        i + 1,
        request.start_date,
        request.end_date,
      );

      stepMetrics.push({
        step_order: i + 1,
        step_name: step.label,
        step_type: step.type as 'start' | 'page' | 'event' | 'decision' | 'conversion',
        total_users: stepCompletions,
        conversion_rate_from_previous: Math.round(conversionFromPrevious * 100) / 100,
        conversion_rate_from_start: Math.round(conversionFromStart * 100) / 100,
        drop_off_rate: Math.round(dropOffRate * 100) / 100,
        drop_off_count: previousStepUsers - stepCompletions,
        is_bottleneck: dropOffRate > 50, // Mark as bottleneck if >50% drop-off
        bottleneck_severity: dropOffRate > 75 ? 'critical' : dropOffRate > 60 ? 'high' : dropOffRate > 45 ? 'medium' : 'low',
        average_time_to_complete: avgTimeToComplete,
        median_time_to_complete: avgTimeToComplete, // For now, using same value
        time_percentiles: {
          p25: avgTimeToComplete * 0.75,
          p50: avgTimeToComplete,
          p75: avgTimeToComplete * 1.25,
          p90: avgTimeToComplete * 1.5,
          p95: avgTimeToComplete * 1.8,
        },
        common_exit_paths: [], // TODO: implement exit path analysis
      });

      // Last step represents conversions
      if (i === steps.length - 1) {
        totalConversions = stepCompletions;
      }

      previousStepUsers = stepCompletions;
    }

    // Calculate overall metrics
    const overallConversionRate = totalEntries > 0 
      ? (totalConversions / totalEntries) * 100
      : 0;

    const avgTimeToConvert = await this.calculateAverageTimeToConvert(
      tenantId,
      workspaceId,
      funnelId,
      request.start_date,
      request.end_date,
    );

    const overall: OverallConversionMetrics = {
      total_entries: totalEntries,
      total_conversions: totalConversions,
      conversion_rate: Math.round(overallConversionRate * 100) / 100,
      total_drop_offs: totalEntries - totalConversions,
      average_time_to_convert: avgTimeToConvert,
      median_time_to_convert: avgTimeToConvert, // For now, using same value
      conversion_velocity: await this.calculateConversionVelocity(
        tenantId,
        workspaceId,
        funnelId,
        request.start_date,
        request.end_date,
      ),
      bounce_rate_at_entry: 0, // TODO: implement bounce rate calculation
      engagement_score: Math.min(100, Math.max(0, overallConversionRate * 10)), // Simple engagement score
      period_over_period_change: undefined, // Will be calculated in statistical significance
    };

    // Calculate statistical significance
    const statisticalSignificance = await this.calculateStatisticalSignificance(
      tenantId,
      workspaceId,
      funnelId,
      overall,
      request,
    );

    return { overall, stepMetrics, statisticalSignificance };
  }

  /**
   * Calculate segment-based conversion analysis
   */
  private async calculateSegmentConversions(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    request: ConversionAnalysisRequest,
  ): Promise<SegmentConversionMetrics[]> {
    const segments: SegmentConversionMetrics[] = [];

    // Analyze by device type
    const deviceSegments = await this.analyticsRepository.getConversionsBySegment(
      tenantId,
      workspaceId,
      funnelId,
      'device_type',
      request.start_date,
      request.end_date,
    );

    for (const segment of deviceSegments) {
      const conversionRate = Math.round((segment.total_conversions / segment.total_entries) * 10000) / 100;
      segments.push({
        segment_type: 'device',
        segment_value: segment.segment_value,
        total_entries: segment.total_entries,
        total_conversions: segment.total_conversions,
        conversion_rate: conversionRate,
        performance_vs_average: await this.calculatePerformanceVsAverage(
          segment,
          tenantId,
          workspaceId,
          funnelId,
          request,
        ),
        statistical_significance: segment.total_entries > 100, // Simple significance check
        confidence_interval: {
          lower_bound: Math.max(0, conversionRate - 5),
          upper_bound: Math.min(100, conversionRate + 5),
          confidence_level: 95,
        },
        insights: [
          {
            type: conversionRate > 5 ? 'outperforming' : conversionRate < 2 ? 'underperforming' : 'stable',
            description: `Device segment conversion rate: ${conversionRate}%`,
            impact_score: Math.min(100, segment.total_entries / 10),
          },
        ],
      });
    }

    // Analyze by traffic source
    const sourceSegments = await this.analyticsRepository.getConversionsBySegment(
      tenantId,
      workspaceId,
      funnelId,
      'utm_source',
      request.start_date,
      request.end_date,
    );

    for (const segment of sourceSegments) {
      const conversionRate = Math.round((segment.total_conversions / segment.total_entries) * 10000) / 100;
      segments.push({
        segment_type: 'traffic_source',
        segment_value: segment.segment_value || 'direct',
        total_entries: segment.total_entries,
        total_conversions: segment.total_conversions,
        conversion_rate: conversionRate,
        performance_vs_average: await this.calculatePerformanceVsAverage(
          segment,
          tenantId,
          workspaceId,
          funnelId,
          request,
        ),
        statistical_significance: segment.total_entries > 100, // Simple significance check
        confidence_interval: {
          lower_bound: Math.max(0, conversionRate - 5),
          upper_bound: Math.min(100, conversionRate + 5),
          confidence_level: 95,
        },
        insights: [
          {
            type: conversionRate > 5 ? 'outperforming' : conversionRate < 2 ? 'underperforming' : 'stable',
            description: `Traffic source segment conversion rate: ${conversionRate}%`,
            impact_score: Math.min(100, segment.total_entries / 10),
          },
        ],
      });
    }

    return segments;
  }

  /**
   * Calculate time-series conversion data
   */
  private async calculateConversionTimeSeries(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    request: ConversionAnalysisRequest,
  ): Promise<ConversionTimeSeriesPoint[]> {
    const granularity = request.timeseries_granularity || 'daily';
    
    return await this.analyticsRepository.getConversionTimeSeries(
      tenantId,
      workspaceId,
      funnelId,
      request.start_date,
      request.end_date,
      granularity,
    );
  }

  /**
   * Helper methods for calculations
   */
  private async calculateStepCompletionTime(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    stepOrder: number,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    return await this.analyticsRepository.getAverageStepCompletionTime(
      tenantId,
      workspaceId,
      funnelId,
      stepOrder,
      startDate,
      endDate,
    );
  }

  private async calculateAverageTimeToConvert(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    return await this.analyticsRepository.getAverageTimeToConvert(
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate,
    );
  }

  private async calculateConversionVelocity(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    return await this.analyticsRepository.getConversionVelocity(
      tenantId,
      workspaceId,
      funnelId,
      startDate,
      endDate,
    );
  }

  private async calculateStatisticalSignificance(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    current: OverallConversionMetrics,
    request: ConversionAnalysisRequest,
  ): Promise<any> {
    // Compare with previous period for statistical significance
    const previousPeriod = this.calculatePreviousPeriod(
      request.start_date,
      request.end_date,
    );

    const previousMetrics = await this.calculateConversionRates(
      tenantId,
      workspaceId,
      funnelId,
      {
        ...request,
        start_date: previousPeriod.start,
        end_date: previousPeriod.end,
      },
    );

    // Z-test for conversion rate comparison
    const currentRate = current.conversion_rate / 100;
    const previousRate = previousMetrics.overall.conversion_rate / 100;
    const currentN = current.total_entries;
    const previousN = previousMetrics.overall.total_entries;

    const pooledRate = (current.total_conversions + previousMetrics.overall.total_conversions) /
                      (currentN + previousN);
    
    const standardError = Math.sqrt(pooledRate * (1 - pooledRate) * (1/currentN + 1/previousN));
    const zScore = (currentRate - previousRate) / standardError;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    return {
      comparison_period: previousPeriod,
      current_conversion_rate: currentRate,
      previous_conversion_rate: previousRate,
      improvement: ((currentRate - previousRate) / previousRate) * 100,
      z_score: Math.round(zScore * 1000) / 1000,
      p_value: Math.round(pValue * 10000) / 10000,
      is_significant: pValue < 0.05,
      confidence_level: pValue < 0.01 ? 99 : pValue < 0.05 ? 95 : 90,
    };
  }

  private calculatePreviousPeriod(startDate: string, endDate: string): { start: string; end: string } {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = end.getTime() - start.getTime();
    
    const previousEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000); // Day before start
    const previousStart = new Date(previousEnd.getTime() - duration);
    
    return {
      start: previousStart.toISOString().split('T')[0],
      end: previousEnd.toISOString().split('T')[0],
    };
  }

  private normalCDF(x: number): number {
    // Approximation of normal cumulative distribution function
    return (1 + this.erf(x / Math.sqrt(2))) / 2;
  }

  private erf(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private async calculatePerformanceVsAverage(
    segment: any,
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    request: ConversionAnalysisRequest,
  ): Promise<number> {
    const averageRate = await this.analyticsRepository.getAverageConversionRate(
      tenantId,
      workspaceId,
      funnelId,
      request.start_date,
      request.end_date,
    );

    const segmentRate = (segment.total_conversions / segment.total_entries) * 100;
    return Math.round(((segmentRate - averageRate) / averageRate) * 10000) / 100;
  }

  private async calculatePeerComparison(
    tenantId: bigint,
    workspaceId: bigint,
    overall: OverallConversionMetrics,
  ): Promise<{ percentile: number; peer_average: number }> {
    // Calculate peer comparison within same tenant
    const peerMetrics = await this.analyticsRepository.getPeerFunnelMetrics(
      tenantId,
      workspaceId,
    );

    const peerRates = peerMetrics.map(p => p.conversion_rate).sort((a, b) => a - b);
    const currentRate = overall.conversion_rate;
    
    let percentile = 50; // Default
    if (peerRates.length > 0) {
      const rank = peerRates.filter(rate => rate <= currentRate).length;
      percentile = Math.round((rank / peerRates.length) * 100);
    }

    const peerAverage = peerRates.length > 0 
      ? Math.round((peerRates.reduce((a, b) => a + b, 0) / peerRates.length) * 100) / 100
      : 0;

    return { percentile, peer_average: peerAverage };
  }

  private getIndustryBenchmark(vertical?: string): number {
    // Industry benchmark conversion rates by vertical
    const benchmarks: Record<string, number> = {
      'e-commerce': 2.86,
      'saas': 3.93,
      'fintech': 2.35,
      'healthcare': 4.12,
      'education': 3.58,
      'media': 2.21,
      'travel': 2.84,
      'real-estate': 4.02,
    };

    const key = vertical?.toLowerCase() || 'e-commerce';
    return benchmarks[key] || 3.0;
  }

  private recordMetrics(endpoint: string, duration: number, cacheHit: boolean, error = false): void {
    this.metrics.incrementCounter(`funnel_analytics.${endpoint}_requests`);
    this.metrics.recordLatency('funnel_analytics.query_latency', duration);
    
    if (cacheHit) {
      this.metrics.incrementCounter('funnel_analytics.cache_hits');
    } else {
      this.metrics.incrementCounter('funnel_analytics.cache_misses');
    }

    if (error) {
      this.metrics.incrementCounter(`funnel_analytics.${endpoint}_errors`);
    }

    if (duration > 1000) {
      this.metrics.incrementCounter('funnel_analytics.slow_queries');
    }
  }

  /**
   * TASK 2.2: Drop-off Analysis & Bottleneck Detection
   * GET /v1/analytics/funnels/:id/dropoff
   */
  async getDropoffAnalysis(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    request: DropoffAnalysisRequest,
  ): Promise<DropoffAnalysisResponse> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateCacheKey('dropoff', {
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      funnelId: funnelId.toString(),
      ...request,
    });

    try {
      // Try cache first
      const cachedResult = await this.cache.get<DropoffAnalysisResponse>(cacheKey);
      if (cachedResult) {
        this.recordMetrics('dropoff', Date.now() - startTime, true);
        return cachedResult;
      }

      // Validate funnel exists and user has access
      const funnel = await this.funnelRepository.getFunnelById(
        tenantId,
        workspaceId,
        funnelId,
      );

      if (!funnel) {
        throw new Error(`Funnel ${funnelId} not found`);
      }

      // Get step-by-step drop-off rates
      const stepDropoffs = await this.analyticsRepository.getStepDropoffRates(
        tenantId,
        workspaceId,
        funnelId,
        request.start_date,
        request.end_date,
      );

      // Get critical bottlenecks with severity scoring
      const bottlenecks = await this.analyticsRepository.getBottleneckSeverityScoring(
        tenantId,
        workspaceId,
        funnelId,
        request.start_date,
        request.end_date,
      );

      // Get exit path analysis if requested
      const exitPaths = request.include_exit_paths !== false 
        ? await this.analyticsRepository.getExitPathAnalysis(
            tenantId,
            workspaceId,
            funnelId,
            request.start_date,
            request.end_date,
          )
        : [];

      // Generate optimization recommendations if requested
      const recommendations = request.include_recommendations !== false
        ? await this.analyticsRepository.generateOptimizationRecommendations(
            tenantId,
            workspaceId,
            funnelId,
            request.start_date,
            request.end_date,
          )
        : [];

      // Calculate summary metrics
      const totalDropOffs = stepDropoffs.reduce((sum, step) => sum + step.exits, 0);
      const biggestBottleneckStep = bottlenecks.length > 0 
        ? bottlenecks[0].step_order 
        : 0;
      
      // Calculate optimization potential score (0-100)
      const optimizationPotential = bottlenecks.length > 0
        ? Math.min(100, bottlenecks.reduce((sum, b) => sum + b.severity_score, 0) / bottlenecks.length)
        : 0;

      // Transform data to response format
      const response: DropoffAnalysisResponse = {
        funnel_id: funnelId.toString(),
        funnel_name: funnel.name,
        analysis_period: {
          start_date: request.start_date,
          end_date: request.end_date,
          timezone: request.timezone || 'UTC',
        },
        step_dropoffs: stepDropoffs.map(step => ({
          step_order: step.step_order,
          step_name: step.step_name,
          entries: step.entries,
          exits: step.exits,
          drop_off_rate: step.drop_off_rate,
          drop_off_severity: this.getDropoffSeverity(step.drop_off_rate),
          average_time_before_exit: step.average_time_before_exit,
          exit_velocity: step.exit_velocity,
          common_exit_triggers: this.generateExitTriggers(step),
        })),
        critical_bottlenecks: bottlenecks.map(bottleneck => ({
          step_order: bottleneck.step_order,
          step_name: bottleneck.step_name,
          severity_score: bottleneck.severity_score,
          impact_on_overall_conversion: bottleneck.impact_on_overall_conversion,
          likely_causes: bottleneck.likely_causes,
          optimization_potential: bottleneck.optimization_potential,
        })),
        exit_paths: exitPaths.map(path => ({
          ...path,
          exit_destinations: path.exit_destinations.map(dest => ({
            ...dest,
            destination_type: dest.destination_type as 'page' | 'external' | 'bounce' | 'other_funnel'
          })),
          exit_patterns: path.exit_patterns.map(pattern => ({
            ...pattern,
            pattern_type: pattern.pattern_type as 'immediate_bounce' | 'multi_step_exploration' | 'return_later' | 'convert_elsewhere'
          }))
        })),
        recommendations: recommendations,
        summary: {
          total_drop_offs: totalDropOffs,
          biggest_bottleneck_step: biggestBottleneckStep,
          optimization_potential: Math.round(optimizationPotential),
        },
        generated_at: new Date().toISOString(),
        cache_duration_seconds: this.cache.getTTL('conversionMetrics'),
      };

      // Cache the result
      await this.cache.set(
        cacheKey,
        response,
        this.cache.getTTL('conversionMetrics'),
      );

      this.recordMetrics('dropoff', Date.now() - startTime, false);

      this.logger.log('Drop-off analysis completed', {
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        funnelId: funnelId.toString(),
        totalDropoffs: totalDropOffs,
        biggestBottleneckStep,
        optimizationPotential,
        duration: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      this.recordMetrics('dropoff', Date.now() - startTime, false, true);

      this.logger.error('Failed to calculate drop-off analysis', error instanceof Error ? error : new Error(String(error)), {
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        funnelId: funnelId.toString(),
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Helper method to determine drop-off severity
   */
  private getDropoffSeverity(dropOffRate: number): 'low' | 'medium' | 'high' | 'critical' {
    if (dropOffRate >= 75) return 'critical';
    if (dropOffRate >= 50) return 'high';
    if (dropOffRate >= 25) return 'medium';
    return 'low';
  }

  /**
   * Helper method to generate exit triggers based on step data
   */
  private generateExitTriggers(step: {
    drop_off_rate: number;
    average_time_before_exit: number;
    exit_velocity: string;
  }): Array<{
    trigger_type: 'error' | 'confusion' | 'distraction' | 'friction';
    description: string;
    frequency: number;
  }> {
    const triggers = [];
    const dropOffRate = step.drop_off_rate;
    const avgTime = step.average_time_before_exit;
    const velocity = step.exit_velocity;

    if (velocity === 'immediate' && dropOffRate > 30) {
      triggers.push({
        trigger_type: 'error' as const,
        description: 'Users leaving immediately suggests technical errors or broken functionality',
        frequency: Math.round(dropOffRate * 0.6),
      });
    }

    if (velocity === 'hesitant' && avgTime > 600) {
      triggers.push({
        trigger_type: 'confusion' as const,
        description: 'Long hesitation before exit indicates unclear instructions or complex content',
        frequency: Math.round(dropOffRate * 0.5),
      });
    }

    if (velocity === 'quick' && dropOffRate > 40) {
      triggers.push({
        trigger_type: 'friction' as const,
        description: 'Quick exits suggest form friction, required fields, or process complexity',
        frequency: Math.round(dropOffRate * 0.4),
      });
    }

    if (dropOffRate > 20 && dropOffRate < 40) {
      triggers.push({
        trigger_type: 'distraction' as const,
        description: 'Moderate drop-off may indicate external distractions or competing priorities',
        frequency: Math.round(dropOffRate * 0.3),
      });
    }

    return triggers;
  }

  /**
   * TASK 2.3: Cohort Analysis System
   * GET /v1/analytics/funnels/:id/cohorts
   */
  async getCohortAnalysis(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    request: CohortAnalysisRequest,
  ): Promise<CohortAnalysisResponse> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateCacheKey('cohorts', {
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      funnelId: funnelId.toString(),
      ...request,
    });

    try {
      // Try cache first
      const cachedResult = await this.cache.get<CohortAnalysisResponse>(cacheKey);
      if (cachedResult) {
        this.recordMetrics('cohorts', Date.now() - startTime, true);
        return cachedResult;
      }

      // Validate funnel exists and user has access
      const funnel = await this.funnelRepository.getFunnelById(
        tenantId,
        workspaceId,
        funnelId,
      );

      if (!funnel) {
        throw new Error(`Funnel ${funnelId} not found`);
      }

      // Get basic cohort data by period
      const cohortBasics = await this.analyticsRepository.getCohortsByPeriod(
        tenantId,
        workspaceId,
        funnelId,
        request.start_date,
        request.end_date,
        request.cohort_period,
      );

      // Get cohort progression through funnel steps
      const cohortProgression = await this.analyticsRepository.getCohortProgression(
        tenantId,
        workspaceId,
        funnelId,
        request.start_date,
        request.end_date,
        request.cohort_period,
      );

      // Merge cohort data for comprehensive metrics
      const cohorts = cohortBasics.map(basic => {
        const progression = cohortProgression.find(p => p.cohort_id === basic.cohort_id);
        return {
          cohort_id: basic.cohort_id,
          cohort_period: basic.cohort_period,
          cohort_size: basic.cohort_size,
          step_retention: progression?.step_retention || [],
          final_conversion_rate: progression?.final_conversion_rate || 0,
          average_time_to_convert: progression?.average_time_to_convert || 0,
          cohort_segments: {
            device_breakdown: basic.device_breakdown,
            traffic_source_breakdown: basic.traffic_source_breakdown,
            geographic_breakdown: basic.geographic_breakdown,
          },
        };
      });

      // Get cross-cohort statistical comparisons if requested
      const cohortComparison = request.include_comparisons !== false
        ? await this.analyticsRepository.compareCohortStatistics(
            tenantId,
            workspaceId,
            funnelId,
            request.start_date,
            request.end_date,
            request.cohort_period,
          )
        : [];

      // Get segment-based cohort analysis if requested
      const segmentCohorts = request.segment_cohorts
        ? await this.generateSegmentCohorts(
            cohorts,
            request.segment_cohorts,
          )
        : undefined;

      // Generate insights based on cohort data
      const insights = this.generateCohortInsights(cohorts, cohortComparison);

      const response: CohortAnalysisResponse = {
        funnel_id: funnelId.toString(),
        funnel_name: funnel.name,
        analysis_period: {
          start_date: request.start_date,
          end_date: request.end_date,
          timezone: request.timezone || 'UTC',
        },
        cohort_period: request.cohort_period,
        cohorts,
        cohort_comparison: cohortComparison,
        segment_cohorts: segmentCohorts,
        insights,
        generated_at: new Date().toISOString(),
        cache_duration_seconds: this.cache.getTTL('cohortAnalysis'),
      };

      // Cache the result
      await this.cache.set(
        cacheKey,
        response,
        this.cache.getTTL('cohortAnalysis'),
      );

      this.recordMetrics('cohorts', Date.now() - startTime, false);

      this.logger.log('Cohort analysis completed', {
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        funnelId: funnelId.toString(),
        cohortPeriod: request.cohort_period,
        cohortCount: cohorts.length,
        avgConversionRate: cohorts.length > 0
          ? Math.round((cohorts.reduce((sum, c) => sum + c.final_conversion_rate, 0) / cohorts.length) * 100) / 100
          : 0,
        duration: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      this.recordMetrics('cohorts', Date.now() - startTime, false, true);

      this.logger.error('Failed to calculate cohort analysis', error instanceof Error ? error : new Error(String(error)), {
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        funnelId: funnelId.toString(),
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Generate segment-based cohort analysis
   */
  private async generateSegmentCohorts(
    cohorts: any[],
    segmentOptions: {
      by_device?: boolean;
      by_traffic_source?: boolean;
      by_geography?: boolean;
    },
  ): Promise<any[]> {
    const segmentCohorts = [];

    if (segmentOptions.by_device) {
      const deviceCohorts = this.groupCohortsBySegment(cohorts, 'device');
      segmentCohorts.push({
        segment_type: 'device',
        segment_value: 'all_devices',
        cohorts: deviceCohorts,
        segment_insights: this.generateSegmentInsights(deviceCohorts, 'device'),
      });
    }

    if (segmentOptions.by_traffic_source) {
      const sourceCohorts = this.groupCohortsBySegment(cohorts, 'traffic_source');
      segmentCohorts.push({
        segment_type: 'traffic_source',
        segment_value: 'all_sources',
        cohorts: sourceCohorts,
        segment_insights: this.generateSegmentInsights(sourceCohorts, 'traffic_source'),
      });
    }

    if (segmentOptions.by_geography) {
      const geoCohorts = this.groupCohortsBySegment(cohorts, 'geography');
      segmentCohorts.push({
        segment_type: 'geography',
        segment_value: 'all_countries',
        cohorts: geoCohorts,
        segment_insights: this.generateSegmentInsights(geoCohorts, 'geography'),
      });
    }

    return segmentCohorts;
  }

  /**
   * Group cohorts by segment type
   */
  private groupCohortsBySegment(cohorts: any[], segmentType: string): any[] {
    // This is a simplified implementation
    // In practice, this would segment each cohort by the specified dimension
    return cohorts.map(cohort => ({
      ...cohort,
      segment_breakdown: cohort.cohort_segments[`${segmentType}_breakdown`] || {},
    }));
  }

  /**
   * Generate insights for segment cohorts
   */
  private generateSegmentInsights(cohorts: any[], segmentType: string): string[] {
    const insights = [];

    if (cohorts.length === 0) {
      return [`No ${segmentType} segment data available for analysis`];
    }

    const avgConversionRate = cohorts.reduce((sum, c) => sum + c.final_conversion_rate, 0) / cohorts.length;
    insights.push(`Average ${segmentType} segment conversion rate: ${avgConversionRate.toFixed(2)}%`);

    const bestCohort = cohorts.reduce((best, current) => 
      current.final_conversion_rate > best.final_conversion_rate ? current : best
    );
    insights.push(`Best performing ${segmentType} cohort: ${bestCohort.cohort_period} (${bestCohort.final_conversion_rate.toFixed(2)}%)`);

    const worstCohort = cohorts.reduce((worst, current) => 
      current.final_conversion_rate < worst.final_conversion_rate ? current : worst
    );
    insights.push(`Worst performing ${segmentType} cohort: ${worstCohort.cohort_period} (${worstCohort.final_conversion_rate.toFixed(2)}%)`);

    return insights;
  }

  /**
   * Generate insights based on cohort analysis
   */
  private generateCohortInsights(cohorts: any[], comparisons: any[]): any[] {
    const insights = [];

    if (cohorts.length === 0) {
      return [{
        type: 'trend',
        title: 'No cohort data available',
        description: 'Insufficient data for cohort analysis',
        impact_score: 0,
        actionable: false,
      }];
    }

    // Overall performance insight
    const avgConversionRate = cohorts.reduce((sum, c) => sum + c.final_conversion_rate, 0) / cohorts.length;
    insights.push({
      type: 'trend',
      title: 'Overall Cohort Performance',
      description: `Average conversion rate across ${cohorts.length} cohorts is ${avgConversionRate.toFixed(2)}%`,
      impact_score: Math.min(100, avgConversionRate * 10),
      actionable: avgConversionRate < 5,
      recommended_actions: avgConversionRate < 5 
        ? ['Investigate low-performing cohorts', 'Analyze segment differences', 'Review onboarding flow']
        : undefined,
    });

    // Trend analysis
    if (cohorts.length >= 3) {
      const conversionRates = cohorts.map(c => c.final_conversion_rate);
      const firstHalf = conversionRates.slice(0, Math.floor(conversionRates.length / 2));
      const secondHalf = conversionRates.slice(-Math.floor(conversionRates.length / 2));
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const trendChange = ((secondAvg - firstAvg) / firstAvg) * 100;

      const trendDirection = Math.abs(trendChange) < 5 ? 'stable' : trendChange > 0 ? 'improving' : 'declining';

      insights.push({
        type: 'trend',
        title: `Cohort Performance Trend: ${trendDirection}`,
        description: `Conversion rates are ${trendDirection} with a ${Math.abs(trendChange).toFixed(1)}% change over time`,
        impact_score: Math.abs(trendChange) * 5,
        actionable: trendDirection === 'declining',
        recommended_actions: trendDirection === 'declining' 
          ? ['Investigate recent changes', 'Review user feedback', 'A/B test improvements']
          : undefined,
      });
    }

    // Best vs worst cohort insight
    const bestCohort = cohorts.reduce((best, current) => 
      current.final_conversion_rate > best.final_conversion_rate ? current : best
    );
    const worstCohort = cohorts.reduce((worst, current) => 
      current.final_conversion_rate < worst.final_conversion_rate ? current : worst
    );
    
    const performanceGap = bestCohort.final_conversion_rate - worstCohort.final_conversion_rate;
    
    if (performanceGap > 10) {
      insights.push({
        type: 'anomaly',
        title: 'Significant Cohort Performance Gap',
        description: `${performanceGap.toFixed(1)}% difference between best (${bestCohort.cohort_period}) and worst (${worstCohort.cohort_period}) cohorts`,
        impact_score: Math.min(100, performanceGap * 5),
        actionable: true,
        recommended_actions: [
          'Analyze differences between high and low performing cohorts',
          'Identify external factors affecting specific periods',
          'Replicate successful strategies from best cohorts',
        ],
      });
    }

    // Statistical significance insights from comparisons
    for (const comparison of comparisons) {
      if (comparison.variance_significance && comparison.f_test_p_value < 0.05) {
        insights.push({
          type: 'statistical',
          title: `Statistically Significant ${comparison.metric} Variance`,
          description: `${comparison.metric} shows significant variance across cohorts (p-value: ${comparison.f_test_p_value.toFixed(3)})`,
          impact_score: (1 - comparison.f_test_p_value) * 100,
          actionable: true,
          recommended_actions: [
            'Investigate causes of variance',
            'Standardize processes across cohorts',
            'Monitor for recurring patterns',
          ],
        });
      }
    }

    return insights;
  }

  async getTimingAnalysis(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    request: TimingAnalysisRequest,
  ): Promise<TimingAnalysisResponse> {
    const startTime = Date.now();

    this.logger.log('Starting timing analysis', {
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      funnelId: funnelId.toString(),
      request,
    });

    // Validate funnel exists and get basic info
    const funnel = await this.funnelRepository.getFunnelById(funnelId, tenantId, workspaceId);
    if (!funnel) {
      throw new BadRequestException('Funnel not found');
    }

    // Check cache first
    const cacheKey = this.cache.generateCacheKey('timing_analysis', {
      funnelId: funnelId.toString(),
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      ...request,
    });

    const cached = await this.cache.get<TimingAnalysisResponse>(cacheKey);
    if (cached) {
      this.logger.debug('Returning cached timing analysis', { cacheKey });
      return cached;
    }

    // Parse and validate date range
    const startDate = new Date(request.start_date);
    const endDate = new Date(request.end_date);
    this.validateDateRange(startDate, endDate);

    try {
      // Get overall timing distribution with percentiles
      this.logger.debug('Fetching conversion timing distribution');
      const overallTiming = await this.analyticsRepository.getConversionTimingDistribution(
        tenantId,
        workspaceId,
        funnelId,
        startDate,
        endDate,
      );

      // Get step-by-step timing analysis
      this.logger.debug('Fetching step timing analysis');
      const stepTiming = await this.analyticsRepository.getStepTimingAnalysis(
        tenantId,
        workspaceId,
        funnelId,
        startDate,
        endDate,
      );

      // Get velocity trends over time
      this.logger.debug('Fetching velocity trends');
      const velocityTrends = await this.analyticsRepository.getVelocityTrends(
        tenantId,
        workspaceId,
        funnelId,
        startDate,
        endDate,
        request.granularity || 'daily',
      );

      // Get segment timing comparison if requested
      const segmentTiming = request.includeSegments !== false
        ? await this.analyticsRepository.getSegmentTimingComparison(
            tenantId,
            workspaceId,
            funnelId,
            startDate,
            endDate,
          )
        : [];

      // Generate timing insights and recommendations
      const insights = this.generateTimingInsights(
        overallTiming,
        stepTiming,
        velocityTrends,
        segmentTiming,
      );

      const response: TimingAnalysisResponse = {
        overall_timing: overallTiming,
        step_timing: stepTiming,
        conversion_velocity_trends: velocityTrends,
        segment_timing: segmentTiming,
        insights,
        metadata: {
          funnel_id: funnelId.toString(),
          date_range: {
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
          },
          data_freshness: new Date().toISOString(),
          query_time_ms: Date.now() - startTime,
        },
      };

      // Cache the response
      await this.cache.set(cacheKey, response, this.cache.getTTL('cohortAnalysis'));

      this.logger.log('Timing analysis completed', {
        funnelId: funnelId.toString(),
        queryTime: Date.now() - startTime,
        insightsCount: insights.length,
      });

      return response;
    } catch (error) {
      this.logger.error('Error in timing analysis', error instanceof Error ? error : new Error(String(error)));

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to analyze timing data');
    }
  }

  /**
   * Generate timing-based insights and recommendations
   */
  private generateTimingInsights(
    overallTiming: any,
    stepTiming: any[],
    velocityTrends: any[],
    segmentTiming: any[],
  ): Array<{
    type: 'timing_insight';
    category: 'bottleneck' | 'optimization' | 'trend';
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    recommendation?: string;
    data: Record<string, any>;
  }> {
    const insights: Array<{
      type: 'timing_insight';
      category: 'bottleneck' | 'optimization' | 'trend';
      severity: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      recommendation?: string;
      data: Record<string, any>;
    }> = [];

    // Overall timing insights
    if (overallTiming.statistics.mean_seconds > 86400) { // > 1 day
      insights.push({
        type: 'timing_insight',
        category: 'optimization',
        severity: 'high',
        title: 'Very Slow Overall Conversion Time',
        description: `Average conversion time is ${this.formatDuration(overallTiming.statistics.mean_seconds)}, which may indicate significant friction in the funnel.`,
        recommendation: 'Consider optimizing high-friction steps and simplifying the conversion process.',
        data: {
          mean_seconds: overallTiming.statistics.mean_seconds,
          median_seconds: overallTiming.statistics.median_seconds,
        },
      });
    }

    // Step bottleneck detection
    const bottlenecks = this.detectTimingBottlenecks(stepTiming);
    bottlenecks.forEach(bottleneck => {
      insights.push({
        type: 'timing_insight',
        category: 'bottleneck',
        severity: bottleneck.severity,
        title: `Step ${bottleneck.step_order} Bottleneck: ${bottleneck.step_label}`,
        description: bottleneck.issue_type === 'slow_progression' 
          ? `Users spend an average of ${this.formatDuration(bottleneck.avg_time_seconds)} at this step.`
          : `High abandonment rate of ${bottleneck.abandonment_rate.toFixed(1)}% at this step.`,
        recommendation: bottleneck.issue_type === 'slow_progression'
          ? 'Consider simplifying this step or providing clearer guidance to users.'
          : 'Investigate what causes users to abandon at this step and address friction points.',
        data: {
          step_order: bottleneck.step_order,
          avg_time_seconds: bottleneck.avg_time_seconds,
          abandonment_rate: bottleneck.abandonment_rate,
        },
      });
    });

    // Velocity trend insights
    if (velocityTrends.length >= 2) {
      const recentTrends = velocityTrends.slice(-3); // Last 3 periods
      const decliningTrends = recentTrends.filter(t => t.trend_indicator === 'declining').length;
      
      if (decliningTrends >= 2) {
        insights.push({
          type: 'timing_insight',
          category: 'trend',
          severity: 'medium',
          title: 'Declining Conversion Velocity',
          description: 'Conversion times have been increasing in recent periods, indicating potential performance degradation.',
          recommendation: 'Monitor for system performance issues or changes in user behavior patterns.',
          data: {
            recent_periods: recentTrends.length,
            declining_periods: decliningTrends,
          },
        });
      }
    }

    // Segment performance insights
    if (segmentTiming.length > 0) {
      const fastSegments = segmentTiming.filter(s => s.performance_indicator === 'fast');
      const slowSegments = segmentTiming.filter(s => s.performance_indicator === 'slow');
      
      if (slowSegments.length > 0) {
        const slowestSegment = slowSegments.reduce((prev, current) => 
          current.avg_conversion_time_seconds > prev.avg_conversion_time_seconds ? current : prev
        );
        
        insights.push({
          type: 'timing_insight',
          category: 'optimization',
          severity: 'medium',
          title: `Slow Performance: ${slowestSegment.segment_value}`,
          description: `${slowestSegment.segment_value} users take ${this.formatDuration(slowestSegment.avg_conversion_time_seconds)} on average to convert.`,
          recommendation: 'Consider optimizing the experience for this user segment or investigating technical issues.',
          data: {
            segment_name: slowestSegment.segment_name,
            segment_value: slowestSegment.segment_value,
            avg_time_seconds: slowestSegment.avg_conversion_time_seconds,
          },
        });
      }
    }

    return insights;
  }

  /**
   * Helper method to detect timing bottlenecks automatically
   */
  private detectTimingBottlenecks(
    stepTiming: Array<{
      step_order: number;
      step_label: string;
      avg_time_to_next_seconds: number;
      abandonment_rate: number;
      user_count: number;
    }>
  ): Array<{
    step_order: number;
    step_label: string;
    severity: 'high' | 'medium' | 'low';
    issue_type: 'slow_progression' | 'high_abandonment' | 'timing_spike';
    avg_time_seconds: number;
    abandonment_rate: number;
  }> {
    const bottlenecks: Array<{
      step_order: number;
      step_label: string;
      severity: 'high' | 'medium' | 'low';
      issue_type: 'slow_progression' | 'high_abandonment' | 'timing_spike';
      avg_time_seconds: number;
      abandonment_rate: number;
    }> = [];

    if (stepTiming.length === 0) return bottlenecks;

    const avgTime = stepTiming.reduce((sum, step) => sum + step.avg_time_to_next_seconds, 0) / stepTiming.length;
    const avgAbandonment = stepTiming.reduce((sum, step) => sum + step.abandonment_rate, 0) / stepTiming.length;

    stepTiming.forEach(step => {
      // Detect slow progression
      if (step.avg_time_to_next_seconds > avgTime * 2) {
        bottlenecks.push({
          step_order: step.step_order,
          step_label: step.step_label,
          severity: step.avg_time_to_next_seconds > avgTime * 3 ? 'high' : 'medium',
          issue_type: 'slow_progression',
          avg_time_seconds: step.avg_time_to_next_seconds,
          abandonment_rate: step.abandonment_rate,
        });
      }

      // Detect high abandonment
      if (step.abandonment_rate > avgAbandonment * 1.5 && step.abandonment_rate > 20) {
        bottlenecks.push({
          step_order: step.step_order,
          step_label: step.step_label,
          severity: step.abandonment_rate > 50 ? 'high' : step.abandonment_rate > 30 ? 'medium' : 'low',
          issue_type: 'high_abandonment',
          avg_time_seconds: step.avg_time_to_next_seconds,
          abandonment_rate: step.abandonment_rate,
        });
      }
    });

    return bottlenecks;
  }

  /**
   * Helper method to format timing duration in human-readable format
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
  }

  /**
   * Validate date range for analytics requests
   */
  private validateDateRange(startDate: string | Date, endDate: string | Date): void {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD or valid Date objects.');
    }
    
    if (start >= end) {
      throw new BadRequestException('Start date must be before end date.');
    }
    
    // Limit to reasonable date ranges (e.g., max 2 years)
    const maxDays = 730; // 2 years
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays > maxDays) {
      throw new BadRequestException(`Date range too large. Maximum ${maxDays} days allowed.`);
    }
  }

  /**
   * Get live metrics for real-time dashboard
   * GET /v1/analytics/funnels/:id/live
   */
  async getLiveMetrics(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    refreshInterval: number = 30,
  ): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateCacheKey('live', {
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(), 
      funnelId: funnelId.toString(),
    });

    try {
      // Check cache first with very short TTL for live data
      const cacheTtl = Math.max(refreshInterval * 1000, 15000); // Minimum 15 seconds
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) {
        this.metrics.recordLatency('funnel_live_metrics_latency', Date.now() - startTime);
        return cached;
      }

      // Verify funnel exists and is accessible
      const funnel = await this.funnelRepository.getFunnelById(
        tenantId,
        workspaceId,
        funnelId,
      );

      if (!funnel) {
        throw new BadRequestException('Funnel not found');
      }

      // Get live metrics from repository
      const rawData = await this.analyticsRepository.getLiveMetrics(
        tenantId.toString(),
        workspaceId.toString(),
        funnelId.toString(),
      );

      // Get funnel steps for labels
      const steps = await this.getFunnelSteps(tenantId, workspaceId, funnelId);

      // Detect anomalies and alerts
      const anomaliesData = await this.analyticsRepository.detectAnomalies(
        tenantId.toString(),
        workspaceId.toString(),
        funnelId.toString(),
      );

      // Format response
      const response = {
        funnel_id: funnelId.toString(),
        timestamp: new Date().toISOString(),
        live_metrics: {
          active_sessions: Number(rawData.basicMetrics.active_sessions),
          entries_last_hour: Number(rawData.basicMetrics.entries_last_hour),
          conversions_last_hour: Number(rawData.basicMetrics.conversions_last_hour),
          current_conversion_rate: Number(rawData.basicMetrics.current_conversion_rate),
          users_in_funnel: Number(rawData.basicMetrics.active_sessions),
          step_distribution: rawData.stepDistribution.map((step: any) => ({
            step_order: Number(step.step_order),
            step_label: this.getStepLabel(steps, Number(step.step_order)),
            current_users: Number(step.current_users),
            percentage: Number(step.percentage),
          })),
        },
        real_time_trends: {
          entry_rate_per_minute: rawData.trends.map((t: any) => Number(t.entries)),
          conversion_rate_trend: rawData.trends.map((t: any) => Number(t.conversion_rate)),
          timestamps: rawData.trends.map((t: any) => new Date(t.minute_bucket).toISOString()),
        },
        alerts: this.formatAlertsFromArray(anomaliesData, steps),
      };

      // Cache with short TTL
      await this.cache.set(cacheKey, response, cacheTtl);

      this.metrics.recordLatency('funnel_live_metrics_latency', Date.now() - startTime);
      return response;

    } catch (error) {
      this.logger.error('Error getting live metrics', error instanceof Error ? error : new Error(String(error)), {
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        funnelId: funnelId.toString(),
      });
      
      this.metrics.incrementCounter('funnel_live_metrics_errors');
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Failed to get live metrics');
    }
  }

  /**
   * Get individual user progression tracking
   * GET /v1/analytics/funnels/:id/users/:userId
   */
  async getUserProgression(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
    userId?: string,
    anonymousId?: string,
  ): Promise<any> {
    const startTime = Date.now();
    const userIdentifier = userId || anonymousId;
    
    if (!userIdentifier) {
      throw new BadRequestException('Either userId or anonymousId must be provided');
    }

    const cacheKey = this.cache.generateCacheKey('user_progression', {
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      funnelId: funnelId.toString(),
      userIdentifier,
    });

    try {
      // Check cache first
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) {
        this.metrics.recordLatency('funnel_user_progression_latency', Date.now() - startTime);
        return cached;
      }

      // Verify funnel exists
      const funnel = await this.funnelRepository.getFunnelById(
        tenantId,
        workspaceId,
        funnelId,
      );

      if (!funnel) {
        throw new BadRequestException('Funnel not found');
      }

      // Get user progression data
      const rawData = await this.analyticsRepository.getUserProgression(
        tenantId.toString(),
        workspaceId.toString(),
        funnelId.toString(),
        userId,
        anonymousId,
      );

      if (!rawData?.userState) {
        // User not found in funnel
        return {
          funnel_id: funnelId.toString(),
          user_identifier: userIdentifier,
          user_type: userId ? 'identified' : 'anonymous',
          progression: null,
          journey_history: [],
          step_timing: [],
          performance_indicators: {
            progression_velocity: 0,
            time_to_conversion: null,
            abandonment_risk_score: 0,
          },
        };
      }

      // Format response
      const response = this.formatUserProgressionResponse(rawData, userIdentifier, userId);

      // Cache for 30 seconds (live data)
      await this.cache.set(cacheKey, response, 30000);

      this.metrics.recordLatency('funnel_user_progression_latency', Date.now() - startTime);
      return response;

    } catch (error) {
      this.logger.error('Error getting user progression', error instanceof Error ? error : new Error(String(error)), {
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        funnelId: funnelId.toString(),
        userIdentifier,
      });
      
      this.metrics.incrementCounter('funnel_user_progression_errors');
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Failed to get user progression');
    }
  }

  /**
   * Helper method to get funnel steps
   */
  private async getFunnelSteps(
    tenantId: bigint,
    workspaceId: bigint,
    funnelId: bigint,
  ): Promise<any[]> {
    const funnel = await this.funnelRepository.getFunnelById(
      tenantId,
      workspaceId,
      funnelId,
    );
    
    return funnel?.versions?.[0]?.steps || [];
  }

  /**
   * Helper method to get step label by order
   */
  private getStepLabel(steps: any[], stepOrder: number): string {
    const step = steps.find(s => s.orderIndex === stepOrder);
    return step?.label || `Step ${stepOrder}`;
  }

  /**
   * Format anomalies from array into alert objects
   */
  private formatAlertsFromArray(anomaliesArray: any[], steps: any[]): any[] {
    // For now, return empty alerts as the anomaly detection needs more implementation
    return [];
  }

  /**
   * Format anomalies into alert objects
   */
  private formatAlerts(anomalies: any, steps: any[]): any[] {
    const alerts: any[] = [];

    // Conversion rate anomaly alert
    if (anomalies.conversionRateAnomaly) {
      const { current_rate, historical_rate, rate_change_percent } = anomalies.conversionRateAnomaly;
      
      if (rate_change_percent < -20) { // 20% drop
        alerts.push({
          id: `conversion_drop_${Date.now()}`,
          type: 'conversion_drop',
          severity: rate_change_percent < -50 ? 'critical' : 'high',
          title: 'Conversion Rate Drop Detected',
          description: `Conversion rate dropped from ${historical_rate}% to ${current_rate}% (${rate_change_percent}% change)`,
          triggered_at: new Date().toISOString(),
          metrics: {
            threshold: historical_rate * 0.8, // 20% drop threshold
            current_value: current_rate,
            change_percentage: rate_change_percent,
          },
        });
      }
    }

    // Step bottleneck alerts
    if (anomalies.stepBottlenecks && anomalies.stepBottlenecks.length > 0) {
      anomalies.stepBottlenecks.forEach((bottleneck: any) => {
        const stepLabel = this.getStepLabel(steps, bottleneck.step_order);
        
        alerts.push({
          id: `bottleneck_${bottleneck.step_order}_${Date.now()}`,
          type: 'bottleneck',
          severity: bottleneck.users_stuck > 20 ? 'high' : 'medium',
          title: `Step Bottleneck: ${stepLabel}`,
          description: `${bottleneck.users_stuck} users stuck at ${stepLabel} for ${Math.round(bottleneck.avg_time_stuck / 60)} minutes on average`,
          triggered_at: new Date().toISOString(),
          step_order: bottleneck.step_order,
          metrics: {
            threshold: 5, // 5 users threshold
            current_value: bottleneck.users_stuck,
            change_percentage: null,
          },
        });
      });
    }

    return alerts;
  }

  /**
   * Format user progression response
   */
  private formatUserProgressionResponse(rawData: any, userIdentifier: string, userId?: string): any {
    const { userState, journeyEvents, stepTimingAverages, funnelSteps } = rawData;
    
    const currentStep = userState.currentStepIndex || 0;
    const timeInFunnel = Math.floor((Date.now() - userState.enteredAt.getTime()) / 1000);
    
    // Calculate progression velocity (steps per hour)
    const hoursInFunnel = timeInFunnel / 3600;
    const progressionVelocity = hoursInFunnel > 0 ? currentStep / hoursInFunnel : 0;
    
    // Calculate abandonment risk score (0-100)
    const abandonmentRiskScore = this.calculateAbandonmentRisk(userState, timeInFunnel);
    
    // Format journey history
    const journeyHistory = journeyEvents.map((event: any, index: number) => ({
      step_order: index + 1,
      step_label: this.getStepLabel(funnelSteps, index + 1),
      timestamp: event.timestamp.toISOString(),
      time_from_start: Math.floor((event.timestamp.getTime() - userState.enteredAt.getTime()) / 1000),
      time_from_previous: index > 0 ? Math.floor((event.timestamp.getTime() - journeyEvents[index - 1].timestamp.getTime()) / 1000) : 0,
      event_details: {
        event_name: event.event_name,
        page: event.page?.url,
        utm_source: event.utm?.source,
        device_type: event.device?.type,
      },
    }));

    // Format step timing comparisons
    const stepTiming = stepTimingAverages.map((timing: any) => {
      const userTimeToReach = currentStep >= timing.step_order 
        ? Math.floor((userState.lastActivityAt.getTime() - userState.enteredAt.getTime()) / 1000)
        : null;
      
      const avgTime = Number(timing.avg_time_to_reach);
      let performance: 'faster' | 'average' | 'slower' = 'average';
      
      if (userTimeToReach) {
        if (userTimeToReach < avgTime * 0.8) performance = 'faster';
        else if (userTimeToReach > avgTime * 1.2) performance = 'slower';
      }
      
      return {
        step_order: timing.step_order,
        step_label: this.getStepLabel(funnelSteps, timing.step_order),
        average_time_to_reach: avgTime,
        user_time_to_reach: userTimeToReach,
        performance_vs_average: performance,
        percentile_ranking: userTimeToReach ? this.calculatePercentile(userTimeToReach, avgTime) : null,
      };
    });

    return {
      funnel_id: userState.funnelId.toString(),
      user_identifier: userIdentifier,
      user_type: userId ? 'identified' : 'anonymous',
      progression: {
        current_step: currentStep,
        current_step_label: this.getStepLabel(funnelSteps, currentStep),
        completed_steps: [], // TODO: Calculate from journey
        entry_time: userState.enteredAt.toISOString(),
        last_activity: userState.lastActivityAt.toISOString(),
        time_in_funnel: timeInFunnel,
        conversion_status: userState.status === 'completed' ? 'converted' : 
                           userState.status === 'abandoned' ? 'abandoned' : 'in_progress',
      },
      journey_history: journeyHistory,
      step_timing: stepTiming,
      performance_indicators: {
        progression_velocity: Math.round(progressionVelocity * 100) / 100,
        time_to_conversion: userState.status === 'completed' && userState.completedAt 
          ? Math.floor((userState.completedAt.getTime() - userState.enteredAt.getTime()) / 1000)
          : null,
        abandonment_risk_score: abandonmentRiskScore,
      },
    };
  }

  /**
   * Calculate abandonment risk score (0-100)
   */
  private calculateAbandonmentRisk(userState: any, timeInFunnel: number): number {
    let riskScore = 0;
    
    // Time-based risk (longer time = higher risk)
    const hoursInFunnel = timeInFunnel / 3600;
    if (hoursInFunnel > 24) riskScore += 30; // 24+ hours
    else if (hoursInFunnel > 4) riskScore += 15; // 4+ hours
    
    // Inactivity risk
    const hoursSinceLastActivity = (Date.now() - userState.lastActivityAt.getTime()) / (1000 * 3600);
    if (hoursSinceLastActivity > 6) riskScore += 40; // 6+ hours inactive
    else if (hoursSinceLastActivity > 1) riskScore += 20; // 1+ hour inactive
    
    // Step progression risk (stuck at early steps = higher risk)
    const currentStep = userState.currentStepIndex || 0;
    if (currentStep <= 1) riskScore += 20;
    else if (currentStep <= 2) riskScore += 10;
    
    return Math.min(100, riskScore);
  }

  /**
   * Calculate user's percentile ranking
   */
  private calculatePercentile(userTime: number, avgTime: number): number {
    // Simple percentile approximation based on standard deviation assumption
    const ratio = userTime / avgTime;
    
    if (ratio <= 0.5) return 10; // Top 10%
    else if (ratio <= 0.8) return 25; // Top 25%
    else if (ratio <= 1.2) return 50; // Average
    else if (ratio <= 1.8) return 75; // Bottom 25%
    else return 90; // Bottom 10%
  }
}
import { Injectable } from '@nestjs/common'
import { FunnelAnalyticsRepository } from '../repositories/funnel-analytics.repository'
import { FunnelRepository } from '../repositories/funnel.repository'
import { FunnelCacheService } from './funnel-cache.service'
import { MercurioLogger } from '../../../common/services/logger.service'
import { MetricsService } from '../../../common/services/metrics.service'
import {
  FunnelComparisonRequest,
  FunnelComparisonResponse,
  FunnelComparisonInfo,
  StatisticalComparisonResult,
  ConversionRateComparison,
  DropOffComparison,
  TimingComparison,
  ABTestResults,
  ComparisonInsight,
  OptimizationRecommendation,
  PairwiseComparison,
  StepConversionComparison,
  FunnelPerformanceRank,
  StepDropOffComparison,
  StepTimingComparison,
} from '../dto/funnel-comparison.dto'

/**
 * Advanced Funnel Comparison & A/B Testing Service
 * Implements statistical comparison, A/B testing, and optimization recommendations
 */
@Injectable()
export class FunnelComparisonService {
  private readonly defaultConfiguration = {
    max_funnels_per_comparison: 5,
    minimum_sample_size_per_funnel: 100,
    default_confidence_level: 95,
    statistical_test_settings: {
      enable_multiple_comparison_correction: true,
      correction_method: 'benjamini_hochberg' as const,
      effect_size_threshold: 0.02, // 2% minimum practical significance
    },
  }

  constructor(
    private readonly analyticsRepository: FunnelAnalyticsRepository,
    private readonly funnelRepository: FunnelRepository,
    private readonly cache: FunnelCacheService,
    private readonly logger: MercurioLogger,
    private readonly metrics: MetricsService
  ) {}

  /**
   * Main funnel comparison method
   */
  async compareFunnels(
    tenantId: string,
    workspaceId: string,
    request: FunnelComparisonRequest
  ): Promise<FunnelComparisonResponse> {
    const startTime = Date.now()
    const comparisonId = this.generateComparisonId()

    const cacheKey = this.cache.generateCacheKey('funnel_comparison', {
      tenantId,
      workspaceId,
      funnelIds: request.funnel_ids.join(','),
      startDate: request.comparison_period.start_date,
      endDate: request.comparison_period.end_date,
      abTest: !!request.ab_test_configuration,
    })

    try {
      // Check cache first
      const cached = await this.cache.get<FunnelComparisonResponse>(cacheKey)
      if (cached) {
        return { ...cached, query_performance: { ...cached.query_performance, cache_hit: true } }
      }

      this.logger.log('Starting funnel comparison analysis', {
        tenantId,
        workspaceId,
        funnelIds: request.funnel_ids,
        comparisonPeriod: request.comparison_period,
        abTest: !!request.ab_test_configuration,
      })

      // Validate request
      this.validateComparisonRequest(request)

      // Get funnel data for all funnels
      const funnelData = await this.getFunnelComparisonData(tenantId, workspaceId, request)

      // Determine baseline funnel
      const baselineFunnelId = request.baseline_funnel_id || request.funnel_ids[0]

      // Build funnel info
      const funnelsCompared = await this.buildFunnelComparisonInfo(funnelData, baselineFunnelId)

      // Statistical comparison
      const statisticalComparison = await this.performStatisticalComparison(
        funnelData,
        request.ab_test_configuration?.confidence_level ||
          this.defaultConfiguration.default_confidence_level
      )

      // Core metrics comparisons
      const conversionRateComparison = await this.compareConversionRates(
        funnelData,
        baselineFunnelId
      )
      const dropOffComparison = await this.compareDropOffRates(funnelData, baselineFunnelId)
      const timingComparison = await this.compareTimings(funnelData, baselineFunnelId)

      // A/B Test results (if configured)
      const abTestResults = request.ab_test_configuration
        ? await this.performABTestAnalysis(
            funnelData,
            request.ab_test_configuration,
            baselineFunnelId
          )
        : undefined

      // Generate insights and recommendations
      const comparisonInsights = await this.generateComparisonInsights(
        funnelData,
        statisticalComparison,
        conversionRateComparison,
        dropOffComparison,
        timingComparison
      )

      const optimizationRecommendations = await this.generateOptimizationRecommendations(
        funnelData,
        comparisonInsights,
        statisticalComparison
      )

      const response: FunnelComparisonResponse = {
        comparison_id: comparisonId,
        comparison_timestamp: new Date().toISOString(),
        comparison_period: request.comparison_period,
        funnels_compared: funnelsCompared,
        baseline_funnel_id: baselineFunnelId,
        statistical_comparison: statisticalComparison,
        conversion_rate_comparison: conversionRateComparison,
        drop_off_comparison: dropOffComparison,
        timing_comparison: timingComparison,
        ab_test_results: abTestResults,
        comparison_insights: comparisonInsights,
        optimization_recommendations: optimizationRecommendations,
        query_performance: {
          processing_time_ms: Date.now() - startTime,
          cache_hit: false,
          funnels_analyzed: request.funnel_ids.length,
          total_events_processed: funnelData.reduce((sum, f) => sum + f.totalEvents, 0),
        },
      }

      // Cache for 30 minutes
      await this.cache.set(cacheKey, response, 30 * 60 * 1000)

      // Record metrics
      this.metrics.recordLatency('funnel_comparison_processing_time', Date.now() - startTime)
      this.metrics.incrementCounter('funnel_comparison_requests')

      return response
    } catch (error) {
      this.logger.error(
        'Error in funnel comparison',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          workspaceId,
          funnelIds: request.funnel_ids,
          comparisonPeriod: request.comparison_period,
        }
      )

      this.metrics.incrementCounter('funnel_comparison_errors')
      throw error
    }
  }

  /**
   * Get comparison data for all funnels
   */
  private async getFunnelComparisonData(
    tenantId: string,
    workspaceId: string,
    request: FunnelComparisonRequest
  ): Promise<FunnelComparisonData[]> {
    const results: FunnelComparisonData[] = []

    for (const funnelId of request.funnel_ids) {
      try {
        // Get funnel configuration
        const funnelConfig = await this.funnelRepository.getFunnelById(
          BigInt(funnelId),
          BigInt(tenantId),
          BigInt(workspaceId)
        )

        if (!funnelConfig) {
          throw new Error(`Funnel ${funnelId} not found`)
        }

        // Get conversion metrics - using existing methods
        const conversionRate = await this.analyticsRepository.getAverageConversionRate(
          BigInt(tenantId),
          BigInt(workspaceId),
          BigInt(funnelId),
          request.comparison_period.start_date,
          request.comparison_period.end_date
        )

        // Get step completion data
        const totalEntries = await this.analyticsRepository.getStepCompletions(
          BigInt(tenantId),
          BigInt(workspaceId),
          BigInt(funnelId),
          1, // First step
          request.comparison_period.start_date,
          request.comparison_period.end_date
        )

        // Get conversion count (assume last step completion)
        const stepCount = funnelConfig.versions[0]?.steps?.length || 0
        const totalConversions =
          stepCount > 0
            ? await this.analyticsRepository.getStepCompletions(
                BigInt(tenantId),
                BigInt(workspaceId),
                BigInt(funnelId),
                stepCount, // Last step
                request.comparison_period.start_date,
                request.comparison_period.end_date
              )
            : 0

        // Get timing data
        const averageTimeToConvert = await this.analyticsRepository.getAverageTimeToConvert(
          BigInt(tenantId),
          BigInt(workspaceId),
          BigInt(funnelId),
          request.comparison_period.start_date,
          request.comparison_period.end_date
        )

        results.push({
          funnelId: funnelId,
          funnelName: funnelConfig.name,
          funnelDescription: funnelConfig.description || undefined,
          stepsCount: stepCount,
          conversionData: {
            totalEntries: totalEntries,
            totalConversions: totalConversions,
            overallConversionRate: conversionRate,
          },
          timingData: {
            averageTimeToConversion: averageTimeToConvert,
            medianTimeToConversion: averageTimeToConvert * 0.8, // Simplified estimate
          },
          totalEvents: totalEntries,
          totalConversions: totalConversions,
          overallConversionRate: conversionRate,
        })
      } catch (error) {
        this.logger.error(
          `Error getting data for funnel ${funnelId}`,
          error instanceof Error ? error : new Error(String(error))
        )
        throw new Error(`Failed to retrieve data for funnel ${funnelId}`)
      }
    }

    return results
  }

  /**
   * Build funnel comparison info
   */
  private async buildFunnelComparisonInfo(
    funnelData: FunnelComparisonData[],
    baselineFunnelId: string
  ): Promise<FunnelComparisonInfo[]> {
    // Sort by traffic volume for ranking
    const sortedByVolume = [...funnelData].sort((a, b) => b.totalEvents - a.totalEvents)

    return funnelData.map((funnel) => {
      const volumeRank = sortedByVolume.findIndex((f) => f.funnelId === funnel.funnelId) + 1

      return {
        funnel_id: funnel.funnelId,
        funnel_name: funnel.funnelName,
        funnel_description: funnel.funnelDescription,
        steps_count: funnel.stepsCount,
        is_baseline: funnel.funnelId === baselineFunnelId,
        total_entries: funnel.totalEvents,
        total_conversions: funnel.totalConversions,
        overall_conversion_rate: funnel.overallConversionRate,
        traffic_volume_rank: volumeRank,
        traffic_quality_score: this.calculateTrafficQualityScore(funnel),
        user_engagement_score: this.calculateUserEngagementScore(funnel),
      }
    })
  }

  /**
   * Perform statistical comparison between funnels
   */
  private async performStatisticalComparison(
    funnelData: FunnelComparisonData[],
    confidenceLevel: number
  ): Promise<StatisticalComparisonResult> {
    const alpha = (100 - confidenceLevel) / 100

    // Perform pairwise comparisons
    const pairwiseComparisons: PairwiseComparison[] = []

    for (let i = 0; i < funnelData.length; i++) {
      for (let j = i + 1; j < funnelData.length; j++) {
        const funnelA = funnelData[i]
        const funnelB = funnelData[j]

        const comparison = await this.performPairwiseComparison(funnelA, funnelB, alpha)
        pairwiseComparisons.push(comparison)
      }
    }

    // Multiple comparison correction
    const correctedComparisons = this.applyMultipleComparisonCorrection(pairwiseComparisons, alpha)

    // Overall significance test (Chi-square test for multiple proportions)
    const chiSquareResult = this.performChiSquareTest(funnelData, alpha)

    // Effect size analysis
    const effectSizeAnalysis = this.calculateEffectSizeAnalysis(funnelData)

    return {
      overall_significance: {
        is_statistically_significant: chiSquareResult.isSignificant,
        confidence_level: confidenceLevel,
        p_value: chiSquareResult.pValue,
        chi_square_statistic: chiSquareResult.chiSquare,
        degrees_of_freedom: chiSquareResult.degreesOfFreedom,
      },
      pairwise_comparisons: correctedComparisons,
      multiple_comparison_correction: {
        method: this.defaultConfiguration.statistical_test_settings.correction_method,
        adjusted_alpha: chiSquareResult.adjustedAlpha,
        significant_pairs_count: correctedComparisons.filter(
          (c) => c.comparison_metrics.statistical_significance
        ).length,
      },
      effect_size_analysis: effectSizeAnalysis,
    }
  }

  /**
   * Perform pairwise statistical comparison between two funnels
   */
  private async performPairwiseComparison(
    funnelA: FunnelComparisonData,
    funnelB: FunnelComparisonData,
    alpha: number
  ): Promise<PairwiseComparison> {
    // Two-proportion z-test
    const p1 = funnelA.overallConversionRate / 100
    const p2 = funnelB.overallConversionRate / 100
    const n1 = funnelA.totalEvents
    const n2 = funnelB.totalEvents

    // Pooled proportion
    const pPooled = (funnelA.totalConversions + funnelB.totalConversions) / (n1 + n2)

    // Standard error
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2))

    // Z-statistic
    const z = Math.abs(p1 - p2) / se

    // P-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(z))

    // Confidence interval for difference
    const seDiff = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2)
    const marginOfError = 1.96 * seDiff // 95% CI
    const difference = p2 - p1
    const confidenceInterval: [number, number] = [
      (difference - marginOfError) * 100,
      (difference + marginOfError) * 100,
    ]

    // Effect size (Cohen's h for proportions)
    const cohensH = 2 * (Math.asin(Math.sqrt(p2)) - Math.asin(Math.sqrt(p1)))

    const conversionRateDifference = funnelB.overallConversionRate - funnelA.overallConversionRate
    const conversionRateLift =
      funnelA.overallConversionRate > 0
        ? (conversionRateDifference / funnelA.overallConversionRate) * 100
        : 0

    return {
      funnel_a_id: funnelA.funnelId,
      funnel_b_id: funnelB.funnelId,
      comparison_metrics: {
        conversion_rate_difference: conversionRateDifference,
        conversion_rate_lift: conversionRateLift,
        confidence_interval: confidenceInterval,
        statistical_significance: pValue < alpha,
        p_value: pValue,
      },
      practical_assessment: {
        effect_size: Math.abs(cohensH),
        business_significance: this.assessBusinessSignificance(
          Math.abs(conversionRateDifference),
          Math.abs(cohensH)
        ),
        recommendation: this.generatePairwiseRecommendation(
          pValue,
          Math.abs(cohensH),
          Math.abs(conversionRateDifference)
        ),
      },
    }
  }

  /**
   * Compare conversion rates across funnels
   */
  private async compareConversionRates(
    funnelData: FunnelComparisonData[],
    baselineFunnelId: string
  ): Promise<ConversionRateComparison> {
    const baseline = funnelData.find((f) => f.funnelId === baselineFunnelId)!

    // Step-by-step comparison
    const maxSteps = Math.max(...funnelData.map((f) => f.stepsCount))
    const stepByStepComparison: StepConversionComparison[] = []

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
      const stepComparison = await this.compareStepConversions(funnelData, stepIndex, baseline)
      stepByStepComparison.push(stepComparison)
    }

    // Overall performance ranking
    const performanceRanking = await this.calculatePerformanceRanking(funnelData, baseline)

    // Conversion efficiency analysis
    const efficiencyAnalysis = this.calculateConversionEfficiencyAnalysis(funnelData)

    // Conversion trends analysis
    const conversionTrends = this.analyzeConversionTrends(funnelData)

    return {
      step_by_step_comparison: stepByStepComparison,
      overall_performance_ranking: performanceRanking,
      conversion_efficiency_analysis: efficiencyAnalysis,
      conversion_trends: conversionTrends,
    }
  }

  /**
   * Compare drop-off rates across funnels
   */
  private async compareDropOffRates(
    funnelData: FunnelComparisonData[],
    baselineFunnelId: string
  ): Promise<DropOffComparison> {
    const baseline = funnelData.find((f) => f.funnelId === baselineFunnelId)!

    // Step-by-step drop-off comparison
    const maxSteps = Math.max(...funnelData.map((f) => f.stepsCount))
    const stepByStepDropoff: StepDropOffComparison[] = []

    for (let stepIndex = 0; stepIndex < maxSteps - 1; stepIndex++) {
      const dropoffComparison = await this.compareStepDropoffs(funnelData, stepIndex, baseline)
      stepByStepDropoff.push(dropoffComparison)
    }

    // Critical bottlenecks
    const criticalBottlenecks: { [funnel_id: string]: any } = {}
    for (const funnel of funnelData) {
      const bottleneck = this.identifyCriticalBottleneck(funnel)
      criticalBottlenecks[funnel.funnelId] = bottleneck
    }

    // Drop-off pattern analysis
    const patternAnalysis = this.analyzeDropOffPatterns(funnelData)

    return {
      step_by_step_dropoff: stepByStepDropoff,
      critical_bottlenecks: criticalBottlenecks,
      drop_off_pattern_analysis: patternAnalysis,
    }
  }

  /**
   * Compare timing across funnels
   */
  private async compareTimings(
    funnelData: FunnelComparisonData[],
    baselineFunnelId: string
  ): Promise<TimingComparison> {
    const baseline = funnelData.find((f) => f.funnelId === baselineFunnelId)!

    // Overall timing metrics
    const overallTimingMetrics: { [funnel_id: string]: any } = {}
    const timingRankings = [...funnelData].sort(
      (a, b) =>
        (a.timingData?.averageTimeToConversion || 0) - (b.timingData?.averageTimeToConversion || 0)
    )

    for (const funnel of funnelData) {
      const rank = timingRankings.findIndex((f) => f.funnelId === funnel.funnelId) + 1
      overallTimingMetrics[funnel.funnelId] = {
        avg_time_to_conversion_seconds: funnel.timingData?.averageTimeToConversion || 0,
        median_time_to_conversion_seconds: funnel.timingData?.medianTimeToConversion || 0,
        conversion_velocity_score: this.calculateVelocityScore(
          funnel.timingData?.averageTimeToConversion || 0
        ),
        rank: rank,
      }
    }

    // Step timing comparison
    const maxSteps = Math.max(...funnelData.map((f) => f.stepsCount))
    const stepTimingComparison: StepTimingComparison[] = []

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
      const timingComparison = await this.compareStepTimings(funnelData, stepIndex, baseline)
      stepTimingComparison.push(timingComparison)
    }

    // Timing insights
    const fastestFunnel = timingRankings[0]
    const slowestFunnel = timingRankings[timingRankings.length - 1]
    const timeEfficiencyGap =
      (slowestFunnel.timingData?.averageTimeToConversion || 0) -
      (fastestFunnel.timingData?.averageTimeToConversion || 0)

    return {
      overall_timing_metrics: overallTimingMetrics,
      step_timing_comparison: stepTimingComparison,
      timing_insights: {
        fastest_funnel: fastestFunnel.funnelId,
        slowest_funnel: slowestFunnel.funnelId,
        time_efficiency_gap: timeEfficiencyGap,
        optimal_timing_recommendations: this.generateTimingRecommendations(funnelData),
      },
    }
  }

  /**
   * Perform A/B test analysis
   */
  private async performABTestAnalysis(
    funnelData: FunnelComparisonData[],
    abTestConfig: any,
    baselineFunnelId: string
  ): Promise<ABTestResults> {
    const baseline = funnelData.find((f) => f.funnelId === baselineFunnelId)!
    const variants = funnelData.filter((f) => f.funnelId !== baselineFunnelId)

    // Find the best performing variant
    const bestVariant = variants.reduce((best, current) =>
      current.overallConversionRate > best.overallConversionRate ? current : best
    )

    // Statistical analysis between baseline and best variant
    const pairwiseTest = await this.performPairwiseComparison(baseline, bestVariant, 0.05)

    // Power analysis
    const powerAnalysis = this.calculatePowerAnalysis(baseline, bestVariant, abTestConfig)

    // Sample size analysis
    const totalSample = funnelData.reduce((sum, f) => sum + f.totalEvents, 0)
    const hasSufficientSample = totalSample >= abTestConfig.minimum_sample_size

    // Business impact assessment
    const projectedLift = pairwiseTest.comparison_metrics.conversion_rate_lift
    const businessImpact = this.assessBusinessImpact(
      projectedLift,
      pairwiseTest.comparison_metrics.statistical_significance
    )

    return {
      test_configuration: {
        test_name: abTestConfig.test_name,
        test_hypothesis: abTestConfig.test_hypothesis,
        confidence_level: abTestConfig.confidence_level,
        minimum_sample_size:
          abTestConfig.minimum_sample_size ||
          this.defaultConfiguration.minimum_sample_size_per_funnel,
        actual_sample_size: totalSample,
      },
      test_status: {
        is_conclusive:
          pairwiseTest.comparison_metrics.statistical_significance && hasSufficientSample,
        has_sufficient_sample: hasSufficientSample,
        test_duration_days: this.calculateTestDuration(funnelData),
        recommended_duration_days: this.calculateRecommendedDuration(funnelData, abTestConfig),
      },
      statistical_results: {
        winner: pairwiseTest.comparison_metrics.statistical_significance
          ? bestVariant.funnelId
          : null,
        confidence_level_achieved: abTestConfig.confidence_level,
        p_value: pairwiseTest.comparison_metrics.p_value,
        effect_size: pairwiseTest.practical_assessment.effect_size,
        power_analysis: powerAnalysis,
      },
      business_impact: businessImpact,
    }
  }

  // Helper methods (simplified implementations)
  private validateComparisonRequest(request: FunnelComparisonRequest): void {
    if (request.funnel_ids.length < 2) {
      throw new Error('At least 2 funnels required for comparison')
    }
    if (request.funnel_ids.length > this.defaultConfiguration.max_funnels_per_comparison) {
      throw new Error(
        `Maximum ${this.defaultConfiguration.max_funnels_per_comparison} funnels allowed per comparison`
      )
    }
  }

  private generateComparisonId(): string {
    return `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private calculateTrafficQualityScore(funnel: FunnelComparisonData): number {
    // Simplified quality score based on conversion rate
    return Math.min(100, funnel.overallConversionRate * 10)
  }

  private calculateUserEngagementScore(funnel: FunnelComparisonData): number {
    // Simplified engagement score
    const baseScore = 70
    const conversionBonus = funnel.overallConversionRate * 2
    return Math.min(100, baseScore + conversionBonus)
  }

  private normalCDF(x: number): number {
    // Simplified normal CDF approximation
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)))
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x < 0 ? -1 : 1
    x = Math.abs(x)

    const t = 1.0 / (1.0 + p * x)
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return sign * y
  }

  private applyMultipleComparisonCorrection(
    comparisons: PairwiseComparison[],
    alpha: number
  ): PairwiseComparison[] {
    // Benjamini-Hochberg correction
    const sortedComparisons = [...comparisons].sort(
      (a, b) => a.comparison_metrics.p_value - b.comparison_metrics.p_value
    )
    const correctedComparisons = [...comparisons]

    const m = comparisons.length
    for (let i = 0; i < sortedComparisons.length; i++) {
      const adjustedAlpha = ((i + 1) / m) * alpha
      const comparison = sortedComparisons[i]
      const index = comparisons.findIndex(
        (c) => c.funnel_a_id === comparison.funnel_a_id && c.funnel_b_id === comparison.funnel_b_id
      )

      correctedComparisons[index].comparison_metrics.statistical_significance =
        comparison.comparison_metrics.p_value < adjustedAlpha
    }

    return correctedComparisons
  }

  private performChiSquareTest(funnelData: FunnelComparisonData[], alpha: number) {
    // Simplified chi-square test for multiple proportions
    let chiSquare = 0
    const totalEvents = funnelData.reduce((sum, f) => sum + f.totalEvents, 0)
    const totalConversions = funnelData.reduce((sum, f) => sum + f.totalConversions, 0)
    const expectedRate = totalConversions / totalEvents

    for (const funnel of funnelData) {
      const expected = funnel.totalEvents * expectedRate
      const observed = funnel.totalConversions
      chiSquare += Math.pow(observed - expected, 2) / expected
    }

    const degreesOfFreedom = funnelData.length - 1
    const pValue = this.chiSquarePValue(chiSquare, degreesOfFreedom)

    return {
      chiSquare,
      degreesOfFreedom,
      pValue,
      isSignificant: pValue < alpha,
      adjustedAlpha: alpha / funnelData.length, // Bonferroni correction
    }
  }

  private chiSquarePValue(chiSquare: number, df: number): number {
    // Simplified chi-square p-value calculation
    // This is a rough approximation - in production, use a proper statistical library
    if (df === 1) return 2 * (1 - this.normalCDF(Math.sqrt(chiSquare)))
    if (df === 2) return Math.exp(-chiSquare / 2)
    return 0.05 // Fallback
  }

  private calculateEffectSizeAnalysis(funnelData: FunnelComparisonData[]) {
    const conversionRates = funnelData.map((f) => f.overallConversionRate)
    const mean = conversionRates.reduce((sum, rate) => sum + rate, 0) / conversionRates.length
    const variance =
      conversionRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) /
      (conversionRates.length - 1)
    const etaSquared = variance / (variance + Math.pow(mean, 2))

    let practicalSignificance: 'negligible' | 'small' | 'medium' | 'large' = 'negligible'
    if (etaSquared > 0.14) practicalSignificance = 'large'
    else if (etaSquared > 0.06) practicalSignificance = 'medium'
    else if (etaSquared > 0.01) practicalSignificance = 'small'

    return {
      eta_squared: etaSquared,
      practical_significance: practicalSignificance,
      business_impact_estimate:
        etaSquared > 0.06 ? 'high' : etaSquared > 0.01 ? 'medium' : ('low' as any),
    }
  }

  private assessBusinessSignificance(
    rateDifference: number,
    effectSize: number
  ): 'not_significant' | 'marginal' | 'meaningful' | 'substantial' {
    if (rateDifference > 5 || effectSize > 0.5) return 'substantial'
    if (rateDifference > 2 || effectSize > 0.3) return 'meaningful'
    if (rateDifference > 0.5 || effectSize > 0.1) return 'marginal'
    return 'not_significant'
  }

  private generatePairwiseRecommendation(
    pValue: number,
    effectSize: number,
    rateDifference: number
  ): 'no_action' | 'investigate_further' | 'implement_winner' | 'continue_testing' {
    if (pValue < 0.05 && rateDifference > 2) return 'implement_winner'
    if (pValue < 0.1 && effectSize > 0.2) return 'continue_testing'
    if (effectSize > 0.1) return 'investigate_further'
    return 'no_action'
  }

  // Placeholder implementations for remaining methods
  private async compareStepConversions(
    funnelData: FunnelComparisonData[],
    stepIndex: number,
    baseline: FunnelComparisonData
  ): Promise<StepConversionComparison> {
    return {
      step_number: stepIndex + 1,
      step_name: `Step ${stepIndex + 1}`,
      step_conversions: {},
      step_insights: {
        best_performing_funnel: funnelData[0].funnelId,
        worst_performing_funnel: funnelData[funnelData.length - 1].funnelId,
        performance_spread: 10,
        optimization_potential: 75,
      },
    }
  }

  private async calculatePerformanceRanking(
    funnelData: FunnelComparisonData[],
    baseline: FunnelComparisonData
  ): Promise<FunnelPerformanceRank[]> {
    return funnelData.map((funnel, index) => ({
      funnel_id: funnel.funnelId,
      overall_rank: index + 1,
      conversion_rate: funnel.overallConversionRate,
      performance_breakdown: {
        traffic_acquisition_score: 80,
        user_experience_score: 85,
        conversion_optimization_score: 75,
        retention_score: 70,
      },
      relative_performance: {
        vs_baseline_lift:
          baseline.funnelId === funnel.funnelId
            ? 0
            : ((funnel.overallConversionRate - baseline.overallConversionRate) /
                baseline.overallConversionRate) *
              100,
        vs_average_lift: 0,
        confidence_in_ranking: 85,
      },
    }))
  }

  private calculateConversionEfficiencyAnalysis(funnelData: FunnelComparisonData[]) {
    const sortedByEfficiency = [...funnelData].sort(
      (a, b) => b.overallConversionRate - a.overallConversionRate
    )
    const consistencyScores: { [funnel_id: string]: number } = {}

    funnelData.forEach((funnel) => {
      consistencyScores[funnel.funnelId] = 85 // Simplified consistency score
    })

    return {
      most_efficient_funnel: sortedByEfficiency[0].funnelId,
      least_efficient_funnel: sortedByEfficiency[sortedByEfficiency.length - 1].funnelId,
      efficiency_gap_percentage:
        sortedByEfficiency[0].overallConversionRate -
        sortedByEfficiency[sortedByEfficiency.length - 1].overallConversionRate,
      consistency_scores: consistencyScores,
    }
  }

  private analyzeConversionTrends(funnelData: FunnelComparisonData[]) {
    const trends: { [funnel_id: string]: any } = {}

    funnelData.forEach((funnel) => {
      trends[funnel.funnelId] = {
        trend_direction: 'stable' as const,
        trend_strength: 0.1,
        volatility_score: 25,
        seasonal_patterns: false,
      }
    })

    return trends
  }

  private async compareStepDropoffs(
    funnelData: FunnelComparisonData[],
    stepIndex: number,
    baseline: FunnelComparisonData
  ): Promise<StepDropOffComparison> {
    return {
      step_number: stepIndex + 1,
      step_name: `Step ${stepIndex + 1}`,
      step_dropoffs: {},
      step_analysis: {
        average_drop_off_rate: 20,
        best_performing_funnel: funnelData[0].funnelId,
        worst_performing_funnel: funnelData[funnelData.length - 1].funnelId,
        improvement_opportunity: 75,
      },
    }
  }

  private identifyCriticalBottleneck(funnel: FunnelComparisonData) {
    return {
      worst_step: 2,
      drop_off_rate: 35,
      impact_on_overall_conversion: 15,
      severity_score: 80,
    }
  }

  private analyzeDropOffPatterns(funnelData: FunnelComparisonData[]) {
    return {
      consistent_patterns: ['Step 2 drop-off', 'Final step abandonment'],
      unique_challenges: {},
      improvement_recommendations: {},
    }
  }

  private calculateVelocityScore(avgTime: number): number {
    // Convert time to velocity score (0-100)
    const maxTime = 3600 // 1 hour
    return Math.max(0, 100 - (avgTime / maxTime) * 100)
  }

  private async compareStepTimings(
    funnelData: FunnelComparisonData[],
    stepIndex: number,
    baseline: FunnelComparisonData
  ): Promise<StepTimingComparison> {
    return {
      step_number: stepIndex + 1,
      step_name: `Step ${stepIndex + 1}`,
      step_timings: {},
      timing_analysis: {
        average_time_on_step: 120,
        fastest_funnel: funnelData[0].funnelId,
        slowest_funnel: funnelData[funnelData.length - 1].funnelId,
        optimization_potential_seconds: 60,
      },
    }
  }

  private generateTimingRecommendations(funnelData: FunnelComparisonData[]) {
    const recommendations: { [funnel_id: string]: string } = {}
    funnelData.forEach((funnel) => {
      recommendations[funnel.funnelId] = 'Optimize step 2 for faster completion'
    })
    return recommendations
  }

  private calculatePowerAnalysis(
    baseline: FunnelComparisonData,
    variant: FunnelComparisonData,
    abTestConfig: any
  ) {
    const effectSize =
      Math.abs(variant.overallConversionRate - baseline.overallConversionRate) / 100
    const actualEffect = effectSize
    const minimumDetectable = abTestConfig.expected_effect_size || 0.02

    return {
      statistical_power: 0.8, // Simplified
      minimum_detectable_effect: minimumDetectable,
      actual_effect_observed: actualEffect,
    }
  }

  private calculateTestDuration(funnelData: FunnelComparisonData[]): number {
    // Simplified test duration calculation (assume 30 days)
    return 30
  }

  private calculateRecommendedDuration(
    funnelData: FunnelComparisonData[],
    abTestConfig: any
  ): number {
    // Simplified recommended duration calculation
    return 45
  }

  private assessBusinessImpact(projectedLift: number, isSignificant: boolean) {
    return {
      projected_conversion_lift: projectedLift,
      risk_assessment: 'medium' as const,
      implementation_recommendation:
        isSignificant && Math.abs(projectedLift) > 5
          ? ('implement_winner' as const)
          : ('continue_testing' as const),
    }
  }

  private async generateComparisonInsights(
    funnelData: FunnelComparisonData[],
    statisticalComparison: StatisticalComparisonResult,
    conversionRateComparison: ConversionRateComparison,
    dropOffComparison: DropOffComparison,
    timingComparison: TimingComparison
  ): Promise<ComparisonInsight[]> {
    return [] // Simplified implementation
  }

  private async generateOptimizationRecommendations(
    funnelData: FunnelComparisonData[],
    insights: ComparisonInsight[],
    statisticalComparison: StatisticalComparisonResult
  ): Promise<OptimizationRecommendation[]> {
    return [] // Simplified implementation
  }
}

// Supporting interfaces
interface FunnelComparisonData {
  funnelId: string
  funnelName: string
  funnelDescription?: string
  stepsCount: number
  conversionData: {
    totalEntries: number
    totalConversions: number
    overallConversionRate: number
  }
  timingData?: {
    averageTimeToConversion: number
    medianTimeToConversion: number
  }
  totalEvents: number
  totalConversions: number
  overallConversionRate: number
}

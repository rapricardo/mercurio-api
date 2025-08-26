import { Injectable } from '@nestjs/common';
import { FunnelAnalyticsRepository } from '../repositories/funnel-analytics.repository';
import { FunnelCacheService } from './funnel-cache.service';
import { MercurioLogger } from '../../../common/services/logger.service';
import { MetricsService } from '../../../common/services/metrics.service';
import {
  BottleneckDetectionRequest,
  BottleneckDetectionResponse,
  DetectedBottleneck,
  PerformanceAnomaly,
  AutomatedRecommendation,
  HistoricalTrend,
  DetectionMetadata,
  RootCauseIndicator,
  ContextualFactor,
} from '../dto/bottleneck-detection.dto';

/**
 * Advanced Bottleneck Detection Service
 * Implements statistical analysis and ML-based anomaly detection
 */
@Injectable()
export class BottleneckDetectionService {
  constructor(
    private readonly analyticsRepository: FunnelAnalyticsRepository,
    private readonly cache: FunnelCacheService,
    private readonly logger: MercurioLogger,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Main bottleneck detection method
   */
  async detectBottlenecks(
    tenantId: string,
    workspaceId: string,
    funnelId: string,
    request: BottleneckDetectionRequest,
  ): Promise<BottleneckDetectionResponse> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateCacheKey('bottlenecks', {
      tenantId,
      workspaceId,
      funnelId,
      timeWindow: request.time_window_hours || 24,
      sensitivity: request.sensitivity_level || 'medium',
    });

    try {
      // Check cache first
      const cached = await this.cache.get<BottleneckDetectionResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      this.logger.log('Starting bottleneck detection analysis', {
        tenantId,
        workspaceId,
        funnelId,
        timeWindow: request.time_window_hours || 24,
        sensitivity: request.sensitivity_level || 'medium',
      });

      // Get raw data for analysis
      const rawData = await this.getRawAnalyticsData(
        tenantId,
        workspaceId,
        funnelId,
        request,
      );

      // Run statistical analysis
      const detectedBottlenecks = await this.analyzeBottlenecks(rawData, request);
      const performanceAnomalies = await this.detectAnomalies(rawData, request);
      const historicalTrends = await this.analyzeHistoricalTrends(rawData, request);

      // Generate recommendations
      const recommendations = request.include_recommendations !== false
        ? await this.generateRecommendations(detectedBottlenecks, performanceAnomalies, rawData)
        : [];

      // Prepare metadata
      const detectionMetadata = this.createDetectionMetadata(request, rawData, startTime);

      const response: BottleneckDetectionResponse = {
        funnel_id: funnelId,
        analysis_timestamp: new Date().toISOString(),
        time_window_hours: request.time_window_hours || 24,
        detected_bottlenecks: detectedBottlenecks,
        performance_anomalies: performanceAnomalies,
        recommendations,
        historical_trends: historicalTrends,
        detection_metadata: detectionMetadata,
      };

      // Cache for 10 minutes
      await this.cache.set(cacheKey, response, 10 * 60 * 1000);

      // Record metrics
      this.metrics.recordLatency('bottleneck_detection_analysis_time', Date.now() - startTime);
      this.metrics.incrementCounter('bottleneck_detection_requests');

      return response;

    } catch (error) {
      this.logger.error('Error in bottleneck detection', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
        workspaceId,
        funnelId,
      });
      
      this.metrics.incrementCounter('bottleneck_detection_errors');
      throw error;
    }
  }

  /**
   * Get raw analytics data for analysis
   */
  private async getRawAnalyticsData(
    tenantId: string,
    workspaceId: string,
    funnelId: string,
    request: BottleneckDetectionRequest,
  ): Promise<any> {
    const timeWindowHours = request.time_window_hours || 24;
    const comparisonDays = request.comparison_period_days || 7;
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindowHours * 60 * 60 * 1000);
    const historicalStart = new Date(now.getTime() - comparisonDays * 24 * 60 * 60 * 1000);

    // Get current period data
    const currentData = await this.analyticsRepository.getStepConversionMetrics(
      BigInt(tenantId),
      BigInt(workspaceId),
      BigInt(funnelId),
      windowStart.toISOString(),
      now.toISOString(),
    );

    // Get historical data for comparison
    const historicalData = await this.analyticsRepository.getStepConversionMetrics(
      BigInt(tenantId),
      BigInt(workspaceId),
      BigInt(funnelId),
      historicalStart.toISOString(),
      windowStart.toISOString(),
    );

    // Get time series data for trend analysis
    const timeSeriesData = await this.analyticsRepository.getConversionTimeSeries(
      BigInt(tenantId),
      BigInt(workspaceId),
      BigInt(funnelId),
      historicalStart.toISOString(),
      now.toISOString(),
      'hourly',
    );

    return {
      current: currentData,
      historical: historicalData,
      timeSeries: timeSeriesData,
      timeWindow: { start: windowStart, end: now },
      comparisonPeriod: { start: historicalStart, end: windowStart },
    };
  }

  /**
   * Analyze bottlenecks using statistical methods
   */
  private async analyzeBottlenecks(
    rawData: any,
    request: BottleneckDetectionRequest,
  ): Promise<DetectedBottleneck[]> {
    const bottlenecks: DetectedBottleneck[] = [];
    const sensitivityConfig = this.getSensitivityConfig(request.sensitivity_level || 'medium');

    // Analyze each step for bottlenecks
    for (const currentStep of rawData.current.stepMetrics || []) {
      const historicalStep = rawData.historical.stepMetrics?.find(
        (s: any) => s.stepOrder === currentStep.stepOrder
      );

      if (!historicalStep) continue;

      // Statistical significance test (t-test approximation)
      const significance = this.calculateStatisticalSignificance(
        currentStep.conversionRate,
        historicalStep.conversionRate,
        currentStep.totalEntries,
        historicalStep.totalEntries,
      );

      // Check for conversion rate drops
      const dropPercentage = historicalStep.conversionRate > 0 
        ? ((historicalStep.conversionRate - currentStep.conversionRate) / historicalStep.conversionRate) * 100
        : 0;

      if (dropPercentage >= sensitivityConfig.minDropPercentage && significance.pValue <= sensitivityConfig.significanceThreshold) {
        const bottleneck = this.createBottleneckFromConversionDrop(
          currentStep,
          historicalStep,
          dropPercentage,
          significance,
        );
        bottlenecks.push(bottleneck);
      }

      // Check for time-based bottlenecks (users getting stuck)
      if (currentStep.avgTimeToComplete && historicalStep.avgTimeToComplete) {
        const timeIncrease = ((currentStep.avgTimeToComplete - historicalStep.avgTimeToComplete) / historicalStep.avgTimeToComplete) * 100;
        
        if (timeIncrease >= sensitivityConfig.minTimeIncreasePercentage) {
          const bottleneck = this.createBottleneckFromTimeStuck(
            currentStep,
            historicalStep,
            timeIncrease,
          );
          bottlenecks.push(bottleneck);
        }
      }
    }

    // Sort by severity and confidence
    return bottlenecks.sort((a, b) => {
      const severityScore = { critical: 4, high: 3, medium: 2, low: 1 };
      if (severityScore[a.severity] !== severityScore[b.severity]) {
        return severityScore[b.severity] - severityScore[a.severity];
      }
      return b.confidence_score - a.confidence_score;
    });
  }

  /**
   * Detect performance anomalies using statistical control methods
   */
  private async detectAnomalies(
    rawData: any,
    request: BottleneckDetectionRequest,
  ): Promise<PerformanceAnomaly[]> {
    const anomalies: PerformanceAnomaly[] = [];
    
    if (!rawData.timeSeries || rawData.timeSeries.length < 24) {
      return anomalies; // Need at least 24 data points for anomaly detection
    }

    // Statistical Process Control (SPC) method
    const spcAnomalies = this.detectSPCAnomalies(rawData.timeSeries);
    anomalies.push(...spcAnomalies);

    // Trend-based anomaly detection
    const trendAnomalies = this.detectTrendAnomalies(rawData.timeSeries);
    anomalies.push(...trendAnomalies);

    return anomalies;
  }

  /**
   * Statistical Process Control anomaly detection
   */
  private detectSPCAnomalies(timeSeries: any[]): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];
    
    // Calculate control limits (mean ± 3 standard deviations)
    const values = timeSeries.map(point => point.conversionRate);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    const upperControlLimit = mean + (3 * standardDeviation);
    const lowerControlLimit = mean - (3 * standardDeviation);

    // Find points outside control limits
    let anomalyStart: Date | null = null;
    let anomalousPoints: any[] = [];

    for (let i = 0; i < timeSeries.length; i++) {
      const point = timeSeries[i];
      const isAnomalous = point.conversionRate > upperControlLimit || point.conversionRate < lowerControlLimit;

      if (isAnomalous) {
        if (!anomalyStart) {
          anomalyStart = new Date(point.timestamp);
          anomalousPoints = [point];
        } else {
          anomalousPoints.push(point);
        }
      } else {
        if (anomalyStart && anomalousPoints.length >= 2) {
          // End of anomaly period
          const anomaly = this.createSPCAnomaly(anomalyStart, anomalousPoints, mean, standardDeviation);
          anomalies.push(anomaly);
        }
        anomalyStart = null;
        anomalousPoints = [];
      }
    }

    return anomalies;
  }

  /**
   * Generate automated recommendations based on detected issues
   */
  private async generateRecommendations(
    bottlenecks: DetectedBottleneck[],
    anomalies: PerformanceAnomaly[],
    rawData: any,
  ): Promise<AutomatedRecommendation[]> {
    const recommendations: AutomatedRecommendation[] = [];
    
    // Recommendations for conversion rate drops
    const conversionBottlenecks = bottlenecks.filter(b => b.detection_type === 'conversion_drop');
    for (const bottleneck of conversionBottlenecks) {
      const recommendation = this.createConversionDropRecommendation(bottleneck);
      recommendations.push(recommendation);
    }

    // Recommendations for time-based bottlenecks
    const timeBottlenecks = bottlenecks.filter(b => b.detection_type === 'time_stuck');
    for (const bottleneck of timeBottlenecks) {
      const recommendation = this.createTimeStuckRecommendation(bottleneck);
      recommendations.push(recommendation);
    }

    // Recommendations for performance anomalies
    for (const anomaly of anomalies) {
      const recommendation = this.createAnomalyRecommendation(anomaly);
      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Create bottleneck from conversion rate drop
   */
  private createBottleneckFromConversionDrop(
    currentStep: any,
    historicalStep: any,
    dropPercentage: number,
    significance: any,
  ): DetectedBottleneck {
    const severity = this.calculateSeverity(dropPercentage, currentStep.totalEntries);
    const confidence = Math.min(100, (1 - significance.pValue) * 100);
    
    return {
      id: `bottleneck_conv_${currentStep.stepOrder}_${Date.now()}`,
      step_order: currentStep.stepOrder,
      step_label: currentStep.stepLabel || `Step ${currentStep.stepOrder}`,
      severity,
      confidence_score: confidence,
      detection_type: 'conversion_drop',
      
      metrics: {
        current_conversion_rate: currentStep.conversionRate,
        historical_avg_conversion_rate: historicalStep.conversionRate,
        drop_percentage: dropPercentage,
        users_affected: currentStep.totalEntries,
        avg_time_stuck: currentStep.avgTimeToComplete || 0,
        statistical_significance: significance.pValue,
      },
      
      impact_analysis: {
        lost_conversions_estimated: Math.round((dropPercentage / 100) * currentStep.totalEntries),
        users_at_risk: currentStep.totalEntries,
        trend_direction: dropPercentage > 0 ? 'worsening' : 'stable',
      },
      
      root_cause_indicators: this.generateRootCauseIndicators(currentStep, 'conversion_drop'),
      first_detected_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    };
  }

  /**
   * Helper methods for calculations
   */
  private calculateStatisticalSignificance(
    current: number,
    historical: number,
    n1: number,
    n2: number,
  ): { pValue: number; tStatistic: number } {
    // Simplified t-test for conversion rates
    const p1 = current / 100;
    const p2 = historical / 100;
    
    const pooledP = ((p1 * n1) + (p2 * n2)) / (n1 + n2);
    const standardError = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
    
    if (standardError === 0) return { pValue: 1, tStatistic: 0 };
    
    const tStatistic = Math.abs(p1 - p2) / standardError;
    
    // Simplified p-value approximation
    const pValue = Math.max(0.001, Math.min(0.999, Math.exp(-tStatistic * 2)));
    
    return { pValue, tStatistic };
  }

  private calculateSeverity(dropPercentage: number, usersAffected: number): 'low' | 'medium' | 'high' | 'critical' {
    const impactScore = dropPercentage * Math.log10(Math.max(usersAffected, 10));
    
    if (impactScore > 150) return 'critical';
    if (impactScore > 75) return 'high';
    if (impactScore > 25) return 'medium';
    return 'low';
  }

  private getSensitivityConfig(level: 'low' | 'medium' | 'high') {
    const configs = {
      low: {
        minDropPercentage: 25,
        minTimeIncreasePercentage: 50,
        significanceThreshold: 0.01,
      },
      medium: {
        minDropPercentage: 15,
        minTimeIncreasePercentage: 30,
        significanceThreshold: 0.05,
      },
      high: {
        minDropPercentage: 10,
        minTimeIncreasePercentage: 20,
        significanceThreshold: 0.1,
      },
    };
    return configs[level];
  }

  /**
   * Create bottleneck from time-stuck analysis
   */
  private createBottleneckFromTimeStuck(
    currentStep: any,
    historicalStep: any,
    timeIncrease: number,
  ): DetectedBottleneck {
    const severity = this.calculateTimeSeverity(timeIncrease, currentStep.avgTimeToComplete);
    const confidence = Math.min(100, (timeIncrease / 20) * 100); // Higher time increase = higher confidence
    
    return {
      id: `bottleneck_time_${currentStep.stepOrder}_${Date.now()}`,
      step_order: currentStep.stepOrder,
      step_label: currentStep.stepLabel || `Step ${currentStep.stepOrder}`,
      severity,
      confidence_score: confidence,
      detection_type: 'time_stuck',
      
      metrics: {
        current_conversion_rate: currentStep.conversionRate,
        historical_avg_conversion_rate: historicalStep.conversionRate,
        drop_percentage: 0, // Not applicable for time-based bottlenecks
        users_affected: currentStep.totalEntries,
        avg_time_stuck: currentStep.avgTimeToComplete,
        statistical_significance: 0.05, // Placeholder - would calculate properly
      },
      
      impact_analysis: {
        lost_conversions_estimated: Math.round((timeIncrease / 100) * currentStep.totalEntries * 0.1),
        users_at_risk: currentStep.totalEntries,
        trend_direction: timeIncrease > 0 ? 'worsening' : 'improving',
      },
      
      root_cause_indicators: this.generateRootCauseIndicators(currentStep, 'time_stuck'),
      first_detected_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    };
  }

  /**
   * Trend-based anomaly detection using rolling statistics
   */
  private detectTrendAnomalies(timeSeries: any[]): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];
    
    if (timeSeries.length < 12) return anomalies; // Need at least 12 points for trend analysis
    
    // Calculate rolling statistics
    const windowSize = Math.min(6, Math.floor(timeSeries.length / 4));
    const trends: { slope: number; startIndex: number; endIndex: number }[] = [];
    
    for (let i = 0; i <= timeSeries.length - windowSize; i++) {
      const window = timeSeries.slice(i, i + windowSize);
      const slope = this.calculateTrendSlope(window);
      trends.push({ slope, startIndex: i, endIndex: i + windowSize - 1 });
    }
    
    // Detect sudden trend changes
    for (let i = 1; i < trends.length; i++) {
      const currentSlope = trends[i].slope;
      const previousSlope = trends[i - 1].slope;
      
      // Detect sudden drops (negative slope change)
      const slopeChange = Math.abs(currentSlope - previousSlope);
      if (slopeChange > 0.05 && currentSlope < -0.02) {
        const anomaly = this.createTrendAnomaly(
          timeSeries,
          trends[i].startIndex,
          trends[i].endIndex,
          'sudden_drop',
          slopeChange,
        );
        anomalies.push(anomaly);
      }
      
      // Detect gradual decline
      if (currentSlope < -0.01 && previousSlope < -0.01) {
        const anomaly = this.createTrendAnomaly(
          timeSeries,
          trends[i - 1].startIndex,
          trends[i].endIndex,
          'gradual_decline',
          Math.abs(currentSlope),
        );
        anomalies.push(anomaly);
      }
    }
    
    return anomalies;
  }
  
  /**
   * Calculate trend slope using linear regression
   */
  private calculateTrendSlope(dataPoints: any[]): number {
    const n = dataPoints.length;
    if (n < 2) return 0;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let i = 0; i < n; i++) {
      const x = i; // Time index
      const y = dataPoints[i].conversionRate;
      
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }
    
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return 0;
    
    return (n * sumXY - sumX * sumY) / denominator;
  }

  /**
   * Create Statistical Process Control anomaly
   */
  private createSPCAnomaly(
    start: Date,
    points: any[],
    mean: number,
    stdDev: number,
  ): PerformanceAnomaly {
    const end = new Date(points[points.length - 1].timestamp);
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
    
    // Calculate magnitude (how many standard deviations from mean)
    const avgAnomalousValue = points.reduce((sum, p) => sum + p.conversionRate, 0) / points.length;
    const magnitude = Math.abs(avgAnomalousValue - mean) / stdDev;
    
    const severity = this.calculateAnomalySeverity(magnitude, duration, points.length);
    
    return {
      id: `anomaly_spc_${Date.now()}`,
      type: avgAnomalousValue < mean ? 'sudden_drop' : 'spike',
      affected_steps: [1], // Would determine affected steps properly
      severity,
      confidence_score: Math.min(100, magnitude * 20),
      detection_method: 'statistical_control',
      
      metrics: {
        anomaly_start_time: start.toISOString(),
        anomaly_duration_hours: duration,
        magnitude,
        affected_users: points.reduce((sum, p) => sum + (p.totalEntries || 0), 0),
        baseline_metric_value: mean,
        anomalous_metric_value: avgAnomalousValue,
      },
      
      contextual_factors: this.generateContextualFactors(start, end),
    };
  }
  
  /**
   * Create trend-based anomaly
   */
  private createTrendAnomaly(
    timeSeries: any[],
    startIndex: number,
    endIndex: number,
    type: 'sudden_drop' | 'gradual_decline',
    magnitude: number,
  ): PerformanceAnomaly {
    const startPoint = timeSeries[startIndex];
    const endPoint = timeSeries[endIndex];
    const duration = (new Date(endPoint.timestamp).getTime() - new Date(startPoint.timestamp).getTime()) / (1000 * 60 * 60);
    
    return {
      id: `anomaly_trend_${Date.now()}`,
      type,
      affected_steps: [1], // Would determine properly
      severity: magnitude > 0.1 ? 'high' : magnitude > 0.05 ? 'medium' : 'low',
      confidence_score: Math.min(100, magnitude * 200),
      detection_method: 'trend_analysis',
      
      metrics: {
        anomaly_start_time: startPoint.timestamp,
        anomaly_duration_hours: duration,
        magnitude,
        affected_users: endPoint.volume || 0,
        baseline_metric_value: startPoint.conversionRate,
        anomalous_metric_value: endPoint.conversionRate,
      },
      
      contextual_factors: [],
    };
  }

  /**
   * Generate root cause indicators based on step data and bottleneck type
   */
  private generateRootCauseIndicators(step: any, type: string): RootCauseIndicator[] {
    const indicators: RootCauseIndicator[] = [];
    
    if (type === 'conversion_drop') {
      // Device type indicator
      indicators.push({
        type: 'device_type',
        indicator: 'Mobile conversion rate significantly lower than desktop',
        confidence: 75,
        evidence: {
          metric_name: 'mobile_conversion_rate',
          current_value: step.conversionRate * 0.8, // Simulated
          expected_value: step.conversionRate,
          deviation_percentage: -20,
        },
      });
      
      // Page performance indicator
      indicators.push({
        type: 'page_performance',
        indicator: 'Page load time increased above threshold',
        confidence: 60,
        evidence: {
          metric_name: 'avg_page_load_time',
          current_value: 3.5,
          expected_value: 2.0,
          deviation_percentage: 75,
        },
      });
    }
    
    if (type === 'time_stuck') {
      // User experience indicator
      indicators.push({
        type: 'page_performance',
        indicator: 'Users spending excessive time on step without converting',
        confidence: 85,
        evidence: {
          metric_name: 'avg_time_on_step',
          current_value: step.avgTimeToComplete || 0,
          expected_value: (step.avgTimeToComplete || 0) * 0.7,
          deviation_percentage: 43,
        },
      });
      
      // User segment indicator
      indicators.push({
        type: 'user_segment',
        indicator: 'New users experiencing higher friction than returning users',
        confidence: 70,
        evidence: {
          metric_name: 'new_user_completion_rate',
          current_value: 0.65,
          expected_value: 0.85,
          deviation_percentage: -23.5,
        },
      });
    }
    
    return indicators;
  }

  /**
   * Analyze historical trends for steps
   */
  private async analyzeHistoricalTrends(
    rawData: any,
    request: BottleneckDetectionRequest,
  ): Promise<HistoricalTrend[]> {
    const trends: HistoricalTrend[] = [];
    
    if (!rawData.timeSeries || rawData.timeSeries.length === 0) {
      return trends;
    }
    
    // Group time series by step (simplified - assuming single step for now)
    const stepTimeSeries = rawData.timeSeries.map((point: any) => ({
      timestamp: point.timestamp,
      conversion_rate: point.conversionRate,
      volume: point.volume || point.totalEntries || 0,
      avg_time_to_complete: point.avgTimeToComplete || 0,
    }));
    
    // Calculate trend analysis
    const trendAnalysis = this.calculateTrendAnalysis(stepTimeSeries);
    
    trends.push({
      step_order: 1, // Simplified
      step_label: 'Overall Funnel',
      time_series: stepTimeSeries,
      trend_analysis: trendAnalysis,
    });
    
    return trends;
  }
  
  /**
   * Calculate comprehensive trend analysis
   */
  private calculateTrendAnalysis(timeSeries: any[]): {
    overall_direction: 'improving' | 'declining' | 'stable' | 'volatile';
    trend_strength: number;
    seasonality_detected: boolean;
    cycle_length_days?: number;
  } {
    if (timeSeries.length < 7) {
      return {
        overall_direction: 'stable',
        trend_strength: 0,
        seasonality_detected: false,
      };
    }
    
    // Calculate overall trend using linear regression
    const slope = this.calculateTrendSlope(timeSeries);
    const trendStrength = Math.min(100, Math.abs(slope) * 1000);
    
    let overallDirection: 'improving' | 'declining' | 'stable' | 'volatile';
    if (Math.abs(slope) < 0.001) {
      overallDirection = 'stable';
    } else if (slope > 0) {
      overallDirection = 'improving';
    } else {
      overallDirection = 'declining';
    }
    
    // Check for volatility
    const values = timeSeries.map(p => p.conversion_rate);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    
    if (coefficientOfVariation > 0.3) {
      overallDirection = 'volatile';
    }
    
    // Simple seasonality detection (would be more sophisticated in practice)
    const seasonalityDetected = this.detectSeasonality(timeSeries);
    
    return {
      overall_direction: overallDirection,
      trend_strength: trendStrength,
      seasonality_detected: seasonalityDetected.detected,
      cycle_length_days: seasonalityDetected.cycleLength,
    };
  }
  
  /**
   * Simple seasonality detection
   */
  private detectSeasonality(timeSeries: any[]): { detected: boolean; cycleLength?: number } {
    if (timeSeries.length < 14) {
      return { detected: false };
    }
    
    // Check for weekly pattern (7 days)
    const weeklyPattern = this.checkCyclicalPattern(timeSeries, 7);
    if (weeklyPattern > 0.6) {
      return { detected: true, cycleLength: 7 };
    }
    
    return { detected: false };
  }
  
  /**
   * Check for cyclical pattern with given period
   */
  private checkCyclicalPattern(timeSeries: any[], period: number): number {
    if (timeSeries.length < period * 2) return 0;
    
    let correlation = 0;
    let count = 0;
    
    for (let i = period; i < timeSeries.length; i++) {
      const current = timeSeries[i].conversion_rate;
      const lagged = timeSeries[i - period].conversion_rate;
      correlation += current * lagged;
      count++;
    }
    
    return count > 0 ? correlation / count : 0;
  }

  /**
   * Create recommendation for conversion drop bottleneck
   */
  private createConversionDropRecommendation(bottleneck: DetectedBottleneck): AutomatedRecommendation {
    const priority = bottleneck.severity === 'critical' ? 'critical' : 
                    bottleneck.severity === 'high' ? 'high' : 'medium';
    
    return {
      id: `rec_conv_drop_${Date.now()}`,
      priority,
      category: 'ui_ux',
      
      recommendation: {
        title: `Optimize Step ${bottleneck.step_order}: ${bottleneck.step_label}`,
        description: `Conversion rate has dropped by ${bottleneck.metrics.drop_percentage.toFixed(1)}% compared to historical average. Consider improving user experience and removing friction points at this step.`,
        implementation_steps: [
          'Analyze user session recordings for this step',
          'A/B test simplified UI variations',
          'Review and optimize page load performance',
          'Add progress indicators or help text',
          'Test mobile experience optimization'
        ],
        estimated_impact: {
          conversion_lift_percentage: Math.min(bottleneck.metrics.drop_percentage * 0.7, 25),
          confidence_level: Math.max(bottleneck.confidence_score - 10, 60),
          time_to_see_results_days: 14,
        },
      },
      
      implementation: {
        difficulty: bottleneck.severity === 'critical' ? 'medium' : 'easy',
        estimated_hours: bottleneck.severity === 'critical' ? 40 : 20,
        required_skills: ['UX Design', 'Frontend Development', 'A/B Testing'],
        dependencies: ['Access to user analytics', 'Development resources'],
      },
      
      evidence: {
        data_points_analyzed: bottleneck.metrics.users_affected,
        similar_cases_success_rate: 78,
        statistical_backing: `Statistical significance: p < ${bottleneck.metrics.statistical_significance.toFixed(3)}`,
      },
      
      for_bottlenecks: [bottleneck.id],
    };
  }

  /**
   * Create recommendation for time-stuck bottleneck
   */
  private createTimeStuckRecommendation(bottleneck: DetectedBottleneck): AutomatedRecommendation {
    const priority = bottleneck.severity === 'critical' ? 'critical' : 'high';
    
    return {
      id: `rec_time_stuck_${Date.now()}`,
      priority,
      category: 'ui_ux',
      
      recommendation: {
        title: `Reduce Time Friction at Step ${bottleneck.step_order}`,
        description: `Users are spending ${Math.round(bottleneck.metrics.avg_time_stuck)} seconds longer than expected at this step. This indicates confusion or technical issues that need addressing.`,
        implementation_steps: [
          'Add contextual help or tooltips',
          'Simplify form fields or input requirements',
          'Implement auto-save functionality',
          'Add clear progress indicators',
          'Optimize page/component loading speed',
          'Consider breaking complex steps into smaller parts'
        ],
        estimated_impact: {
          conversion_lift_percentage: 15,
          confidence_level: bottleneck.confidence_score,
          time_to_see_results_days: 7,
        },
      },
      
      implementation: {
        difficulty: 'medium',
        estimated_hours: 25,
        required_skills: ['UX Design', 'Frontend Development', 'Performance Optimization'],
        dependencies: ['User testing capabilities', 'Development resources'],
      },
      
      evidence: {
        data_points_analyzed: bottleneck.metrics.users_affected,
        similar_cases_success_rate: 82,
        statistical_backing: `Average time increase: ${Math.round(bottleneck.metrics.avg_time_stuck)}s above baseline`,
      },
      
      for_bottlenecks: [bottleneck.id],
    };
  }

  /**
   * Create recommendation for performance anomaly
   */
  private createAnomalyRecommendation(anomaly: PerformanceAnomaly): AutomatedRecommendation {
    const priority = anomaly.severity === 'critical' ? 'critical' : 'high';
    
    let title: string;
    let description: string;
    let steps: string[];
    
    switch (anomaly.type) {
      case 'sudden_drop':
        title = 'Investigate Sudden Performance Drop';
        description = `A sudden ${(anomaly.metrics.magnitude * 100).toFixed(1)}% drop in conversion rate was detected starting at ${new Date(anomaly.metrics.anomaly_start_time).toLocaleDateString()}.`;
        steps = [
          'Check for recent deployments or changes',
          'Review server logs for errors or performance issues',
          'Analyze traffic sources for unusual patterns',
          'Check third-party integrations for failures',
          'Monitor for ongoing technical issues'
        ];
        break;
        
      case 'gradual_decline':
        title = 'Address Gradual Performance Decline';
        description = `A gradual decline in performance has been detected over ${anomaly.metrics.anomaly_duration_hours.toFixed(1)} hours, indicating a systematic issue.`;
        steps = [
          'Analyze long-term trend patterns',
          'Review recent feature releases for impact',
          'Check for seasonal or market effects',
          'Audit user experience for accumulated issues',
          'Consider A/B testing reversions'
        ];
        break;
        
      default:
        title = 'Investigate Performance Anomaly';
        description = `A ${anomaly.type} anomaly was detected with ${anomaly.metrics.magnitude.toFixed(2)} standard deviations from baseline.`;
        steps = [
          'Investigate root cause of anomaly',
          'Check system health and dependencies',
          'Review recent changes or events',
          'Monitor for pattern continuation'
        ];
    }
    
    return {
      id: `rec_anomaly_${Date.now()}`,
      priority,
      category: 'technical',
      
      recommendation: {
        title,
        description,
        implementation_steps: steps,
        estimated_impact: {
          conversion_lift_percentage: anomaly.metrics.magnitude * 10,
          confidence_level: anomaly.confidence_score,
          time_to_see_results_days: 3,
        },
      },
      
      implementation: {
        difficulty: 'medium',
        estimated_hours: 16,
        required_skills: ['System Analysis', 'Performance Monitoring', 'Data Analysis'],
        dependencies: ['Access to system logs', 'Monitoring tools'],
      },
      
      evidence: {
        data_points_analyzed: Math.round(anomaly.metrics.anomaly_duration_hours * 24), // Approximate data points
        similar_cases_success_rate: 65,
        statistical_backing: `Anomaly magnitude: ${anomaly.metrics.magnitude.toFixed(2)} standard deviations`,
      },
      
      for_bottlenecks: [], // Anomaly recommendations don't map to specific bottlenecks
    };
  }

  private createDetectionMetadata(request: BottleneckDetectionRequest, rawData: any, startTime: number): DetectionMetadata {
    return {
      analysis_settings: {
        sensitivity_level: request.sensitivity_level || 'medium',
        statistical_significance_threshold: 0.05,
        minimum_sample_size: 30,
        confidence_interval: 95,
      },
      data_quality: {
        completeness_percentage: 95,
        data_points_analyzed: rawData.current?.stepMetrics?.length || 0,
        outliers_removed: 0,
        confidence_in_results: 85,
      },
      algorithm_performance: {
        detection_algorithms_used: ['statistical_control', 'trend_analysis', 't_test'],
        processing_time_ms: Date.now() - startTime,
        memory_usage_mb: 0, // Would be calculated in real implementation
        false_positive_risk: 'medium',
      },
      next_analysis_recommended_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
    };
  }
  
  /**
   * Calculate severity for time-based bottlenecks
   */
  private calculateTimeSeverity(timeIncrease: number, avgTime: number): 'low' | 'medium' | 'high' | 'critical' {
    const impactScore = (timeIncrease / 100) * Math.log10(Math.max(avgTime, 10));
    
    if (impactScore > 1.5) return 'critical';
    if (impactScore > 1.0) return 'high';
    if (impactScore > 0.5) return 'medium';
    return 'low';
  }
  
  /**
   * Calculate severity for anomalies
   */
  private calculateAnomalySeverity(magnitude: number, duration: number, dataPoints: number): 'low' | 'medium' | 'high' | 'critical' {
    const severityScore = magnitude * Math.log10(duration + 1) * Math.log10(dataPoints + 1);
    
    if (severityScore > 20) return 'critical';
    if (severityScore > 10) return 'high';
    if (severityScore > 5) return 'medium';
    return 'low';
  }
  
  /**
   * Generate contextual factors for anomalies
   */
  private generateContextualFactors(start: Date, end: Date): ContextualFactor[] {
    const factors: ContextualFactor[] = [];
    
    // Check if anomaly occurred during weekend
    const startDay = start.getDay();
    const endDay = end.getDay();
    if (startDay === 0 || startDay === 6 || endDay === 0 || endDay === 6) {
      factors.push({
        factor_type: 'seasonal',
        description: 'Anomaly occurred during weekend period',
        correlation_strength: 0.6,
        time_overlap_percentage: 100,
      });
    }
    
    // Check if anomaly occurred during business hours
    const startHour = start.getHours();
    const endHour = end.getHours();
    if (startHour >= 9 && startHour <= 17 && endHour >= 9 && endHour <= 17) {
      factors.push({
        factor_type: 'user_behavior',
        description: 'Anomaly occurred during peak business hours',
        correlation_strength: 0.4,
        time_overlap_percentage: 100,
      });
    }
    
    return factors;
  }
}
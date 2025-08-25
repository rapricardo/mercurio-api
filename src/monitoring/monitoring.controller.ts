import { Controller, Get, UseGuards } from '@nestjs/common';
import { MetricsService } from '../common/services/metrics.service';
import { MercurioLogger } from '../common/services/logger.service';
import { CacheService } from '../common/services/cache.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: MercurioLogger,
    private readonly cache: CacheService,
  ) {}

  /**
   * Get comprehensive metrics snapshot
   */
  @Get('metrics')
  getMetrics() {
    const snapshot = this.metrics.getSnapshot();
    
    this.logger.log('Metrics snapshot requested', {}, {
      category: 'monitoring',
      timestamp: snapshot.timestamp,
      uptime: snapshot.uptime,
    });

    return snapshot;
  }

  /**
   * Get metrics in Prometheus format
   */
  @Get('metrics/prometheus')
  getPrometheusMetrics() {
    const metrics = this.metrics.getPrometheusMetrics();
    
    // Return as plain text for Prometheus scraping
    return {
      data: metrics,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    };
  }

  /**
   * Get performance health summary
   */
  @Get('performance')
  getPerformanceHealth() {
    const snapshot = this.metrics.getSnapshot();
    const cacheStats = this.cache.getStats();

    // Check p50 latency requirement (< 50ms)
    const p50Violation = snapshot.requests.latency.p50 > 50;
    const slowQueries = snapshot.database.query_latency.p95 > 100;
    const highMemoryUsage = snapshot.system.memory_usage_percent > 80;
    const lowCacheHitRate = snapshot.apiKeys.cache_hit_rate < 90;

    const issues: string[] = [];
    if (p50Violation) issues.push('Request p50 latency exceeds 50ms requirement');
    if (slowQueries) issues.push('Database queries are slow (p95 > 100ms)');
    if (highMemoryUsage) issues.push('High memory usage (> 80%)');
    if (lowCacheHitRate) issues.push('Low cache hit rate (< 90%)');

    const overallHealth = issues.length === 0 ? 'healthy' : 'degraded';

    return {
      status: overallHealth,
      timestamp: snapshot.timestamp,
      uptime: snapshot.uptime,
      issues,
      metrics: {
        requests: {
          p50_latency: snapshot.requests.latency.p50,
          p50_requirement: 50,
          p50_compliant: !p50Violation,
        },
        database: {
          p95_query_latency: snapshot.database.query_latency.p95,
          slow_query_threshold: 100,
        },
        cache: {
          hit_rate: snapshot.apiKeys.cache_hit_rate,
          cache_size: cacheStats.size,
          cache_hits: cacheStats.hits,
          cache_misses: cacheStats.misses,
        },
        system: {
          memory_usage_mb: snapshot.system.memory_usage,
          memory_usage_percent: snapshot.system.memory_usage_percent,
        },
      },
    };
  }

  /**
   * Reset metrics (for testing purposes)
   */
  @Get('reset')
  resetMetrics() {
    this.metrics.reset();
    this.cache.clear();

    this.logger.log('Metrics and cache reset via monitoring endpoint', {}, {
      category: 'monitoring',
      action: 'reset',
    });

    return {
      success: true,
      message: 'Metrics and cache reset successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
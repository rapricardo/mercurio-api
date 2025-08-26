import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../common/services/cache.service';
import { PeriodType } from '../types/analytics.types';

@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);
  private readonly cachePrefix = 'analytics';

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get cached analytics data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key);
      return await this.cacheService.get<T>(fullKey);
    } catch (error) {
      this.logger.warn('Cache get failed', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  /**
   * Set analytics data in cache
   */
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      await this.cacheService.set(fullKey, value, ttlMs);
      this.logger.debug('Analytics data cached', { key: fullKey, ttl: ttlMs });
    } catch (error) {
      this.logger.warn('Cache set failed', { key, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Delete cached analytics data
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      await this.cacheService.delete(fullKey);
      this.logger.debug('Analytics cache cleared', { key: fullKey });
    } catch (error) {
      this.logger.warn('Cache delete failed', { key, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Clear all analytics cache for a tenant/workspace
   */
  async clearTenantCache(tenantId: string, workspaceId: string): Promise<void> {
    // For now, we'll implement pattern deletion by deleting common keys
    // In a full implementation, this would use Redis SCAN or similar
    const commonKeys = this.generateWarmingKeys(tenantId, workspaceId);
    await Promise.all(commonKeys.map(key => this.delete(key)));
    this.logger.log('Cleared analytics cache for tenant', { tenantId, workspaceId });
  }

  /**
   * Build cache key for analytics data
   */
  buildCacheKey(
    endpoint: string,
    tenantId: string,
    workspaceId: string,
    params: Record<string, any>,
  ): string {
    // Sort params for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>);

    const paramString = JSON.stringify(sortedParams);
    const paramHash = this.hashString(paramString);

    return `${tenantId}:${workspaceId}:${endpoint}:${paramHash}`;
  }

  /**
   * Get appropriate TTL based on period and data type
   */
  getCacheTTL(period: PeriodType, endpoint: string): number {
    const baseTTLs = {
      '24h': 5 * 60 * 1000,   // 5 minutes for recent data
      '7d': 15 * 60 * 1000,   // 15 minutes for weekly data
      '30d': 60 * 60 * 1000,  // 1 hour for monthly data
      'custom': 30 * 60 * 1000, // 30 minutes for custom ranges
    };

    const endpointMultipliers: Record<string, number> = {
      'overview': 1.0,       // Standard caching
      'timeseries': 1.2,     // Slightly longer for time series
      'events-top': 0.8,     // Shorter for trending data
      'users': 1.5,          // Longer for user analytics
      'events-details': 0.5, // Shorter for detailed data
    };

    const baseTTL = baseTTLs[period] || baseTTLs['custom'];
    const multiplier = endpointMultipliers[endpoint] || 1.0;

    return Math.floor(baseTTL * multiplier);
  }

  /**
   * Check if data should be cached based on query parameters
   */
  shouldCache(
    period: PeriodType,
    startDate: Date,
    endDate: Date,
    otherParams: Record<string, any> = {},
  ): boolean {
    // Don't cache real-time data (last hour)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (endDate > oneHourAgo) {
      return false;
    }

    // Don't cache custom periods longer than 1 year
    if (period === 'custom') {
      const rangeMs = endDate.getTime() - startDate.getTime();
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      if (rangeMs > oneYearMs) {
        return false;
      }
    }

    // Don't cache queries with too many specific filters
    const filterCount = Object.keys(otherParams).length;
    if (filterCount > 5) {
      return false;
    }

    return true;
  }

  /**
   * Generate cache warming keys for common queries
   */
  generateWarmingKeys(tenantId: string, workspaceId: string): string[] {
    const commonQueries = [
      // Overview for common periods
      { endpoint: 'overview', period: '24h', timezone: 'UTC' },
      { endpoint: 'overview', period: '7d', timezone: 'UTC' },
      { endpoint: 'overview', period: '30d', timezone: 'UTC' },
      
      // Time series for common periods
      { endpoint: 'timeseries', period: '7d', granularity: 'day', metrics: ['events', 'visitors'], timezone: 'UTC' },
      { endpoint: 'timeseries', period: '30d', granularity: 'day', metrics: ['events', 'visitors'], timezone: 'UTC' },
      
      // Top events
      { endpoint: 'events-top', period: '7d', limit: 10, timezone: 'UTC' },
      { endpoint: 'events-top', period: '30d', limit: 10, timezone: 'UTC' },
      
      // User analytics
      { endpoint: 'users', period: '7d', segment: 'all', timezone: 'UTC' },
      { endpoint: 'users', period: '30d', segment: 'all', timezone: 'UTC' },
    ];

    return commonQueries.map(query =>
      this.buildCacheKey(query.endpoint, tenantId, workspaceId, query),
    );
  }

  /**
   * Preload common analytics data for a tenant
   */
  async warmCache(
    tenantId: string,
    workspaceId: string,
    dataLoader: (key: string, params: any) => Promise<any>,
  ): Promise<void> {
    const warmingKeys = this.generateWarmingKeys(tenantId, workspaceId);
    
    this.logger.log('Starting cache warming', { 
      tenantId, 
      workspaceId, 
      keyCount: warmingKeys.length 
    });

    const warmingPromises = warmingKeys.map(async (key) => {
      try {
        // Extract params from key for data loading
        const existing = await this.get(key);
        if (existing) {
          return; // Already cached
        }

        // Load and cache data
        // Note: This would need integration with the actual analytics service
        // for now we just mark the intention
        this.logger.debug('Cache warming key prepared', { key });
      } catch (error) {
        this.logger.warn('Cache warming failed for key', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    await Promise.allSettled(warmingPromises);
    this.logger.log('Cache warming completed', { tenantId, workspaceId });
  }

  private buildKey(key: string): string {
    return `${this.cachePrefix}:${key}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../common/services/cache.service';
import { FunnelVersionState } from '../dto/funnel-request.dto';

/**
 * Funnel-specific caching service with intelligent TTL strategies
 * Extends the base CacheService with funnel-specific cache patterns
 */
@Injectable()
export class FunnelCacheService {
  private readonly logger = new Logger(FunnelCacheService.name);

  constructor(private readonly baseCache: CacheService) {}

  // TTL strategies for different types of funnel data
  private readonly cacheTTL = {
    // Configuration data - relatively stable
    funnelConfig: 5 * 60 * 1000,        // 5 minutes
    funnelList: 2 * 60 * 1000,          // 2 minutes
    
    // Metrics data - more volatile
    conversionMetrics: 15 * 60 * 1000,   // 15 minutes
    dailyMetrics: 60 * 60 * 1000,        // 1 hour
    
    // Live data - very volatile
    liveMetrics: 30 * 1000,              // 30 seconds
    userState: 60 * 1000,                // 1 minute
    
    // Heavy computation results
    cohortAnalysis: 60 * 60 * 1000,      // 1 hour
    pathAnalysis: 30 * 60 * 1000,        // 30 minutes
  };

  /**
   * Generate cache keys for funnel-related data
   */
  public generateCacheKey(type: string, params: Record<string, any>): string {
    const keyParts = [
      'funnel',
      type,
      ...Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value}`)
    ];
    return keyParts.join(':');
  }

  /**
   * Cache a single funnel configuration
   */
  async cacheFunnelConfig(
    funnelId: string,
    tenantId: string,
    workspaceId: string,
    data: any,
  ): Promise<void> {
    const key = this.generateCacheKey('config', {
      funnelId,
      tenantId,
      workspaceId,
    });

    this.baseCache.set(key, data, this.cacheTTL.funnelConfig);
    
    this.logger.debug('Cached funnel configuration', {
      key,
      funnelId,
      ttl: this.cacheTTL.funnelConfig,
    });
  }

  /**
   * Get cached funnel configuration
   */
  async getCachedFunnelConfig(
    funnelId: string,
    tenantId: string,
    workspaceId: string,
  ): Promise<any | null> {
    const key = this.generateCacheKey('config', {
      funnelId,
      tenantId,
      workspaceId,
    });

    const cached = this.baseCache.get(key);
    
    this.logger.debug('Funnel config cache lookup', {
      key,
      hit: cached !== null,
    });

    return cached;
  }

  /**
   * Cache funnel list results
   */
  async cacheFunnelList(
    tenantId: string,
    workspaceId: string,
    filters: Record<string, any>,
    data: any,
  ): Promise<void> {
    const key = this.generateCacheKey('list', {
      tenantId,
      workspaceId,
      ...filters,
    });

    this.baseCache.set(key, data, this.cacheTTL.funnelList);
    
    this.logger.debug('Cached funnel list', {
      key,
      count: data.funnels?.length || 0,
      ttl: this.cacheTTL.funnelList,
    });
  }

  /**
   * Get cached funnel list
   */
  async getCachedFunnelList(
    tenantId: string,
    workspaceId: string,
    filters: Record<string, any>,
  ): Promise<any | null> {
    const key = this.generateCacheKey('list', {
      tenantId,
      workspaceId,
      ...filters,
    });

    const cached = this.baseCache.get(key);
    
    this.logger.debug('Funnel list cache lookup', {
      key,
      hit: cached !== null,
    });

    return cached;
  }

  /**
   * Cache conversion metrics
   */
  async cacheConversionMetrics(
    funnelId: string,
    tenantId: string,
    workspaceId: string,
    period: string,
    data: any,
  ): Promise<void> {
    const key = this.generateCacheKey('conversion', {
      funnelId,
      tenantId,
      workspaceId,
      period,
    });

    const ttl = this.getTTLForPeriod(period, 'conversion');
    this.baseCache.set(key, data, ttl);
    
    this.logger.debug('Cached conversion metrics', {
      key,
      period,
      ttl,
    });
  }

  /**
   * Get cached conversion metrics
   */
  async getCachedConversionMetrics(
    funnelId: string,
    tenantId: string,
    workspaceId: string,
    period: string,
  ): Promise<any | null> {
    const key = this.generateCacheKey('conversion', {
      funnelId,
      tenantId,
      workspaceId,
      period,
    });

    return this.baseCache.get(key);
  }

  /**
   * Cache live metrics with shorter TTL
   */
  async cacheLiveMetrics(
    funnelId: string,
    tenantId: string,
    workspaceId: string,
    data: any,
  ): Promise<void> {
    const key = this.generateCacheKey('live', {
      funnelId,
      tenantId,
      workspaceId,
    });

    this.baseCache.set(key, data, this.cacheTTL.liveMetrics);
    
    this.logger.debug('Cached live metrics', {
      key,
      ttl: this.cacheTTL.liveMetrics,
    });
  }

  /**
   * Get cached live metrics
   */
  async getCachedLiveMetrics(
    funnelId: string,
    tenantId: string,
    workspaceId: string,
  ): Promise<any | null> {
    const key = this.generateCacheKey('live', {
      funnelId,
      tenantId,
      workspaceId,
    });

    return this.baseCache.get(key);
  }

  /**
   * Cache user state information
   */
  async cacheUserState(
    funnelId: string,
    anonymousId: string,
    tenantId: string,
    workspaceId: string,
    data: any,
  ): Promise<void> {
    const key = this.generateCacheKey('user_state', {
      funnelId,
      anonymousId,
      tenantId,
      workspaceId,
    });

    this.baseCache.set(key, data, this.cacheTTL.userState);
  }

  /**
   * Get cached user state
   */
  async getCachedUserState(
    funnelId: string,
    anonymousId: string,
    tenantId: string,
    workspaceId: string,
  ): Promise<any | null> {
    const key = this.generateCacheKey('user_state', {
      funnelId,
      anonymousId,
      tenantId,
      workspaceId,
    });

    return this.baseCache.get(key);
  }

  /**
   * Invalidate all cache entries for a specific funnel
   */
  async invalidateFunnelCache(
    funnelId: string,
    tenantId: string,
    workspaceId: string,
  ): Promise<void> {
    const patterns = [
      `funnel:config:funnelId:${funnelId}:tenantId:${tenantId}:workspaceId:${workspaceId}`,
      `funnel:conversion:funnelId:${funnelId}:tenantId:${tenantId}:workspaceId:${workspaceId}`,
      `funnel:live:funnelId:${funnelId}:tenantId:${tenantId}:workspaceId:${workspaceId}`,
    ];

    // Also invalidate list caches for this workspace
    const listPattern = `funnel:list:tenantId:${tenantId}:workspaceId:${workspaceId}`;
    patterns.push(listPattern);

    for (const pattern of patterns) {
      this.baseCache.delete(pattern);
    }

    this.logger.log('Invalidated funnel cache', {
      funnelId,
      tenantId,
      workspaceId,
      patterns,
    });
  }

  /**
   * Invalidate workspace-level caches (when funnels are created/deleted)
   */
  async invalidateWorkspaceCache(tenantId: string, workspaceId: string): Promise<void> {
    // This would need a more sophisticated implementation with Redis pattern matching
    // For now, we'll just log the invalidation intent
    this.logger.log('Workspace funnel cache invalidation requested', {
      tenantId,
      workspaceId,
    });
    
    // In a Redis implementation, this would be:
    // await redis.keys(`funnel:list:tenantId:${tenantId}:workspaceId:${workspaceId}*`)
    // and delete all matching keys
  }

  /**
   * Warm cache for frequently accessed funnels
   */
  async warmFunnelCache(
    funnelId: string,
    tenantId: string,
    workspaceId: string,
    data: {
      config?: any;
      conversionMetrics?: any;
      liveMetrics?: any;
    },
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    if (data.config) {
      promises.push(
        this.cacheFunnelConfig(funnelId, tenantId, workspaceId, data.config)
      );
    }

    if (data.conversionMetrics) {
      promises.push(
        this.cacheConversionMetrics(
          funnelId,
          tenantId,
          workspaceId,
          '7d',
          data.conversionMetrics
        )
      );
    }

    if (data.liveMetrics) {
      promises.push(
        this.cacheLiveMetrics(funnelId, tenantId, workspaceId, data.liveMetrics)
      );
    }

    await Promise.all(promises);

    this.logger.log('Warmed funnel cache', {
      funnelId,
      tenantId,
      workspaceId,
      cachedItems: Object.keys(data),
    });
  }

  /**
   * Get appropriate TTL based on data type and time period
   */
  private getTTLForPeriod(period: string, dataType: 'conversion' | 'live'): number {
    const baseTTL = this.cacheTTL[`${dataType}Metrics`] || this.cacheTTL.conversionMetrics;
    
    // Longer periods can be cached longer
    switch (period) {
      case '1h':
      case '24h':
        return Math.min(baseTTL, 5 * 60 * 1000); // Max 5 minutes for recent data
      case '7d':
        return baseTTL;
      case '30d':
      case '90d':
        return baseTTL * 2; // Longer cache for longer periods
      default:
        return baseTTL;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    const baseStats = this.baseCache.getStats();
    
    return {
      ...baseStats,
      funnelCacheTTL: this.cacheTTL,
      funnelCacheEnabled: true,
    };
  }

  /**
   * Clear all funnel-related caches (for testing/debugging)
   */
  clearAllFunnelCaches(): void {
    // In a real implementation with Redis, this would use pattern matching
    // For the in-memory cache, we'll clear everything
    this.baseCache.clear();
    
    this.logger.warn('All funnel caches cleared');
  }

  /**
   * Generic get method for analytics service
   */
  async get<T>(key: string): Promise<T | null> {
    return this.baseCache.get<T>(key);
  }

  /**
   * Generic set method for analytics service
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.baseCache.set(key, value, ttl);
  }

  /**
   * Get TTL for specific cache type
   */
  getTTL(cacheType: keyof typeof this.cacheTTL): number {
    return this.cacheTTL[cacheType];
  }
}
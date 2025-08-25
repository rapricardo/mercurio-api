import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds
  limit: number;
}

export interface RateLimitConfig {
  redis: {
    enabled: boolean;
    url?: string;
    keyPrefix: string;
    connectionTimeout: number;
  };
  limits: {
    [tenantTier: string]: {
      events: { requests: number; windowMs: number };
      queries: { requests: number; windowMs: number };
      admin: { requests: number; windowMs: number };
    };
  };
  fallback: {
    enabled: boolean;
    conservativeLimits: boolean;
  };
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // tokens per second
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly config: RateLimitConfig;
  private readonly inMemoryBuckets = new Map<string, TokenBucket>();
  private redisClient: any = null;
  private cleanupInterval: NodeJS.Timeout;

  constructor(private readonly metrics: MetricsService) {
    this.config = {
      redis: {
        enabled: process.env.REDIS_URL ? true : false,
        url: process.env.REDIS_URL,
        keyPrefix: process.env.RATE_LIMIT_REDIS_PREFIX || 'mercurio:ratelimit:',
        connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT || '5000'),
      },
      limits: {
        free: {
          events: { requests: 1000, windowMs: 60000 }, // 1000 req/min
          queries: { requests: 100, windowMs: 60000 }, // 100 req/min
          admin: { requests: 50, windowMs: 60000 }, // 50 req/min
        },
        standard: {
          events: { requests: 5000, windowMs: 60000 }, // 5000 req/min
          queries: { requests: 500, windowMs: 60000 }, // 500 req/min
          admin: { requests: 200, windowMs: 60000 }, // 200 req/min
        },
        premium: {
          events: { requests: 10000, windowMs: 60000 }, // 10000 req/min
          queries: { requests: 1000, windowMs: 60000 }, // 1000 req/min
          admin: { requests: 500, windowMs: 60000 }, // 500 req/min
        },
      },
      fallback: {
        enabled: process.env.RATE_LIMIT_FALLBACK_ENABLED !== 'false',
        conservativeLimits: true,
      },
    };

    this.initializeRedis();
    this.startCleanup();
    this.logger.log('Rate limiting service initialized', {
      redisEnabled: this.config.redis.enabled,
      fallbackEnabled: this.config.fallback.enabled,
    });
  }

  /**
   * Check if a request is allowed under rate limits
   */
  async checkLimit(
    tenantId: string, 
    endpoint: 'events' | 'queries' | 'admin',
    tenantTier: string = 'free'
  ): Promise<RateLimitResult> {
    const key = `${tenantId}:${endpoint}`;
    
    // Get rate limit configuration for tenant tier
    const tierLimits = this.config.limits[tenantTier] || this.config.limits.free;
    const endpointLimit = tierLimits[endpoint];
    
    let result: RateLimitResult;

    try {
      if (this.config.redis.enabled && this.redisClient) {
        result = await this.checkLimitRedis(key, endpointLimit.requests, endpointLimit.windowMs);
      } else {
        result = await this.checkLimitInMemory(key, endpointLimit.requests, endpointLimit.windowMs);
      }
    } catch (error) {
      this.logger.error('Rate limit check failed, allowing request', error);
      // In case of error, allow the request but log it
      result = {
        allowed: true,
        remaining: endpointLimit.requests,
        resetTime: new Date(Date.now() + endpointLimit.windowMs),
        limit: endpointLimit.requests,
      };
    }

    // Record metrics
    if (result.allowed) {
      this.metrics.incrementCounter('ratelimit.requests_allowed');
    } else {
      this.metrics.incrementCounter('ratelimit.requests_denied');
      this.metrics.incrementCounter(`ratelimit.violations.${endpoint}`);
      
      this.logger.warn('Rate limit exceeded', {
        tenantId,
        endpoint,
        tier: tenantTier,
        limit: result.limit,
        remaining: result.remaining,
      });
    }

    return result;
  }

  /**
   * Increment usage for a tenant/endpoint combination
   */
  async incrementUsage(
    tenantId: string,
    endpoint: 'events' | 'queries' | 'admin',
    tenantTier: string = 'free'
  ): Promise<void> {
    const key = `${tenantId}:${endpoint}`;
    const tierLimits = this.config.limits[tenantTier] || this.config.limits.free;
    const endpointLimit = tierLimits[endpoint];

    try {
      if (this.config.redis.enabled && this.redisClient) {
        await this.incrementUsageRedis(key, endpointLimit.windowMs);
      } else {
        await this.incrementUsageInMemory(key, endpointLimit.requests, endpointLimit.windowMs);
      }
    } catch (error) {
      this.logger.error('Failed to increment usage', error, { tenantId, endpoint });
    }
  }

  /**
   * Get remaining quota for a tenant/endpoint
   */
  async getRemainingQuota(
    tenantId: string,
    endpoint: 'events' | 'queries' | 'admin',
    tenantTier: string = 'free'
  ): Promise<number> {
    const result = await this.checkLimit(tenantId, endpoint, tenantTier);
    return result.remaining;
  }

  /**
   * Reset all limits for a tenant (admin operation)
   */
  async resetTenantLimits(tenantId: string): Promise<void> {
    try {
      if (this.config.redis.enabled && this.redisClient) {
        const keys = await this.redisClient.keys(`${this.config.redis.keyPrefix}${tenantId}:*`);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } else {
        // Remove in-memory buckets for this tenant
        for (const [key] of this.inMemoryBuckets.entries()) {
          if (key.startsWith(`${tenantId}:`)) {
            this.inMemoryBuckets.delete(key);
          }
        }
      }
      
      this.logger.log('Rate limits reset for tenant', { tenantId });
    } catch (error) {
      this.logger.error('Failed to reset tenant limits', error, { tenantId });
      throw error;
    }
  }

  /**
   * Health check for rate limiting service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test in-memory functionality
      const testResult = await this.checkLimitInMemory('health:test', 100, 60000);
      if (!testResult || typeof testResult.allowed !== 'boolean') {
        return false;
      }

      // Test Redis if enabled
      if (this.config.redis.enabled && this.redisClient) {
        await this.redisClient.ping();
      }

      return true;
    } catch (error) {
      this.logger.error('Rate limiting health check failed', error);
      return false;
    }
  }

  /**
   * Redis-based rate limiting implementation
   */
  private async checkLimitRedis(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const redisKey = `${this.config.redis.keyPrefix}${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use Redis sorted set for sliding window
    const pipeline = this.redisClient.pipeline();
    
    // Remove expired entries
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    
    // Count current requests in window
    pipeline.zcard(redisKey);
    
    // Add current request
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipeline.expire(redisKey, Math.ceil(windowMs / 1000));

    const results = await pipeline.exec();
    const currentCount = parseInt(results[1][1]) || 0;

    const remaining = Math.max(0, limit - currentCount - 1); // -1 for the request we just added
    const resetTime = new Date(now + windowMs);

    return {
      allowed: currentCount < limit,
      remaining,
      resetTime,
      retryAfter: currentCount >= limit ? Math.ceil(windowMs / 1000) : undefined,
      limit,
    };
  }

  /**
   * In-memory rate limiting using token bucket algorithm
   */
  private async checkLimitInMemory(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.getOrCreateBucket(key, limit, windowMs);
    
    // Refill tokens based on time elapsed
    this.refillBucket(bucket, now);
    
    const allowed = bucket.tokens > 0;
    const resetTime = new Date(now + windowMs);
    
    if (allowed) {
      bucket.tokens -= 1;
    }

    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      resetTime,
      retryAfter: !allowed ? Math.ceil(windowMs / 1000) : undefined,
      limit: bucket.capacity,
    };
  }

  /**
   * Increment usage in Redis
   */
  private async incrementUsageRedis(key: string, windowMs: number): Promise<void> {
    const redisKey = `${this.config.redis.keyPrefix}${key}`;
    const now = Date.now();
    
    await this.redisClient.zadd(redisKey, now, `${now}-${Math.random()}`);
    await this.redisClient.expire(redisKey, Math.ceil(windowMs / 1000));
  }

  /**
   * Increment usage in memory
   */
  private async incrementUsageInMemory(key: string, limit: number, windowMs: number): Promise<void> {
    const bucket = this.getOrCreateBucket(key, limit, windowMs);
    const now = Date.now();
    
    this.refillBucket(bucket, now);
    
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
    }
  }

  /**
   * Get or create a token bucket for in-memory rate limiting
   */
  private getOrCreateBucket(key: string, capacity: number, windowMs: number): TokenBucket {
    let bucket = this.inMemoryBuckets.get(key);
    
    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefill: Date.now(),
        capacity,
        refillRate: capacity / (windowMs / 1000), // tokens per second
      };
      this.inMemoryBuckets.set(key, bucket);
    }
    
    return bucket;
  }

  /**
   * Refill tokens in a bucket based on elapsed time
   */
  private refillBucket(bucket: TokenBucket, now: number): void {
    const elapsedMs = now - bucket.lastRefill;
    const elapsedSeconds = elapsedMs / 1000;
    const tokensToAdd = elapsedSeconds * bucket.refillRate;
    
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Initialize Redis connection if enabled
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config.redis.enabled || !this.config.redis.url) {
      this.logger.log('Redis rate limiting disabled');
      return;
    }

    try {
      const Redis = require('ioredis');
      this.redisClient = new Redis(this.config.redis.url, {
        connectTimeout: this.config.redis.connectionTimeout,
        lazyConnect: true,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Redis rate limiting connected');
      });

      this.redisClient.on('error', (error: Error) => {
        this.logger.error('Redis rate limiting error', error);
        if (this.config.fallback.enabled) {
          this.logger.warn('Falling back to in-memory rate limiting');
        }
      });

      await this.redisClient.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis rate limiting', error);
      if (this.config.fallback.enabled) {
        this.logger.log('Using in-memory rate limiting as fallback');
      } else {
        throw error;
      }
    }
  }

  /**
   * Start periodic cleanup of expired in-memory buckets
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredBuckets();
    }, 60000); // Cleanup every minute
  }

  /**
   * Remove expired in-memory buckets
   */
  private cleanupExpiredBuckets(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, bucket] of this.inMemoryBuckets.entries()) {
      // Remove buckets that haven't been accessed for 5 minutes
      if (now - bucket.lastRefill > 300000) {
        this.inMemoryBuckets.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit buckets`);
    }
  }

  /**
   * Cleanup on service destruction
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }
}
import { Injectable, Logger } from '@nestjs/common';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccessAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  evictions: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  
  private readonly maxSize = parseInt(process.env.CACHE_MAX_SIZE || '1000');
  private readonly defaultTtlMs = parseInt(process.env.CACHE_DEFAULT_TTL || '300000'); // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval (every 60 seconds)
    this.startCleanupInterval();
    
    this.logger.log(`Cache service initialized with max size: ${this.maxSize}, default TTL: ${this.defaultTtlMs}ms`);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessAt = Date.now();
    this.stats.hits++;
    
    return entry.value as T;
  }

  /**
   * Set value in cache with optional TTL
   */
  set<T>(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    // Check if we need to evict entries to make space
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    const expiresAt = Date.now() + ttlMs;
    const entry: CacheEntry<T> = {
      value,
      expiresAt,
      accessCount: 0,
      lastAccessAt: Date.now(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.log(`Cache cleared, removed ${size} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
      evictions: this.stats.evictions,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  /**
   * Get all cache entries (for debugging)
   */
  getEntries(): Array<{ key: string; entry: CacheEntry<any> }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }));
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let lruKey: string | null = null;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessAt < oldestAccess) {
        oldestAccess = entry.lastAccessAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
      this.logger.debug(`Evicted LRU cache entry: ${lruKey}`);
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    const cleanupIntervalMs = parseInt(process.env.CACHE_CLEANUP_INTERVAL || '60000'); // 1 minute

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, cleanupIntervalMs);
  }

  /**
   * Remove all expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }
}
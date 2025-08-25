import { Injectable, Logger } from '@nestjs/common';

export interface LatencyMetric {
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface CounterMetric {
  value: number;
  rate: number; // per second over last minute
}

export interface MetricsSnapshot {
  timestamp: string;
  uptime: number;
  
  // Request metrics
  requests: {
    total: CounterMetric;
    success: CounterMetric;
    errors: CounterMetric;
    latency: LatencyMetric;
  };
  
  // Event processing metrics
  events: {
    tracked: CounterMetric;
    batched: CounterMetric;
    identified: CounterMetric;
    duplicates: CounterMetric;
    processing_latency: LatencyMetric;
  };
  
  // API key metrics
  apiKeys: {
    validations: CounterMetric;
    cache_hits: CounterMetric;
    cache_misses: CounterMetric;
    cache_hit_rate: number;
  };
  
  // Encryption metrics
  encryption: {
    operations: CounterMetric;
    email_encryptions: CounterMetric;
    phone_encryptions: CounterMetric;
    email_decryptions: CounterMetric;
    phone_decryptions: CounterMetric;
    encryption_latency: LatencyMetric;
    errors: CounterMetric;
  };
  
  // Rate limiting metrics
  rateLimiting: {
    requests_allowed: CounterMetric;
    requests_denied: CounterMetric;
    violations_events: CounterMetric;
    violations_queries: CounterMetric;
    violations_admin: CounterMetric;
    redis_errors: CounterMetric;
  };
  
  // Database metrics
  database: {
    queries: CounterMetric;
    query_latency: LatencyMetric;
    connections: number;
  };
  
  // System metrics
  system: {
    memory_usage: number; // in MB
    memory_usage_percent: number;
    cpu_usage?: number; // if available
  };
}

interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

interface RollingMetric {
  values: number[];
  timestamps: number[];
  windowMs: number;
  maxPoints: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly startTime = Date.now();
  
  // Rolling metrics for percentile calculations
  private readonly rollingMetrics = new Map<string, RollingMetric>();
  
  // Simple counters
  private readonly counters = new Map<string, number>();
  
  // Rate calculations (per minute)
  private readonly rates = new Map<string, TimeSeriesPoint[]>();
  
  // Latency histograms
  private readonly latencies = new Map<string, number[]>();
  
  private readonly defaultWindowMs = 60000; // 1 minute
  private readonly maxDataPoints = 1000;

  constructor() {
    this.logger.log('Metrics service initialized');
    
    // Initialize core metrics
    this.initializeMetrics();
    
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
    
    // Update rate tracking
    this.updateRate(name, value);
  }

  /**
   * Record a latency measurement in milliseconds
   */
  recordLatency(name: string, latencyMs: number): void {
    // Add to latency array for percentile calculation
    let latencies = this.latencies.get(name);
    if (!latencies) {
      latencies = [];
      this.latencies.set(name, latencies);
    }
    
    latencies.push(latencyMs);
    
    // Keep only recent measurements (sliding window)
    const windowMs = this.defaultWindowMs;
    const now = Date.now();
    const cutoff = now - windowMs;
    
    // Simple approach: keep last N measurements instead of time-based
    if (latencies.length > this.maxDataPoints) {
      latencies.splice(0, latencies.length - this.maxDataPoints);
    }
  }

  /**
   * Record a custom gauge value
   */
  recordGauge(name: string, value: number): void {
    this.counters.set(`gauge_${name}`, value);
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    const now = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      timestamp: now,
      uptime,
      
      requests: {
        total: this.getCounterMetric('requests.total'),
        success: this.getCounterMetric('requests.success'),
        errors: this.getCounterMetric('requests.errors'),
        latency: this.getLatencyMetric('requests.latency'),
      },
      
      events: {
        tracked: this.getCounterMetric('events.tracked'),
        batched: this.getCounterMetric('events.batched'),
        identified: this.getCounterMetric('events.identified'),
        duplicates: this.getCounterMetric('events.duplicates'),
        processing_latency: this.getLatencyMetric('events.processing_latency'),
      },
      
      apiKeys: {
        validations: this.getCounterMetric('apikeys.validations'),
        cache_hits: this.getCounterMetric('apikeys.cache_hits'),
        cache_misses: this.getCounterMetric('apikeys.cache_misses'),
        cache_hit_rate: this.calculateCacheHitRate(),
      },
      
      encryption: {
        operations: this.getCounterMetric('encryption.operations'),
        email_encryptions: this.getCounterMetric('encryption.email_encryptions'),
        phone_encryptions: this.getCounterMetric('encryption.phone_encryptions'),
        email_decryptions: this.getCounterMetric('encryption.email_decryptions'),
        phone_decryptions: this.getCounterMetric('encryption.phone_decryptions'),
        encryption_latency: this.getLatencyMetric('encryption.latency'),
        errors: this.getCounterMetric('encryption.errors'),
      },
      
      rateLimiting: {
        requests_allowed: this.getCounterMetric('ratelimit.requests_allowed'),
        requests_denied: this.getCounterMetric('ratelimit.requests_denied'),
        violations_events: this.getCounterMetric('ratelimit.violations.events'),
        violations_queries: this.getCounterMetric('ratelimit.violations.queries'),
        violations_admin: this.getCounterMetric('ratelimit.violations.admin'),
        redis_errors: this.getCounterMetric('ratelimit.redis_errors'),
      },
      
      database: {
        queries: this.getCounterMetric('database.queries'),
        query_latency: this.getLatencyMetric('database.query_latency'),
        connections: this.counters.get('gauge_database.connections') || 0,
      },
      
      system: {
        memory_usage: this.getMemoryUsage(),
        memory_usage_percent: this.getMemoryUsagePercent(),
      },
    };
  }

  /**
   * Get metrics in Prometheus format for external monitoring
   */
  getPrometheusMetrics(): string {
    const snapshot = this.getSnapshot();
    const lines: string[] = [];

    // Helper function to add metric
    const addMetric = (name: string, value: number, help: string, type: 'counter' | 'gauge' | 'histogram' = 'counter') => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
      lines.push(`${name} ${value}`);
    };

    // Request metrics
    addMetric('mercurio_requests_total', snapshot.requests.total.value, 'Total HTTP requests');
    addMetric('mercurio_requests_success_total', snapshot.requests.success.value, 'Successful HTTP requests');
    addMetric('mercurio_requests_errors_total', snapshot.requests.errors.value, 'Failed HTTP requests');
    addMetric('mercurio_request_duration_ms', snapshot.requests.latency.p50, 'Request duration P50 in milliseconds', 'gauge');

    // Event metrics
    addMetric('mercurio_events_tracked_total', snapshot.events.tracked.value, 'Total events tracked');
    addMetric('mercurio_events_batched_total', snapshot.events.batched.value, 'Total batch events processed');
    addMetric('mercurio_events_identified_total', snapshot.events.identified.value, 'Total identify events processed');
    addMetric('mercurio_events_duplicates_total', snapshot.events.duplicates.value, 'Total duplicate events detected');

    // API key metrics
    addMetric('mercurio_apikey_validations_total', snapshot.apiKeys.validations.value, 'Total API key validations');
    addMetric('mercurio_apikey_cache_hit_rate', snapshot.apiKeys.cache_hit_rate, 'API key cache hit rate', 'gauge');

    // System metrics
    addMetric('mercurio_memory_usage_mb', snapshot.system.memory_usage, 'Memory usage in MB', 'gauge');
    addMetric('mercurio_uptime_seconds', snapshot.uptime, 'Application uptime in seconds', 'gauge');

    return lines.join('\n');
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.counters.clear();
    this.rates.clear();
    this.latencies.clear();
    this.rollingMetrics.clear();
    this.initializeMetrics();
    this.logger.log('Metrics reset');
  }

  private initializeMetrics(): void {
    // Initialize counters with zero values
    const initialCounters = [
      'requests.total',
      'requests.success', 
      'requests.errors',
      'events.tracked',
      'events.batched',
      'events.identified',
      'events.duplicates',
      'apikeys.validations',
      'apikeys.cache_hits',
      'apikeys.cache_misses',
      'encryption.operations',
      'encryption.email_encryptions',
      'encryption.phone_encryptions',
      'encryption.email_decryptions',
      'encryption.phone_decryptions',
      'encryption.errors',
      'ratelimit.requests_allowed',
      'ratelimit.requests_denied',
      'ratelimit.violations.events',
      'ratelimit.violations.queries',
      'ratelimit.violations.admin',
      'ratelimit.redis_errors',
      'database.queries',
    ];

    for (const counter of initialCounters) {
      this.counters.set(counter, 0);
      this.rates.set(counter, []);
    }

    // Initialize latency arrays
    const latencyMetrics = [
      'requests.latency',
      'events.processing_latency',
      'encryption.latency',
      'database.query_latency',
    ];

    for (const metric of latencyMetrics) {
      this.latencies.set(metric, []);
    }
  }

  private updateRate(name: string, value: number): void {
    const now = Date.now();
    let points = this.rates.get(name);
    
    if (!points) {
      points = [];
      this.rates.set(name, points);
    }
    
    points.push({ timestamp: now, value });
    
    // Clean old points (older than 1 minute)
    const cutoff = now - this.defaultWindowMs;
    this.rates.set(name, points.filter(p => p.timestamp > cutoff));
  }

  private getCounterMetric(name: string): CounterMetric {
    const value = this.counters.get(name) || 0;
    const rate = this.getRate(name);
    
    return { value, rate };
  }

  private getLatencyMetric(name: string): LatencyMetric {
    const latencies = this.latencies.get(name) || [];
    
    if (latencies.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      p50: this.percentile(sorted, 0.5),
      p90: this.percentile(sorted, 0.9),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  private getRate(name: string): number {
    const points = this.rates.get(name) || [];
    if (points.length === 0) return 0;
    
    const now = Date.now();
    const oneMinuteAgo = now - this.defaultWindowMs;
    const recentPoints = points.filter(p => p.timestamp > oneMinuteAgo);
    
    if (recentPoints.length === 0) return 0;
    
    const totalValue = recentPoints.reduce((sum, p) => sum + p.value, 0);
    const timeSpan = (now - recentPoints[0].timestamp) / 1000; // seconds
    
    return timeSpan > 0 ? totalValue / timeSpan : 0;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private calculateCacheHitRate(): number {
    const hits = this.counters.get('apikeys.cache_hits') || 0;
    const misses = this.counters.get('apikeys.cache_misses') || 0;
    const total = hits + misses;
    
    return total > 0 ? (hits / total) * 100 : 0;
  }

  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.rss / 1024 / 1024); // Convert to MB
  }

  private getMemoryUsagePercent(): number {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    
    return Math.round((heapUsedMB / heapTotalMB) * 100);
  }

  private startCleanup(): void {
    // Clean up old data every 5 minutes
    setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000);
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const cutoff = now - this.defaultWindowMs;
    let cleaned = 0;

    // Clean rate data
    for (const [name, points] of this.rates.entries()) {
      const oldLength = points.length;
      const filtered = points.filter(p => p.timestamp > cutoff);
      this.rates.set(name, filtered);
      cleaned += oldLength - filtered.length;
    }

    // Clean latency data (keep only recent measurements)
    for (const [name, latencies] of this.latencies.entries()) {
      if (latencies.length > this.maxDataPoints) {
        const removed = latencies.length - this.maxDataPoints;
        latencies.splice(0, removed);
        cleaned += removed;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} old metric data points`);
    }
  }
}
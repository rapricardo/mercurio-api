import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitService } from './rate-limit.service';
import { MetricsService } from './metrics.service';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let mockMetrics: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    // Mock MetricsService
    mockMetrics = {
      incrementCounter: jest.fn(),
      recordLatency: jest.fn(),
      recordGauge: jest.fn(),
      getSnapshot: jest.fn(),
      getPrometheusMetrics: jest.fn(),
      reset: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: MetricsService,
          useValue: mockMetrics,
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('In-Memory Rate Limiting', () => {
    it('should allow requests within limits', async () => {
      const tenantId = 'tenant-1';
      const endpoint = 'events';
      
      const result = await service.checkLimit(tenantId, endpoint, 'free');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(1000); // free tier limit
      expect(result.limit).toBe(1000);
      expect(result.resetTime).toBeInstanceOf(Date);
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith('ratelimit.requests_allowed');
    });

    it('should deny requests when limit exceeded', async () => {
      const tenantId = 'tenant-2';
      const endpoint = 'events';
      
      // Make many requests to exceed the limit
      const promises = [];
      for (let i = 0; i < 1005; i++) { // Exceed free tier limit of 1000
        promises.push(service.checkLimit(tenantId, endpoint, 'free'));
      }
      
      const results = await Promise.all(promises);
      
      // Some requests should be denied
      const deniedRequests = results.filter(r => !r.allowed);
      expect(deniedRequests.length).toBeGreaterThan(0);
      
      // Verify denied request has retryAfter
      const deniedResult = deniedRequests[0];
      expect(deniedResult.retryAfter).toBeDefined();
      expect(deniedResult.remaining).toBe(0);
      
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith('ratelimit.requests_denied');
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith('ratelimit.violations.events');
    });

    it('should handle different tenant tiers correctly', async () => {
      const tenantId = 'premium-tenant';
      const endpoint = 'events';
      
      const freeResult = await service.checkLimit(tenantId, endpoint, 'free');
      const premiumResult = await service.checkLimit(tenantId, endpoint, 'premium');
      
      expect(freeResult.limit).toBe(1000);
      expect(premiumResult.limit).toBe(10000);
    });

    it('should handle different endpoint types correctly', async () => {
      const tenantId = 'tenant-3';
      
      const eventsResult = await service.checkLimit(tenantId, 'events', 'free');
      const queriesResult = await service.checkLimit(tenantId, 'queries', 'free');
      const adminResult = await service.checkLimit(tenantId, 'admin', 'free');
      
      expect(eventsResult.limit).toBe(1000);
      expect(queriesResult.limit).toBe(100);
      expect(adminResult.limit).toBe(50);
    });
  });

  describe('Usage Increment', () => {
    it('should increment usage correctly', async () => {
      const tenantId = 'tenant-4';
      const endpoint = 'events';
      
      const beforeResult = await service.checkLimit(tenantId, endpoint, 'free');
      const initialRemaining = beforeResult.remaining;
      
      await service.incrementUsage(tenantId, endpoint, 'free');
      
      const afterResult = await service.checkLimit(tenantId, endpoint, 'free');
      
      // Remaining should decrease after usage increment
      expect(afterResult.remaining).toBeLessThan(initialRemaining);
    });

    it('should handle multiple increments correctly', async () => {
      const tenantId = 'tenant-5';
      const endpoint = 'events';
      
      const beforeResult = await service.checkLimit(tenantId, endpoint, 'free');
      
      // Increment usage multiple times
      for (let i = 0; i < 5; i++) {
        await service.incrementUsage(tenantId, endpoint, 'free');
      }
      
      const afterResult = await service.checkLimit(tenantId, endpoint, 'free');
      
      // Remaining should be significantly less
      expect(afterResult.remaining).toBeLessThan(beforeResult.remaining - 3);
    });
  });

  describe('Quota Management', () => {
    it('should return remaining quota correctly', async () => {
      const tenantId = 'tenant-6';
      const endpoint = 'events';
      
      const quota = await service.getRemainingQuota(tenantId, endpoint, 'free');
      
      expect(quota).toBeGreaterThanOrEqual(0);
      expect(quota).toBeLessThanOrEqual(1000);
    });

    it('should reset tenant limits correctly', async () => {
      const tenantId = 'tenant-7';
      const endpoint = 'events';
      
      // Use some quota
      await service.incrementUsage(tenantId, endpoint, 'free');
      await service.incrementUsage(tenantId, endpoint, 'free');
      
      const beforeReset = await service.checkLimit(tenantId, endpoint, 'free');
      
      // Reset limits
      await service.resetTenantLimits(tenantId);
      
      const afterReset = await service.checkLimit(tenantId, endpoint, 'free');
      
      // After reset, should have more remaining quota
      expect(afterReset.remaining).toBeGreaterThan(beforeReset.remaining);
    });
  });

  describe('Token Bucket Algorithm', () => {
    it('should refill tokens over time', async () => {
      const tenantId = 'tenant-8';
      const endpoint = 'events';
      
      // Use some tokens
      for (let i = 0; i < 10; i++) {
        await service.incrementUsage(tenantId, endpoint, 'free');
      }
      
      const beforeWait = await service.checkLimit(tenantId, endpoint, 'free');
      
      // Wait for token refill (simulate time passage)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const afterWait = await service.checkLimit(tenantId, endpoint, 'free');
      
      // Should have more tokens available (or at least not less)
      expect(afterWait.remaining).toBeGreaterThanOrEqual(beforeWait.remaining);
    });

    it('should not exceed capacity when refilling', async () => {
      const tenantId = 'tenant-9';
      const endpoint = 'events';
      
      // Start fresh
      const result = await service.checkLimit(tenantId, endpoint, 'free');
      
      // Wait for potential token refill
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const afterWait = await service.checkLimit(tenantId, endpoint, 'free');
      
      // Should not exceed the configured limit
      expect(afterWait.remaining).toBeLessThanOrEqual(1000);
      expect(afterWait.limit).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle metric service errors gracefully', async () => {
      mockMetrics.incrementCounter.mockImplementation(() => {
        throw new Error('Metrics service error');
      });
      
      const tenantId = 'tenant-10';
      const endpoint = 'events';
      
      // Should not throw, should still work
      const result = await service.checkLimit(tenantId, endpoint, 'free');
      
      expect(result.allowed).toBeDefined();
      expect(result.remaining).toBeDefined();
      expect(result.limit).toBeDefined();
    });

    it('should handle invalid tenant tiers gracefully', async () => {
      const tenantId = 'tenant-11';
      const endpoint = 'events';
      
      // Use invalid tier, should fallback to 'free'
      const result = await service.checkLimit(tenantId, endpoint, 'invalid-tier' as any);
      
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1000); // free tier limit
    });
  });

  describe('Health Check', () => {
    it('should pass health check with working service', async () => {
      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should handle health check errors', async () => {
      // Mock a method to fail during health check
      const originalCheckLimit = service.checkLimit;
      service.checkLimit = jest.fn().mockRejectedValue(new Error('Health check error'));
      
      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(false);
      
      // Restore original method
      service.checkLimit = originalCheckLimit;
    });
  });

  describe('Configuration', () => {
    it('should handle missing Redis configuration', () => {
      // Service should initialize without Redis
      expect(service).toBeDefined();
      // In-memory fallback should be used
    });

    it('should use conservative limits in fallback mode', async () => {
      const tenantId = 'tenant-12';
      const endpoint = 'admin';
      
      const result = await service.checkLimit(tenantId, endpoint, 'free');
      
      // Admin endpoint should have lower limits
      expect(result.limit).toBe(50);
    });
  });

  describe('Tenant Isolation', () => {
    it('should isolate rate limits between different tenants', async () => {
      const tenant1 = 'tenant-13';
      const tenant2 = 'tenant-14';
      const endpoint = 'events';
      
      // Use quota for tenant1
      for (let i = 0; i < 10; i++) {
        await service.incrementUsage(tenant1, endpoint, 'free');
      }
      
      const tenant1Result = await service.checkLimit(tenant1, endpoint, 'free');
      const tenant2Result = await service.checkLimit(tenant2, endpoint, 'free');
      
      // Tenant2 should have full quota available
      expect(tenant2Result.remaining).toBeGreaterThan(tenant1Result.remaining);
    });

    it('should isolate rate limits between different endpoints for same tenant', async () => {
      const tenantId = 'tenant-15';
      
      // Use quota for events endpoint
      for (let i = 0; i < 10; i++) {
        await service.incrementUsage(tenantId, 'events', 'free');
      }
      
      const eventsResult = await service.checkLimit(tenantId, 'events', 'free');
      const queriesResult = await service.checkLimit(tenantId, 'queries', 'free');
      
      // Queries endpoint should have full quota available
      expect(queriesResult.remaining).toBe(100); // Full queries limit
      expect(eventsResult.remaining).toBeLessThan(1000); // Events limit reduced
    });
  });
});
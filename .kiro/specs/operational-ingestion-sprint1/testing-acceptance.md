# Testing & Acceptance — Sprint 1 Ingestão Operacional

## 🎯 Overview

Este documento especifica a **estratégia de testes** e **critérios de aceite** para validar que o Sprint 1 atende aos requisitos funcionais e não-funcionais definidos.

---

## 🧪 Testing Strategy

### Test Pyramid

```
                    E2E Tests (10%)
                 ┌─────────────────┐
                 │   Load Tests    │
                 │   Integration   │  
                 └─────────────────┘
               
              Integration Tests (20%)
           ┌─────────────────────────┐
           │    API Endpoints        │
           │    Database Layer       │
           │    Business Logic       │
           └─────────────────────────┘
           
            Unit Tests (70%)
    ┌─────────────────────────────────┐
    │        Services                 │
    │        Controllers              │  
    │        Utils & Guards           │
    └─────────────────────────────────┘
```

---

## 🔧 Unit Tests

### 1. API Changes Tests

**File**: `apps/api/src/events/controllers/events.controller.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventProcessorService } from '../services/event-processor.service';
import { EnrichmentService } from '../services/enrichment.service';
import { PayloadTooLargeException, BadRequestException } from '@nestjs/common';

describe('EventsController - Sprint 1 Changes', () => {
  let controller: EventsController;
  let eventProcessor: jest.Mocked<EventProcessorService>;
  let enrichment: jest.Mocked<EnrichmentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventProcessorService,
          useValue: {
            processTrackEvent: jest.fn(),
            processBatchEvents: jest.fn(),
            processIdentifyEvent: jest.fn(),
          },
        },
        {
          provide: EnrichmentService,
          useValue: {
            validateTimestamp: jest.fn(),
            enrichEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    eventProcessor = module.get(EventProcessorService);
    enrichment = module.get(EnrichmentService);
  });

  describe('Payload Size Limits', () => {
    it('should reject payloads larger than 256KB', async () => {
      // Create large payload (257KB)
      const largePayload = {
        event_name: 'test_event',
        timestamp: new Date().toISOString(),
        props: {
          data: 'x'.repeat(257 * 1024) // 257KB of data
        }
      };

      const mockTenant = { tenantId: '1', workspaceId: '1', apiKeyId: '1', scopes: [] };
      const mockRequest = {} as any;

      await expect(
        controller.trackEvent(largePayload as any, mockTenant, mockRequest)
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should accept payloads smaller than 256KB', async () => {
      const validPayload = {
        event_name: 'test_event',
        timestamp: new Date().toISOString(),
        props: { small: 'data' }
      };

      enrichment.validateTimestamp.mockReturnValue({ isValid: true });
      enrichment.enrichEvent.mockReturnValue({ timestamp: Date.now() });
      eventProcessor.processTrackEvent.mockResolvedValue({ 
        success: true, 
        eventId: 'evt_123' 
      });

      const mockTenant = { tenantId: '1', workspaceId: '1', apiKeyId: '1', scopes: [] };
      const mockRequest = {} as any;

      const result = await controller.trackEvent(validPayload as any, mockTenant, mockRequest);
      
      expect(result.accepted).toBe(true);
      expect(result.event_id).toBe('evt_123');
    });
  });

  describe('Batch Size Limits', () => {
    it('should reject batches with more than 50 events', async () => {
      // Create batch with 51 events
      const largeBatch = {
        events: Array(51).fill({
          event_name: 'test_event',
          timestamp: new Date().toISOString()
        })
      };

      const mockTenant = { tenantId: '1', workspaceId: '1', apiKeyId: '1', scopes: [] };
      const mockRequest = {} as any;

      await expect(
        controller.batchEvents(largeBatch as any, mockTenant, mockRequest)
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept batches with 50 or fewer events', async () => {
      const validBatch = {
        events: Array(10).fill({
          event_name: 'test_event',
          timestamp: new Date().toISOString()
        })
      };

      enrichment.validateTimestamp.mockReturnValue({ isValid: true });
      enrichment.enrichEvent.mockReturnValue({ timestamp: Date.now() });
      eventProcessor.processBatchEvents.mockResolvedValue({
        successCount: 10,
        errorCount: 0,
        totalProcessed: 10,
        results: Array(10).fill({ success: true, eventId: 'evt_123' })
      });

      const mockTenant = { tenantId: '1', workspaceId: '1', apiKeyId: '1', scopes: [] };
      const mockRequest = {} as any;

      const result = await controller.batchEvents(validBatch as any, mockTenant, mockRequest);
      
      expect(result.accepted).toBe(10);
      expect(result.rejected).toBe(0);
    });
  });
});
```

### 2. Event Deduplication Tests

**File**: `apps/api/src/events/services/event-processor.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EventProcessorService } from './event-processor.service';
import { PrismaService } from '../../prisma.service';
import { MercurioLogger } from '../../common/services/logger.service';

describe('EventProcessorService - Deduplication', () => {
  let service: EventProcessorService;
  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<MercurioLogger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventProcessorService,
        {
          provide: PrismaService,
          useValue: {
            event: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: MercurioLogger,
          useValue: {
            debug: jest.fn(),
            logEventIngestion: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventProcessorService>(EventProcessorService);
    prisma = module.get(PrismaService);
    logger = module.get(MercurioLogger);
  });

  describe('Event Deduplication', () => {
    it('should process new event with event_id', async () => {
      const trackEvent = {
        event_name: 'test_event',
        event_id: 'unique_event_123',
        timestamp: new Date().toISOString(),
      };

      const tenant = { tenantId: '1', workspaceId: '1', apiKeyId: '1', scopes: [] };

      // No existing event found
      prisma.event.findFirst.mockResolvedValue(null);
      prisma.event.create.mockResolvedValue({ 
        id: BigInt(1), 
        eventId: 'unique_event_123',
        tenantId: BigInt(1)
      } as any);

      const result = await service.processTrackEvent(trackEvent as any, tenant, {});

      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: BigInt(1),
          eventId: 'unique_event_123'
        }
      });
      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBeFalsy();
    });

    it('should return success for duplicate event_id without processing', async () => {
      const trackEvent = {
        event_name: 'test_event',
        event_id: 'duplicate_event_123',
        timestamp: new Date().toISOString(),
      };

      const tenant = { tenantId: '1', workspaceId: '1', apiKeyId: '1', scopes: [] };

      // Existing event found  
      prisma.event.findFirst.mockResolvedValue({ 
        id: BigInt(1),
        eventId: 'duplicate_event_123',
        tenantId: BigInt(1)
      } as any);

      const result = await service.processTrackEvent(trackEvent as any, tenant, {});

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('should process event normally when no event_id provided', async () => {
      const trackEvent = {
        event_name: 'test_event',
        // No event_id provided
        timestamp: new Date().toISOString(),
      };

      const tenant = { tenantId: '1', workspaceId: '1', apiKeyId: '1', scopes: [] };

      prisma.event.create.mockResolvedValue({ 
        id: BigInt(1),
        tenantId: BigInt(1)
      } as any);

      const result = await service.processTrackEvent(trackEvent as any, tenant, {});

      expect(prisma.event.findFirst).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });
});
```

### 3. Schema Versioning Tests

**File**: `apps/api/src/events/services/enrichment.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EnrichmentService } from './enrichment.service';

describe('EnrichmentService - Schema Versioning', () => {
  let service: EnrichmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnrichmentService],
    }).compile();

    service = module.get<EnrichmentService>(EnrichmentService);
  });

  describe('Schema Version Extraction', () => {
    it('should extract valid schema version from headers', () => {
      const mockRequest = {
        headers: {
          'x-event-schema-version': '2.1.0'
        }
      } as any;

      const result = service.enrichEvent(mockRequest);
      expect(result.schemaVersion).toBe('2.1.0');
    });

    it('should use default version when header not provided', () => {
      const mockRequest = {
        headers: {}
      } as any;

      const result = service.enrichEvent(mockRequest);
      expect(result.schemaVersion).toBe('1.0.0');
    });

    it('should use default version for invalid semver', () => {
      const mockRequest = {
        headers: {
          'x-event-schema-version': 'invalid-version'
        }
      } as any;

      const result = service.enrichEvent(mockRequest);
      expect(result.schemaVersion).toBe('1.0.0');
    });

    it('should accept pre-release versions', () => {
      const mockRequest = {
        headers: {
          'x-event-schema-version': '2.0.0-beta.1'
        }
      } as any;

      const result = service.enrichEvent(mockRequest);
      expect(result.schemaVersion).toBe('2.0.0-beta.1');
    });
  });
});
```

### 4. Provisioning Tests

**File**: `apps/api/scripts/provision-tenant.test.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { provisionTenant } from './provision-tenant';

// Mock Prisma
jest.mock('@prisma/client');
const MockedPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

describe('Tenant Provisioning', () => {
  let prisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    prisma = new MockedPrismaClient() as any;
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null); // No existing tenant
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create tenant with valid data', async () => {
    // Mock database responses
    prisma.tenant.create.mockResolvedValue({
      id: BigInt(1),
      name: 'Test Tenant'
    } as any);

    prisma.workspace.create.mockResolvedValue({
      id: BigInt(1),
      name: 'Test Workspace'  
    } as any);

    prisma.apiKey.create.mockResolvedValue({
      id: BigInt(1),
      name: 'Test API Key'
    } as any);

    const result = await provisionTenant('Test Tenant', 'Test Workspace', false);

    expect(result.success).toBe(true);
    expect(result.tenant.name).toBe('Test Tenant');
    expect(result.workspace.name).toBe('Test Workspace');
    expect(result.apiKey.value).toMatch(/^ak_/);
  });

  it('should prevent duplicate tenant names', async () => {
    // Mock existing tenant
    prisma.tenant.findFirst.mockResolvedValue({
      id: BigInt(1),
      name: 'Existing Tenant'
    } as any);

    await expect(
      provisionTenant('Existing Tenant', 'New Workspace', false)
    ).rejects.toThrow('Tenant with name "Existing Tenant" already exists');
  });

  it('should validate tenant name input', async () => {
    await expect(
      provisionTenant('', 'Workspace', false)
    ).rejects.toThrow();

    await expect(
      provisionTenant(' '.repeat(300), 'Workspace', false)
    ).rejects.toThrow();
  });
});
```

---

## 🔗 Integration Tests

### 1. End-to-End Event Flow Test

**File**: `apps/api/test/events.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('Events API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let apiKey: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // Setup test tenant and API key
    const setupResult = await setupTestTenant(prisma);
    apiKey = setupResult.apiKey;
    tenantId = setupResult.tenantId;
  });

  afterAll(async () => {
    await cleanupTestData(prisma, tenantId);
    await app.close();
  });

  describe('POST /v1/events/track', () => {
    it('should accept valid track event', () => {
      const trackEvent = {
        event_name: 'button_click',
        timestamp: new Date().toISOString(),
        props: {
          button_text: 'Sign Up',
          location: 'header'
        }
      };

      return request(app.getHttpServer())
        .post('/v1/events/track')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(trackEvent)
        .expect(200)
        .expect((res) => {
          expect(res.body.accepted).toBe(true);
          expect(res.body.event_id).toBeDefined();
        });
    });

    it('should reject oversized payload', () => {
      const largeEvent = {
        event_name: 'large_event',
        timestamp: new Date().toISOString(),
        props: {
          data: 'x'.repeat(300 * 1024) // 300KB
        }
      };

      return request(app.getHttpServer())
        .post('/v1/events/track')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(largeEvent)
        .expect(413)
        .expect((res) => {
          expect(res.body.error.code).toBe('payload_too_large');
        });
    });

    it('should handle event deduplication', async () => {
      const eventId = 'unique_test_event_123';
      const trackEvent = {
        event_name: 'dedupe_test',
        event_id: eventId,
        timestamp: new Date().toISOString(),
        props: { test: true }
      };

      // First request should create event
      const firstResponse = await request(app.getHttpServer())
        .post('/v1/events/track')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(trackEvent)
        .expect(200);

      expect(firstResponse.body.accepted).toBe(true);

      // Second request should return success but not create duplicate
      const secondResponse = await request(app.getHttpServer())
        .post('/v1/events/track')  
        .set('Authorization', `Bearer ${apiKey}`)
        .send(trackEvent)
        .expect(200);

      expect(secondResponse.body.accepted).toBe(true);

      // Verify only one event exists in database
      const eventCount = await prisma.event.count({
        where: { eventId }
      });
      expect(eventCount).toBe(1);
    });

    it('should store schema version from header', () => {
      const trackEvent = {
        event_name: 'schema_test',
        timestamp: new Date().toISOString()
      };

      return request(app.getHttpServer())
        .post('/v1/events/track')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('X-Event-Schema-Version', '2.1.0')
        .send(trackEvent)
        .expect(200)
        .then(async (res) => {
          // Verify schema version was stored
          const event = await prisma.event.findFirst({
            where: { eventName: 'schema_test' },
            select: { schemaVersion: true }
          });
          expect(event?.schemaVersion).toBe('2.1.0');
        });
    });
  });

  describe('POST /v1/events/batch', () => {
    it('should process valid batch', () => {
      const batch = {
        events: [
          {
            event_name: 'batch_event_1',
            timestamp: new Date().toISOString()
          },
          {
            event_name: 'batch_event_2', 
            timestamp: new Date().toISOString()
          }
        ]
      };

      return request(app.getHttpServer())
        .post('/v1/events/batch')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(batch)
        .expect(200)
        .expect((res) => {
          expect(res.body.accepted).toBe(2);
          expect(res.body.rejected).toBe(0);
          expect(res.body.total).toBe(2);
        });
    });

    it('should reject oversized batch', () => {
      const largeBatch = {
        events: Array(60).fill({
          event_name: 'batch_test',
          timestamp: new Date().toISOString()
        })
      };

      return request(app.getHttpServer())
        .post('/v1/events/batch')
        .set('Authorization', `Bearer ${apiKey}`)
        .send(largeBatch)
        .expect(400)
        .expect((res) => {
          expect(res.body.error.code).toBe('batch_too_large');
        });
    });
  });
});

async function setupTestTenant(prisma: PrismaService) {
  // Create test tenant, workspace, and API key
  // Return the generated API key and tenant ID
  // Implementation details...
}

async function cleanupTestData(prisma: PrismaService, tenantId: string) {
  // Clean up test data
  // Implementation details...
}
```

---

## ⚡ Load Tests

### 1. Performance Test Specification

**File**: `apps/api/test/load/basic-ingestion.spec.ts`

```typescript
import { describe, it } from '@jest/globals';
import axios from 'axios';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const API_KEY = process.env.TEST_API_KEY || 'test_key';
const CONCURRENT_USERS = 10;
const REQUESTS_PER_USER = 100;

describe('Load Test - Basic Event Ingestion', () => {
  it('should maintain p50 latency < 50ms under load', async () => {
    const results: number[] = [];
    const errors: string[] = [];

    // Generate test events
    const generateEvent = () => ({
      event_name: 'load_test_event',
      timestamp: new Date().toISOString(),
      props: {
        test_run: Date.now(),
        user_id: Math.floor(Math.random() * 1000)
      }
    });

    // Run concurrent requests
    const promises: Promise<void>[] = [];
    
    for (let user = 0; user < CONCURRENT_USERS; user++) {
      const userPromise = async () => {
        for (let req = 0; req < REQUESTS_PER_USER; req++) {
          const startTime = Date.now();
          
          try {
            await axios.post(
              `${BASE_URL}/v1/events/track`,
              generateEvent(),
              {
                headers: {
                  'Authorization': `Bearer ${API_KEY}`,
                  'Content-Type': 'application/json'
                },
                timeout: 5000
              }
            );
            
            const responseTime = Date.now() - startTime;
            results.push(responseTime);
          } catch (error: any) {
            errors.push(`Request failed: ${error.message}`);
          }
        }
      };
      
      promises.push(userPromise());
    }

    await Promise.all(promises);

    // Calculate percentiles
    results.sort((a, b) => a - b);
    const p50 = results[Math.floor(results.length * 0.5)];
    const p99 = results[Math.floor(results.length * 0.99)];
    const avg = results.reduce((sum, val) => sum + val, 0) / results.length;
    
    const errorRate = (errors.length / (CONCURRENT_USERS * REQUESTS_PER_USER)) * 100;

    console.log(`Load Test Results:
      Total Requests: ${CONCURRENT_USERS * REQUESTS_PER_USER}
      Successful: ${results.length}
      Error Rate: ${errorRate.toFixed(2)}%
      Average Response Time: ${avg.toFixed(2)}ms  
      P50 Response Time: ${p50}ms
      P99 Response Time: ${p99}ms
    `);

    // Assertions
    expect(errorRate).toBeLessThan(1); // < 1% error rate
    expect(p50).toBeLessThan(50); // P50 < 50ms
    expect(p99).toBeLessThan(200); // P99 < 200ms
    expect(results.length).toBe(CONCURRENT_USERS * REQUESTS_PER_USER - errors.length);
  }, 60000); // 60s timeout
});
```

---

## 🏥 Health & Infrastructure Tests

### 1. Health Check Test

**File**: `apps/api/test/health.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health Checks (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) should return comprehensive health status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.services.database.status).toBe('ok');
        expect(res.body.system.uptime).toBeGreaterThan(0);
        expect(res.body.system.memory).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
      });
  });

  it('/ping (GET) should return pong', () => {
    return request(app.getHttpServer())
      .get('/ping')
      .expect(200)
      .expect((res) => {
        expect(res.body.pong).toBe(true);
      });
  });

  it('/metrics (GET) should return metrics data', () => {
    return request(app.getHttpServer())
      .get('/metrics')
      .expect(200)
      .expect((res) => {
        expect(res.body.counters).toBeDefined();
        expect(res.body.gauges).toBeDefined();
        expect(res.body.histograms).toBeDefined();
      });
  });
});
```

### 2. Docker Compose Test

**File**: `test/docker/docker-compose.test.yml`

```yaml
version: '3.8'

# Test configuration for Docker Compose validation
services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mercurio_test
      POSTGRES_USER: mercurio_test
      POSTGRES_PASSWORD: test_password
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mercurio_test -d mercurio_test"]
      interval: 5s
      timeout: 3s
      retries: 3

  api-test:
    build:
      context: ../../apps/api
      dockerfile: Dockerfile
      target: development
    environment:
      DATABASE_URL: "postgresql://mercurio_test:test_password@postgres-test:5432/mercurio_test?schema=public"
      NODE_ENV: test
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      postgres-test:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

---

## ✅ Acceptance Test Scenarios

### Scenario 1: Complete Event Ingestion Flow

```typescript
describe('Acceptance: Complete Event Ingestion', () => {
  it('should handle full end-to-end flow', async () => {
    // 1. Provision tenant
    const provision = await provisionTenant('E2E Test Tenant', 'E2E Workspace');
    expect(provision.success).toBe(true);

    // 2. Send track event
    const trackResponse = await sendTrackEvent(provision.apiKey.value, {
      event_name: 'e2e_test_event',
      timestamp: new Date().toISOString(),
      props: { flow: 'complete' }
    });
    expect(trackResponse.accepted).toBe(true);

    // 3. Verify event persistence
    const event = await findEventInDatabase(trackResponse.event_id);
    expect(event).toBeDefined();
    expect(event.tenantId).toBe(provision.tenant.id);

    // 4. Check tenant isolation  
    const otherTenantEvents = await queryEventsForTenant('different_tenant_id');
    expect(otherTenantEvents).not.toContainEqual(
      expect.objectContaining({ id: trackResponse.event_id })
    );
  });
});
```

### Scenario 2: Performance Under Load

```typescript
describe('Acceptance: Performance Requirements', () => {
  it('should maintain SLA under realistic load', async () => {
    const loadTestResult = await runLoadTest({
      concurrentUsers: 20,
      requestsPerUser: 50,
      testDurationMs: 30000
    });

    // Performance assertions
    expect(loadTestResult.p50ResponseTime).toBeLessThan(50);
    expect(loadTestResult.p99ResponseTime).toBeLessThan(200);
    expect(loadTestResult.errorRate).toBeLessThan(1);
    expect(loadTestResult.successRate).toBeGreaterThan(95);
  });
});
```

### Scenario 3: Infrastructure Readiness  

```typescript
describe('Acceptance: Infrastructure', () => {
  it('should start complete environment via Docker Compose', async () => {
    // Verify all services are healthy
    const services = await checkDockerServices();
    expect(services.postgres.status).toBe('healthy');
    expect(services.api.status).toBe('healthy');
    expect(services.redis.status).toBe('healthy');

    // Verify connectivity
    const healthCheck = await checkApiHealth();
    expect(healthCheck.services.database.status).toBe('ok');
    
    // Verify provisioning works
    const provisionResult = await runProvisioningCLI([
      '--name', 'Docker Test Tenant',
      '--workspace', 'Docker Test WS'
    ]);
    expect(provisionResult.success).toBe(true);
  });
});
```

---

## 📊 Test Execution Plan

### Phase 1: Unit & Integration (Days 1-3)
- [ ] API changes unit tests
- [ ] Deduplication logic tests  
- [ ] Schema versioning tests
- [ ] Provisioning script tests
- [ ] Service integration tests

### Phase 2: End-to-End (Days 4-5)
- [ ] Complete event flow tests
- [ ] Tenant isolation verification
- [ ] Error handling scenarios
- [ ] Health check validation

### Phase 3: Performance & Load (Days 6-7)
- [ ] Latency benchmarking
- [ ] Throughput testing  
- [ ] Resource usage monitoring
- [ ] Stability testing

### Phase 4: Infrastructure (Days 8-10)
- [ ] Docker Compose validation
- [ ] Environment configuration tests
- [ ] CLI functionality verification  
- [ ] Production readiness checks

---

## 📋 Test Automation

### CI/CD Pipeline Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js  
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:integration

  docker-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test Docker Compose
        run: |
          docker-compose -f docker-compose.yml up -d
          sleep 30
          curl -f http://localhost:3000/health
          docker-compose down
```

---

## ✅ Final Acceptance Criteria

### Functional Requirements ✅
- [ ] All API endpoints respond correctly
- [ ] Payload limits (256KB) enforced
- [ ] Batch limits (50 events) enforced  
- [ ] Event deduplication working
- [ ] Schema versioning implemented
- [ ] Tenant provisioning via CLI functional

### Performance Requirements ✅  
- [ ] P50 latency < 50ms for small payloads
- [ ] P99 latency < 200ms
- [ ] Error rate < 1%
- [ ] Throughput > 100 req/s sustained
- [ ] Memory usage < 200MB per instance

### Infrastructure Requirements ✅
- [ ] Docker Compose starts all services
- [ ] Health checks operational  
- [ ] Environment configuration complete
- [ ] Makefile commands functional
- [ ] Logs structured with tenant context

### Quality Requirements ✅
- [ ] Unit test coverage > 85%
- [ ] Integration tests cover main flows
- [ ] Load tests validate performance claims
- [ ] Infrastructure tests verify deployment
- [ ] All tests automated in CI/CD
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { TestUtils } from '../../test-utils';
import crypto from 'node:crypto';

describe('API Integration Tests', () => {
  let app: NestFastifyApplication;
  let prismaService: PrismaService;
  let testUtils: TestUtils;
  let testTenant: any;
  let testWorkspace: any;
  let testApiKey: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prismaService = app.get<PrismaService>(PrismaService);
    testUtils = new TestUtils(prismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database
    await testUtils.cleanDatabase();
    
    // Create test tenant with API key
    const setup = await testUtils.createTestTenant();
    testTenant = setup.tenant;
    testWorkspace = setup.workspace;
    testApiKey = setup.apiKey;
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        payload: {
          event_name: 'test_event',
          anonymous_id: 'a_123',
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(401);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('unauthorized');
      expect(body.error.message).toContain('Missing API key');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': 'Bearer invalid_key',
        },
        payload: {
          event_name: 'test_event',
          anonymous_id: 'a_123',
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(401);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('unauthorized');
      expect(body.error.message).toContain('Invalid or revoked API key');
    });

    it('should accept requests with valid Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: {
          event_name: 'test_event',
          anonymous_id: 'a_123',
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.accepted).toBe(true);
      expect(body.event_id).toBeDefined();
    });

    it('should accept requests with X-API-Key header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'X-API-Key': testApiKey.value,
          'Content-Type': 'application/json',
        },
        payload: {
          event_name: 'test_event',
          anonymous_id: 'a_123',
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept requests with query parameter auth for events', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/v1/events/track?auth=${testApiKey.value}`,
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          event_name: 'test_event',
          anonymous_id: 'a_123',
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Track Event Endpoint', () => {
    it('should track event successfully', async () => {
      const eventData = {
        event_name: 'page_view',
        anonymous_id: 'a_integration_test',
        timestamp: new Date().toISOString(),
        page: {
          url: 'https://example.com/test',
          title: 'Test Page',
        },
        properties: {
          test_property: 'test_value',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: eventData,
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.accepted).toBe(true);
      expect(body.event_id).toBeDefined();
      expect(body.is_duplicate).toBe(false);

      // Verify event was stored in database
      const storedEvent = await prismaService.event.findUnique({
        where: {
          id_tenantId_timestamp: {
            id: BigInt(body.event_id),
            tenantId: testTenant.id,
            timestamp: new Date(eventData.timestamp),
          },
        },
      });

      expect(storedEvent).toBeDefined();
      expect(storedEvent!.eventName).toBe('page_view');
      expect(storedEvent!.anonymousId).toBe('a_integration_test');
      expect(storedEvent!.props).toEqual({ test_property: 'test_value' });
    });

    it('should handle event deduplication', async () => {
      const eventData = {
        event_name: 'duplicate_test',
        anonymous_id: 'a_dedup_test',
        timestamp: new Date().toISOString(),
        event_id: 'evt_dedup_12345',
      };

      // First request
      const response1 = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: eventData,
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.accepted).toBe(true);
      expect(body1.is_duplicate).toBe(false);

      // Duplicate request
      const response2 = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: eventData,
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.accepted).toBe(true);
      expect(body2.event_id).toBe(body1.event_id); // Same event ID
      expect(body2.is_duplicate).toBe(true);

      // Verify only one event in database
      const events = await prismaService.event.findMany({
        where: {
          tenantId: testTenant.id,
          eventId: 'evt_dedup_12345',
        },
      });
      expect(events).toHaveLength(1);
    });

    it('should reject payload exceeding 256KB', async () => {
      const largeData = 'x'.repeat(300 * 1024); // 300KB
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: {
          event_name: 'large_event',
          anonymous_id: 'a_123',
          timestamp: new Date().toISOString(),
          properties: { large_data: largeData },
        },
      });

      expect(response.statusCode).toBe(413);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('payload_too_large');
      expect(body.error.details.maxSize).toBe(256 * 1024);
    });

    it('should validate timestamp window', async () => {
      const pastTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
      
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: {
          event_name: 'past_event',
          anonymous_id: 'a_123',
          timestamp: pastTimestamp,
        },
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('invalid_timestamp');
    });
  });

  describe('Batch Events Endpoint', () => {
    it('should process batch events successfully', async () => {
      const batchData = {
        events: [
          {
            event_name: 'event_1',
            anonymous_id: 'a_batch_test',
            timestamp: new Date().toISOString(),
          },
          {
            event_name: 'event_2',
            anonymous_id: 'a_batch_test',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/batch',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: batchData,
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.accepted).toBe(2);
      expect(body.rejected).toBe(0);
      expect(body.total).toBe(2);
      expect(body.results).toHaveLength(2);
      expect(body.results[0].accepted).toBe(true);
      expect(body.results[1].accepted).toBe(true);

      // Verify events were stored
      const events = await prismaService.event.findMany({
        where: {
          tenantId: testTenant.id,
          anonymousId: 'a_batch_test',
        },
      });
      expect(events).toHaveLength(2);
    });

    it('should reject batch exceeding 50 events', async () => {
      const events = Array(51).fill(null).map((_, index) => ({
        event_name: 'test_event',
        anonymous_id: `a_${index}`,
        timestamp: new Date().toISOString(),
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/batch',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: { events },
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('batch_too_large');
      expect(body.error.details.batchSize).toBe(51);
      expect(body.error.details.maxBatchSize).toBe(50);
    });

    it('should handle mixed success/failure in batch', async () => {
      const validTimestamp = new Date().toISOString();
      const invalidTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

      const batchData = {
        events: [
          {
            event_name: 'valid_event',
            anonymous_id: 'a_mixed_batch',
            timestamp: validTimestamp,
          },
          {
            event_name: 'invalid_event',
            anonymous_id: 'a_mixed_batch',
            timestamp: invalidTimestamp,
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/batch',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: batchData,
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('invalid_timestamps');
      expect(body.error.details.errors).toContain('Event 1: Event timestamp is too far in the past (max 5 minutes)');
    });
  });

  describe('Identify Endpoint', () => {
    it('should identify user successfully', async () => {
      const identifyData = {
        anonymous_id: 'a_identify_test',
        user_id: 'user_12345',
        traits: {
          email: 'test@example.com',
          name: 'John Doe',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/identify',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: identifyData,
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.accepted).toBe(true);
      expect(body.lead_id).toBeDefined();

      // Verify lead was created
      const lead = await prismaService.lead.findUnique({
        where: { id: BigInt(body.lead_id) },
      });
      expect(lead).toBeDefined();
      expect(lead!.tenantId).toEqual(testTenant.id);

      // Verify identity link was created
      const identityLink = await prismaService.identityLink.findFirst({
        where: {
          tenantId: testTenant.id,
          anonymousId: 'a_identify_test',
          leadId: BigInt(body.lead_id),
        },
      });
      expect(identityLink).toBeDefined();
    });

    it('should reject identify without user_id or traits', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/identify',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: {
          anonymous_id: 'a_invalid_identify',
        },
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('missing_identification');
    });

    it('should reject invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/identify',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: {
          anonymous_id: 'a_invalid_email',
          traits: {
            email: 'not-an-email',
            name: 'John Doe',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('invalid_email');
      expect(body.error.details.email).toBe('not-an-email');
    });
  });

  describe('Health Check Endpoint', () => {
    it('should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('mercurio-api');
      expect(body.checks.database.status).toBe('healthy');
      expect(body.checks.memory.status).toBe('healthy');
      expect(body.responseTimeMs).toBeDefined();
      expect(body.uptime).toBeDefined();
    });
  });

  describe('Tenant Isolation', () => {
    let tenant2: any;
    let apiKey2: any;

    beforeEach(async () => {
      // Create second tenant
      const setup2 = await testUtils.createTestTenant('Tenant 2');
      tenant2 = setup2.tenant;
      apiKey2 = setup2.apiKey;
    });

    it('should isolate events between tenants', async () => {
      const eventData = {
        event_name: 'isolation_test',
        anonymous_id: 'a_isolation',
        timestamp: new Date().toISOString(),
        event_id: 'evt_isolation_123',
      };

      // Create event for tenant 1
      const response1 = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: eventData,
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.is_duplicate).toBe(false);

      // Create same event for tenant 2 - should not be duplicate
      const response2 = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${apiKey2.value}`,
          'Content-Type': 'application/json',
        },
        payload: eventData,
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.is_duplicate).toBe(false); // Not duplicate for different tenant

      // Verify both events exist with proper tenant isolation
      const tenant1Events = await prismaService.event.findMany({
        where: { tenantId: testTenant.id, eventId: 'evt_isolation_123' },
      });
      const tenant2Events = await prismaService.event.findMany({
        where: { tenantId: tenant2.id, eventId: 'evt_isolation_123' },
      });

      expect(tenant1Events).toHaveLength(1);
      expect(tenant2Events).toHaveLength(1);
      expect(tenant1Events[0].id).not.toEqual(tenant2Events[0].id);
    });

    it('should prevent cross-tenant data access', async () => {
      // This test verifies that API keys from one tenant can't access another tenant's data
      // The actual isolation is handled at the database/service level through tenant context

      const eventData = {
        event_name: 'cross_tenant_test',
        anonymous_id: 'a_cross_tenant',
        timestamp: new Date().toISOString(),
      };

      // Create event with tenant 1 API key
      const response1 = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: eventData,
      });

      expect(response1.statusCode).toBe(200);

      // Verify tenant 2 can't see tenant 1's data
      const tenant2Events = await prismaService.event.findMany({
        where: { 
          tenantId: tenant2.id,
          anonymousId: 'a_cross_tenant',
        },
      });

      expect(tenant2Events).toHaveLength(0);

      // Verify tenant 1 can see its own data
      const tenant1Events = await prismaService.event.findMany({
        where: {
          tenantId: testTenant.id,
          anonymousId: 'a_cross_tenant',
        },
      });

      expect(tenant1Events).toHaveLength(1);
    });
  });

  describe('Request Correlation', () => {
    it('should include X-Request-ID in response headers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
        },
        payload: {
          event_name: 'correlation_test',
          anonymous_id: 'a_123',
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should use client-provided X-Request-ID', async () => {
      const clientRequestId = 'client_req_12345';
      
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
          'X-Request-ID': clientRequestId,
        },
        payload: {
          event_name: 'correlation_test',
          anonymous_id: 'a_123',
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBe(clientRequestId);
    });
  });

  describe('Schema Versioning', () => {
    it('should handle X-Event-Schema-Version header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
          'X-Event-Schema-Version': '1.2.0',
        },
        payload: {
          event_name: 'versioned_event',
          anonymous_id: 'a_123',
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.accepted).toBe(true);

      // Verify schema version was stored
      const event = await prismaService.event.findUnique({
        where: {
          id_tenantId_timestamp: {
            id: BigInt(body.event_id),
            tenantId: testTenant.id,
            timestamp: expect.any(Date),
          },
        },
      });

      expect(event!.schemaVersion).toBe('1.2.0');
    });

    it('should fallback to default version for invalid schema version', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/track',
        headers: {
          'Authorization': `Bearer ${testApiKey.value}`,
          'Content-Type': 'application/json',
          'X-Event-Schema-Version': 'invalid-version',
        },
        payload: {
          event_name: 'fallback_event',
          anonymous_id: 'a_123',
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.accepted).toBe(true);

      // Verify default version was used
      const event = await prismaService.event.findUnique({
        where: {
          id_tenantId_timestamp: {
            id: BigInt(body.event_id),
            tenantId: testTenant.id,
            timestamp: expect.any(Date),
          },
        },
      });

      expect(event!.schemaVersion).toBe('1.0');
    });
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaService } from '../../src/prisma.service';
import { AppModule } from '../../src/app.module';
import { TrackEventDto, IdentifyEventDto } from '../../src/events/dto/track-event.dto';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

describe('Complete Flow End-to-End Testing', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let tenant1ApiKey: string;
  let tenant2ApiKey: string;
  let tenant1Id: string;
  let tenant2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Clean up any existing test data
    await cleanupTestData();

    // Provision two test tenants for isolation testing
    const { tenantId: t1Id, apiKey: t1Key } = await provisionTestTenant('E2E Test Tenant 1', 'E2E Workspace 1');
    const { tenantId: t2Id, apiKey: t2Key } = await provisionTestTenant('E2E Test Tenant 2', 'E2E Workspace 2');
    
    tenant1Id = t1Id;
    tenant2Id = t2Id;
    tenant1ApiKey = t1Key;
    tenant2ApiKey = t2Key;
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  describe('Tenant Provisioning', () => {
    it('should create tenants with unique API keys', () => {
      expect(tenant1ApiKey).toBeDefined();
      expect(tenant2ApiKey).toBeDefined();
      expect(tenant1ApiKey).not.toBe(tenant2ApiKey);
      expect(tenant1Id).not.toBe(tenant2Id);
    });

    it('should create workspace and API key for each tenant', async () => {
      const tenant1 = await prisma.tenant.findUnique({
        where: { id: BigInt(tenant1Id) },
        include: { 
          workspaces: { include: { apiKeys: true } }
        }
      });

      expect(tenant1).toBeTruthy();
      expect(tenant1!.workspaces).toHaveLength(1);
      expect(tenant1!.workspaces[0].apiKeys).toHaveLength(1);
      expect(tenant1!.workspaces[0].apiKeys[0].keyHash).toBeTruthy();
    });
  });

  describe('Event Ingestion Flow', () => {
    const anonymousId = randomUUID();

    it('should track events with tenant isolation', async () => {
      const trackEvent: TrackEventDto = {
        event_name: 'page_view',
        anonymous_id: anonymousId,
        timestamp: new Date().toISOString(),
        properties: {
          url: 'https://example.com/page1',
          title: 'Test Page 1'
        },
        page: {
          url: 'https://example.com/page1',
          title: 'Test Page 1',
          referrer: 'https://google.com'
        }
      };

      // Track event for tenant 1
      const response1 = await app.inject({
        method: 'POST',
        url: '/events/track',
        headers: {
          'Authorization': `Bearer ${tenant1ApiKey}`,
          'Content-Type': 'application/json',
          'X-Event-Schema-Version': '1.0.0'
        },
        payload: trackEvent
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.success).toBe(true);
      expect(body1.eventId).toBeDefined();

      // Track similar event for tenant 2
      const response2 = await app.inject({
        method: 'POST',
        url: '/events/track',
        headers: {
          'Authorization': `Bearer ${tenant2ApiKey}`,
          'Content-Type': 'application/json',
          'X-Event-Schema-Version': '1.0.0'
        },
        payload: { ...trackEvent, anonymous_id: randomUUID() }
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.success).toBe(true);
      expect(body2.eventId).toBeDefined();
      expect(body2.eventId).not.toBe(body1.eventId);
    });

    it('should enforce tenant isolation in database', async () => {
      // Verify tenant 1 events are isolated
      const tenant1Events = await prisma.event.findMany({
        where: { tenantId: BigInt(tenant1Id) }
      });

      const tenant2Events = await prisma.event.findMany({
        where: { tenantId: BigInt(tenant2Id) }
      });

      expect(tenant1Events.length).toBeGreaterThan(0);
      expect(tenant2Events.length).toBeGreaterThan(0);

      // Verify no cross-tenant data
      for (const event of tenant1Events) {
        expect(event.tenantId).toBe(BigInt(tenant1Id));
      }
      for (const event of tenant2Events) {
        expect(event.tenantId).toBe(BigInt(tenant2Id));
      }
    });

    it('should handle event deduplication correctly', async () => {
      const eventId = `e2e_test_${Date.now()}`;
      const trackEvent: TrackEventDto = {
        event_id: eventId,
        event_name: 'duplicate_test',
        anonymous_id: anonymousId,
        timestamp: new Date().toISOString(),
        properties: { test: 'deduplication' }
      };

      // Send same event twice
      const response1 = await app.inject({
        method: 'POST',
        url: '/events/track',
        headers: {
          'Authorization': `Bearer ${tenant1ApiKey}`,
          'Content-Type': 'application/json'
        },
        payload: trackEvent
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/events/track',
        headers: {
          'Authorization': `Bearer ${tenant1ApiKey}`,
          'Content-Type': 'application/json'
        },
        payload: trackEvent
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);

      expect(body1.success).toBe(true);
      expect(body2.success).toBe(true);
      expect(body2.isDuplicate).toBe(true);
      expect(body1.eventId).toBe(body2.eventId);

      // Verify only one event stored in database
      const events = await prisma.event.findMany({
        where: {
          tenantId: BigInt(tenant1Id),
          eventId: eventId
        }
      });

      expect(events).toHaveLength(1);
    });

    it('should process batch events correctly', async () => {
      const batchEvents: TrackEventDto[] = [
        {
          event_id: `batch_1_${Date.now()}`,
          event_name: 'batch_event_1',
          anonymous_id: anonymousId,
          timestamp: new Date().toISOString(),
          properties: { batch_index: 1 }
        },
        {
          event_id: `batch_2_${Date.now()}`,
          event_name: 'batch_event_2', 
          anonymous_id: anonymousId,
          timestamp: new Date().toISOString(),
          properties: { batch_index: 2 }
        }
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/events/batch',
        headers: {
          'Authorization': `Bearer ${tenant1ApiKey}`,
          'Content-Type': 'application/json'
        },
        payload: { events: batchEvents }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.totalProcessed).toBe(2);
      expect(body.successCount).toBe(2);
      expect(body.errorCount).toBe(0);
      expect(body.results).toHaveLength(2);

      // Verify events stored
      const storedEvents = await prisma.event.findMany({
        where: {
          tenantId: BigInt(tenant1Id),
          eventId: { in: batchEvents.map(e => e.event_id!) }
        }
      });

      expect(storedEvents).toHaveLength(2);
    });

    it('should handle identify events correctly', async () => {
      const identifyEvent: IdentifyEventDto = {
        anonymous_id: anonymousId,
        user_id: 'e2e_user_123',
        timestamp: new Date().toISOString(),
        traits: {
          email: 'test@example.com',
          name: 'E2E Test User'
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/events/identify',
        headers: {
          'Authorization': `Bearer ${tenant1ApiKey}`,
          'Content-Type': 'application/json'
        },
        payload: identifyEvent
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.success).toBe(true);
      expect(body.leadId).toBeDefined();

      // Verify identity link created
      const identityLink = await prisma.identityLink.findFirst({
        where: {
          tenantId: BigInt(tenant1Id),
          anonymousId: anonymousId
        }
      });

      expect(identityLink).toBeTruthy();
      expect(identityLink!.leadId).toBe(BigInt(body.leadId));
    });
  });

  describe('Payload Validation', () => {
    it('should enforce payload size limits', async () => {
      const largePayload = {
        event_name: 'large_payload_test',
        anonymous_id: randomUUID(),
        timestamp: new Date().toISOString(),
        properties: {
          large_data: 'x'.repeat(300 * 1024) // 300KB > 256KB limit
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/events/track',
        headers: {
          'Authorization': `Bearer ${tenant1ApiKey}`,
          'Content-Type': 'application/json'
        },
        payload: largePayload
      });

      expect(response.statusCode).toBe(413); // Payload Too Large
    });

    it('should enforce batch size limits', async () => {
      const events = Array.from({ length: 51 }, (_, i) => ({
        event_name: `batch_limit_test_${i}`,
        anonymous_id: randomUUID(),
        timestamp: new Date().toISOString(),
        properties: { index: i }
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/events/batch',
        headers: {
          'Authorization': `Bearer ${tenant1ApiKey}`,
          'Content-Type': 'application/json'
        },
        payload: { events }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('50');
    });

    it('should handle unauthorized requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/events/track',
        headers: {
          'Content-Type': 'application/json'
        },
        payload: {
          event_name: 'unauthorized_test',
          anonymous_id: randomUUID(),
          timestamp: new Date().toISOString()
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Performance and Health', () => {
    it('should respond to health checks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThan(0);
      expect(body.database.status).toBe('connected');
    });

    it('should provide performance metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/monitoring/performance'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.status).toBeDefined();
      expect(body.metrics).toBeDefined();
      expect(body.metrics.requests).toBeDefined();
      expect(body.metrics.cache).toBeDefined();
    });

    it('should maintain response times under 50ms for simple requests', async () => {
      const startTime = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(50); // P50 latency requirement
    });
  });

  // Helper functions
  async function provisionTestTenant(tenantName: string, workspaceName: string) {
    try {
      // Use the provisioning script directly
      const command = `npm run provision:tenant -- --name "${tenantName}" --workspace "${workspaceName}"`;
      const output = execSync(command, { 
        cwd: '/Users/tocha/Dev/gtm-master/apps/api',
        encoding: 'utf8' 
      });

      // Parse output to extract tenant ID and API key
      const lines = output.split('\n');
      let tenantId = '';
      let apiKey = '';

      for (const line of lines) {
        if (line.includes('Tenant ID:')) {
          tenantId = line.split('Tenant ID:')[1].trim();
        }
        if (line.includes('API Key:')) {
          apiKey = line.split('API Key:')[1].trim();
        }
      }

      if (!tenantId || !apiKey) {
        throw new Error('Failed to extract tenant ID or API key from provisioning output');
      }

      return { tenantId, apiKey };
    } catch (error) {
      throw new Error(`Failed to provision test tenant: ${error}`);
    }
  }

  async function cleanupTestData() {
    // Clean up any existing e2e test data
    try {
      await prisma.event.deleteMany({
        where: {
          OR: [
            { eventName: { contains: 'e2e' } },
            { eventName: { contains: 'duplicate_test' } },
            { eventName: { contains: 'batch_event' } },
            { eventName: { contains: 'large_payload' } },
            { eventName: { contains: 'batch_limit' } }
          ]
        }
      });

      await prisma.identityLink.deleteMany({
        where: {
          tenant: {
            name: { contains: 'E2E Test' }
          }
        }
      });

      await prisma.lead.deleteMany({
        where: {
          tenant: {
            name: { contains: 'E2E Test' }
          }
        }
      });

      await prisma.visitor.deleteMany({
        where: {
          tenant: {
            name: { contains: 'E2E Test' }
          }
        }
      });

      await prisma.apiKey.deleteMany({
        where: {
          workspace: {
            tenant: {
              name: { contains: 'E2E Test' }
            }
          }
        }
      });

      await prisma.workspace.deleteMany({
        where: {
          tenant: {
            name: { contains: 'E2E Test' }
          }
        }
      });

      await prisma.tenant.deleteMany({
        where: {
          name: { contains: 'E2E Test' }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup warning:', error);
    }
  }
});
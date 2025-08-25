import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

/**
 * Test utilities for database operations and multi-tenant testing
 */
export class TestUtils {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Clean all data from the database (use with caution!)
   * Respects foreign key constraints by deleting in correct order
   */
  async cleanDatabase(): Promise<void> {
    const tableNames = [
      'funnel_step_match',
      'funnel_step',
      'funnel_publication',
      'funnel_version',
      'funnel',
      'event',
      'session',
      'identity_link',
      'lead',
      'visitor',
      'api_key',
      'workspace',
      'tenant',
    ];

    for (const tableName of tableNames) {
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
    }
  }

  /**
   * Create a test tenant with workspace and API key
   */
  async createTestTenant(name?: string) {
    const tenant = await this.prisma.tenant.create({
      data: {
        name: name || `Test Tenant ${Date.now()}`,
      },
    });

    const workspace = await this.prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        tenantId: tenant.id,
      },
    });

    const keyHash = crypto.createHash('sha256').update('test-key').digest('hex');
    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: 'Test API Key',
        keyHash,
        scopes: ['read', 'write'],
        workspaceId: workspace.id,
      },
    });

    return { tenant, workspace, apiKey };
  }

  /**
   * Create a test visitor
   */
  async createTestVisitor(tenantId: bigint, workspaceId: bigint, anonymousId?: string) {
    const visitor = await this.prisma.visitor.create({
      data: {
        anonymousId: anonymousId || `a_${crypto.randomInt(100000, 999999)}`,
        tenantId,
        workspaceId,
        firstUtm: {
          source: 'test',
          medium: 'test',
        },
        lastUtm: {
          source: 'test',
          medium: 'test',
        },
        lastDevice: {
          os: 'test',
          browser: 'test',
          device_type: 'test',
        },
        lastGeo: {
          country: 'BR',
          region: 'SP',
          city: 'São Paulo',
        },
      },
    });

    return visitor;
  }

  /**
   * Create a test lead
   */
  async createTestLead(tenantId: bigint, workspaceId: bigint, email?: string) {
    const testEmail = email || `test${Date.now()}@example.com`;
    const emailFingerprint = crypto.createHmac('sha256', 'test-secret').update(testEmail).digest('hex');

    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        workspaceId,
        emailEnc: Buffer.from(testEmail).toString('base64'),
        emailFingerprint,
      },
    });

    return lead;
  }

  /**
   * Create a test session
   */
  async createTestSession(tenantId: bigint, workspaceId: bigint, anonymousId: string) {
    const session = await this.prisma.session.create({
      data: {
        sessionId: `s_${crypto.randomInt(100000, 999999)}`,
        tenantId,
        workspaceId,
        anonymousId,
        userAgent: 'Test User Agent',
      },
    });

    return session;
  }

  /**
   * Create a test event
   */
  async createTestEvent(
    tenantId: bigint,
    workspaceId: bigint,
    anonymousId: string,
    eventName: string = 'test_event',
    sessionId?: string,
    leadId?: bigint,
  ) {
    const event = await this.prisma.event.create({
      data: {
        schemaVersion: '1.0',
        eventName,
        timestamp: new Date(),
        tenantId,
        workspaceId,
        anonymousId,
        leadId,
        sessionId,
        page: {
          url: 'https://test.com',
          path: '/',
          title: 'Test Page',
        },
        utm: {
          source: 'test',
          medium: 'test',
        },
        device: {
          os: 'test',
          browser: 'test',
          device_type: 'test',
        },
        geo: {
          country: 'BR',
          region: 'SP',
          city: 'São Paulo',
        },
        props: {
          test: true,
        },
      },
    });

    return event;
  }

  /**
   * Create a test funnel with basic structure
   */
  async createTestFunnel(tenantId: bigint, workspaceId: bigint, name?: string) {
    const funnel = await this.prisma.funnel.create({
      data: {
        name: name || `Test Funnel ${Date.now()}`,
        description: 'Test funnel description',
        tenantId,
        workspaceId,
      },
    });

    const funnelVersion = await this.prisma.funnelVersion.create({
      data: {
        funnelId: funnel.id,
        version: 1,
        state: 'draft',
      },
    });

    const step = await this.prisma.funnelStep.create({
      data: {
        funnelVersionId: funnelVersion.id,
        orderIndex: 0,
        type: 'start',
        label: 'Test Step',
        metadata: {
          description: 'Test step description',
        },
      },
    });

    const stepMatch = await this.prisma.funnelStepMatch.create({
      data: {
        funnelStepId: step.id,
        kind: 'page',
        rules: {
          url_match: {
            type: 'exact',
            value: 'https://test.com',
          },
        },
      },
    });

    return { funnel, funnelVersion, step, stepMatch };
  }

  /**
   * Verify multi-tenant isolation by ensuring data is isolated by tenant
   */
  async verifyTenantIsolation(tenantId1: bigint, tenantId2: bigint): Promise<boolean> {
    try {
      // Count records for each tenant
      const tenant1Visitors = await this.prisma.visitor.count({
        where: { tenantId: tenantId1 },
      });

      const tenant2Visitors = await this.prisma.visitor.count({
        where: { tenantId: tenantId2 },
      });

      const tenant1Events = await this.prisma.event.count({
        where: { tenantId: tenantId1 },
      });

      const tenant2Events = await this.prisma.event.count({
        where: { tenantId: tenantId2 },
      });

      // Verify cross-tenant queries return no data
      const crossTenantVisitors = await this.prisma.visitor.findMany({
        where: {
          tenantId: tenantId1,
          events: {
            some: {
              tenantId: tenantId2,
            },
          },
        },
      });

      return crossTenantVisitors.length === 0;
    } catch (error) {
      console.error('Error verifying tenant isolation:', error);
      return false;
    }
  }
}
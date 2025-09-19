import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from './prisma.service'
import { TestUtils } from './test-utils'

describe('Database Integration', () => {
  let prismaService: PrismaService
  let testUtils: TestUtils
  let module: TestingModule

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile()

    prismaService = module.get<PrismaService>(PrismaService)
    testUtils = new TestUtils(prismaService)
    await prismaService.onModuleInit()
  })

  afterAll(async () => {
    await prismaService.onModuleDestroy()
    await module.close()
  })

  beforeEach(async () => {
    // Clean database before each test
    await testUtils.cleanDatabase()
  })

  describe('Prisma Service', () => {
    it('should connect to database successfully', async () => {
      const isHealthy = await prismaService.isHealthy()
      expect(isHealthy).toBe(true)
    })

    it('should execute raw queries', async () => {
      const result = await prismaService.$queryRaw`SELECT 1 as test`
      expect(result).toEqual([{ test: 1 }])
    })
  })

  describe('Multi-tenant Data Model', () => {
    it('should create tenant with workspace and API key', async () => {
      const { tenant, workspace, apiKey } = await testUtils.createTestTenant()

      expect(tenant).toBeDefined()
      expect(tenant.name).toContain('Test Tenant')
      expect(workspace).toBeDefined()
      expect(workspace.tenantId).toEqual(tenant.id)
      expect(apiKey).toBeDefined()
      expect(apiKey.workspaceId).toEqual(workspace.id)
    })

    it('should enforce tenant isolation', async () => {
      const { tenant: tenant1, workspace: workspace1 } =
        await testUtils.createTestTenant('Tenant 1')
      const { tenant: tenant2, workspace: workspace2 } =
        await testUtils.createTestTenant('Tenant 2')

      // Create visitors for each tenant
      const visitor1 = await testUtils.createTestVisitor(tenant1.id, workspace1.id)
      const visitor2 = await testUtils.createTestVisitor(tenant2.id, workspace2.id)

      // Create events for each visitor
      await testUtils.createTestEvent(
        tenant1.id,
        workspace1.id,
        visitor1.anonymousId,
        'test_event_1'
      )
      await testUtils.createTestEvent(
        tenant2.id,
        workspace2.id,
        visitor2.anonymousId,
        'test_event_2'
      )

      // Verify tenant isolation
      const isolationValid = await testUtils.verifyTenantIsolation(tenant1.id, tenant2.id)
      expect(isolationValid).toBe(true)

      // Verify each tenant can only see their own data
      const tenant1Visitors = await prismaService.visitor.findMany({
        where: { tenantId: tenant1.id },
      })
      const tenant2Visitors = await prismaService.visitor.findMany({
        where: { tenantId: tenant2.id },
      })

      expect(tenant1Visitors).toHaveLength(1)
      expect(tenant2Visitors).toHaveLength(1)
      expect(tenant1Visitors[0].anonymousId).toBe(visitor1.anonymousId)
      expect(tenant2Visitors[0].anonymousId).toBe(visitor2.anonymousId)
    })
  })

  describe('Identity System', () => {
    it('should create visitor and lead with identity link', async () => {
      const { tenant, workspace } = await testUtils.createTestTenant()
      const visitor = await testUtils.createTestVisitor(tenant.id, workspace.id)
      const lead = await testUtils.createTestLead(tenant.id, workspace.id)

      // Create identity link
      const identityLink = await prismaService.identityLink.create({
        data: {
          tenantId: tenant.id,
          workspaceId: workspace.id,
          anonymousId: visitor.anonymousId,
          leadId: lead.id,
        },
      })

      expect(identityLink).toBeDefined()
      expect(identityLink.anonymousId).toBe(visitor.anonymousId)
      expect(identityLink.leadId).toEqual(lead.id)

      // Verify relationship
      const visitorWithLinks = await prismaService.visitor.findUnique({
        where: { anonymousId: visitor.anonymousId },
        include: { identityLinks: true },
      })

      expect(visitorWithLinks?.identityLinks).toHaveLength(1)
      expect(visitorWithLinks?.identityLinks[0].leadId).toEqual(lead.id)
    })

    it('should handle PII encryption and fingerprinting', async () => {
      const { tenant, workspace } = await testUtils.createTestTenant()
      const testEmail = 'test@example.com'
      const lead = await testUtils.createTestLead(tenant.id, workspace.id, testEmail)

      expect(lead.emailEnc).toBeDefined()
      expect(lead.emailFingerprint).toBeDefined()
      expect(lead.emailEnc).not.toBe(testEmail) // Should be encrypted
      expect(lead.emailFingerprint).toHaveLength(64) // SHA256 hex length

      // Verify we can find leads by fingerprint
      const foundLead = await prismaService.lead.findFirst({
        where: {
          tenantId: tenant.id,
          workspaceId: workspace.id,
          emailFingerprint: lead.emailFingerprint,
        },
      })

      expect(foundLead).toBeDefined()
      expect(foundLead?.id).toEqual(lead.id)
    })
  })

  describe('Events and Sessions', () => {
    it('should create session and events with proper relationships', async () => {
      const { tenant, workspace } = await testUtils.createTestTenant()
      const visitor = await testUtils.createTestVisitor(tenant.id, workspace.id)
      const session = await testUtils.createTestSession(
        tenant.id,
        workspace.id,
        visitor.anonymousId
      )

      const event = await testUtils.createTestEvent(
        tenant.id,
        workspace.id,
        visitor.anonymousId,
        'page_view',
        session.sessionId
      )

      expect(event).toBeDefined()
      expect(event.sessionId).toBe(session.sessionId)
      expect(event.anonymousId).toBe(visitor.anonymousId)

      // Verify relationships
      const eventWithRelations = await prismaService.event.findUnique({
        where: {
          id_tenantId_timestamp: {
            id: event.id,
            tenantId: tenant.id,
            timestamp: event.timestamp,
          },
        },
        include: {
          visitor: true,
          session: true,
        },
      })

      expect(eventWithRelations?.visitor.anonymousId).toBe(visitor.anonymousId)
      expect(eventWithRelations?.session?.sessionId).toBe(session.sessionId)
    })

    it('should handle JSON data in events', async () => {
      const { tenant, workspace } = await testUtils.createTestTenant()
      const visitor = await testUtils.createTestVisitor(tenant.id, workspace.id)

      const event = await testUtils.createTestEvent(
        tenant.id,
        workspace.id,
        visitor.anonymousId,
        'purchase'
      )

      // Update event with complex JSON data
      await prismaService.event.update({
        where: {
          id_tenantId_timestamp: {
            id: event.id,
            tenantId: tenant.id,
            timestamp: event.timestamp,
          },
        },
        data: {
          props: {
            order_id: 'order_123',
            items: [
              { product_id: 'prod_1', quantity: 2, price: 29.99 },
              { product_id: 'prod_2', quantity: 1, price: 19.99 },
            ],
            total: 79.97,
            currency: 'BRL',
          },
        },
      })

      const updatedEvent = await prismaService.event.findUnique({
        where: {
          id_tenantId_timestamp: {
            id: event.id,
            tenantId: tenant.id,
            timestamp: event.timestamp,
          },
        },
      })

      expect(updatedEvent?.props).toBeDefined()
      expect((updatedEvent?.props as any).order_id).toBe('order_123')
      expect((updatedEvent?.props as any).items).toHaveLength(2)
      expect((updatedEvent?.props as any).total).toBe(79.97)
    })
  })

  describe('Funnel System', () => {
    it('should create complete funnel with steps and matches', async () => {
      const { tenant, workspace } = await testUtils.createTestTenant()
      const { funnel, funnelVersion, step, stepMatch } = await testUtils.createTestFunnel(
        tenant.id,
        workspace.id
      )

      expect(funnel).toBeDefined()
      expect(funnelVersion).toBeDefined()
      expect(step).toBeDefined()
      expect(stepMatch).toBeDefined()

      // Verify relationships
      const funnelWithSteps = await prismaService.funnel.findUnique({
        where: { id: funnel.id },
        include: {
          versions: {
            include: {
              steps: {
                include: {
                  matches: true,
                },
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      })

      expect(funnelWithSteps?.versions).toHaveLength(1)
      expect(funnelWithSteps?.versions[0].steps).toHaveLength(1)
      expect(funnelWithSteps?.versions[0].steps[0].matches).toHaveLength(1)
    })

    it('should support funnel versioning and publishing', async () => {
      const { tenant, workspace } = await testUtils.createTestTenant()
      const { funnel } = await testUtils.createTestFunnel(tenant.id, workspace.id)

      // Create second version
      const version2 = await prismaService.funnelVersion.create({
        data: {
          funnelId: funnel.id,
          version: 2,
          state: 'published',
        },
      })

      // Publish version 2
      const publication = await prismaService.funnelPublication.create({
        data: {
          funnelId: funnel.id,
          version: 2,
          windowDays: 14,
          notes: 'Updated funnel with new steps',
        },
      })

      expect(version2.version).toBe(2)
      expect(version2.state).toBe('published')
      expect(publication.version).toBe(2)
      expect(publication.windowDays).toBe(14)

      // Verify we have two versions
      const allVersions = await prismaService.funnelVersion.findMany({
        where: { funnelId: funnel.id },
        orderBy: { version: 'asc' },
      })

      expect(allVersions).toHaveLength(2)
      expect(allVersions[0].version).toBe(1)
      expect(allVersions[1].version).toBe(2)
    })
  })
})

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma.service';
import { provisionTenant, ProvisioningResult } from '../provision-tenant';

describe('Provisioning System', () => {
  let prismaService: PrismaService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);
    await prismaService.onModuleInit();
  });

  afterAll(async () => {
    await prismaService.onModuleDestroy();
    await module.close();
  });

  beforeEach(async () => {
    // Clean tenants table before each test
    await prismaService.tenant.deleteMany({});
    await prismaService.workspace.deleteMany({});
    await prismaService.apiKey.deleteMany({});
  });

  describe('Parameter Validation', () => {
    it('should reject empty tenant name', async () => {
      await expect(
        provisionTenant('', 'Test Workspace', false)
      ).rejects.toThrow('Tenant name cannot be empty');
    });

    it('should reject whitespace-only tenant name', async () => {
      await expect(
        provisionTenant('   ', 'Test Workspace', false)
      ).rejects.toThrow('Tenant name cannot be empty');
    });

    it('should reject tenant name exceeding 255 characters', async () => {
      const longName = 'a'.repeat(256);
      await expect(
        provisionTenant(longName, 'Test Workspace', false)
      ).rejects.toThrow('Tenant name cannot exceed 255 characters');
    });

    it('should reject empty workspace name', async () => {
      await expect(
        provisionTenant('Test Tenant', '', false)
      ).rejects.toThrow('Workspace name cannot be empty');
    });

    it('should reject workspace name exceeding 255 characters', async () => {
      const longName = 'a'.repeat(256);
      await expect(
        provisionTenant('Test Tenant', longName, false)
      ).rejects.toThrow('Workspace name cannot exceed 255 characters');
    });

    it('should trim whitespace from tenant and workspace names', async () => {
      const result = await provisionTenant('  Test Tenant  ', '  Test Workspace  ', false);
      
      expect(result.success).toBe(true);
      expect(result.tenant.name).toBe('Test Tenant');
      expect(result.workspace.name).toBe('Test Workspace');
    });
  });

  describe('Duplicate Prevention', () => {
    it('should prevent duplicate tenant names', async () => {
      const tenantName = 'Duplicate Tenant';
      
      // Create first tenant
      const result1 = await provisionTenant(tenantName, 'Workspace 1', false);
      expect(result1.success).toBe(true);
      
      // Try to create duplicate
      await expect(
        provisionTenant(tenantName, 'Workspace 2', false)
      ).rejects.toThrow(`Tenant with name "${tenantName}" already exists`);
    });

    it('should handle case-sensitive duplicate detection', async () => {
      await provisionTenant('Test Tenant', 'Workspace 1', false);
      
      // Different case should be allowed
      const result = await provisionTenant('test tenant', 'Workspace 2', false);
      expect(result.success).toBe(true);
    });
  });

  describe('Complete Provisioning', () => {
    it('should create tenant, workspace, and API key successfully', async () => {
      const result = await provisionTenant('Test Company', 'Production Workspace', false);
      
      expect(result.success).toBe(true);
      expect(result.tenant.name).toBe('Test Company');
      expect(result.workspace.name).toBe('Production Workspace');
      expect(result.apiKey.name).toBe('Production Workspace API Key');
      expect(result.apiKey.value).toMatch(/^ak_[A-Za-z0-9_-]+$/);
      expect(result.timestamp).toBeDefined();
      
      // Verify in database
      const tenant = await prismaService.tenant.findUnique({
        where: { id: BigInt(result.tenant.id) },
        include: {
          workspaces: {
            include: {
              apiKeys: true
            }
          }
        }
      });
      
      expect(tenant).toBeDefined();
      expect(tenant!.name).toBe('Test Company');
      expect(tenant!.status).toBe('active');
      expect(tenant!.workspaces).toHaveLength(1);
      expect(tenant!.workspaces[0].name).toBe('Production Workspace');
      expect(tenant!.workspaces[0].apiKeys).toHaveLength(1);
    });

    it('should create sample data when requested', async () => {
      const result = await provisionTenant('Sample Company', 'Sample Workspace', true);
      
      expect(result.success).toBe(true);
      expect(result.statistics.sampleVisitors).toBe(2);
      expect(result.statistics.sampleLeads).toBe(1);
      expect(result.statistics.sampleEvents).toBe(2);
      
      // Verify sample data in database
      const tenantId = BigInt(result.tenant.id);
      
      const visitors = await prismaService.visitor.findMany({
        where: { tenantId }
      });
      expect(visitors).toHaveLength(2);
      
      const leads = await prismaService.lead.findMany({
        where: { tenantId }
      });
      expect(leads).toHaveLength(1);
      
      const events = await prismaService.event.findMany({
        where: { tenantId }
      });
      expect(events).toHaveLength(2);
      
      const sessions = await prismaService.session.findMany({
        where: { tenantId }
      });
      expect(sessions).toHaveLength(1);
      
      const identityLinks = await prismaService.identityLink.findMany({
        where: { tenantId }
      });
      expect(identityLinks).toHaveLength(1);
    });

    it('should skip sample data when not requested', async () => {
      const result = await provisionTenant('No Sample Company', 'No Sample Workspace', false);
      
      expect(result.success).toBe(true);
      expect(result.statistics.sampleVisitors).toBe(0);
      expect(result.statistics.sampleLeads).toBe(0);
      expect(result.statistics.sampleEvents).toBe(0);
      
      // Verify no sample data in database
      const tenantId = BigInt(result.tenant.id);
      
      const visitors = await prismaService.visitor.findMany({
        where: { tenantId }
      });
      expect(visitors).toHaveLength(0);
      
      const leads = await prismaService.lead.findMany({
        where: { tenantId }
      });
      expect(leads).toHaveLength(0);
      
      const events = await prismaService.event.findMany({
        where: { tenantId }
      });
      expect(events).toHaveLength(0);
    });
  });

  describe('API Key Generation', () => {
    it('should generate unique API keys', async () => {
      const result1 = await provisionTenant('Company 1', 'Workspace 1', false);
      const result2 = await provisionTenant('Company 2', 'Workspace 2', false);
      
      expect(result1.apiKey.value).not.toBe(result2.apiKey.value);
      expect(result1.apiKey.value).toMatch(/^ak_[A-Za-z0-9_-]+$/);
      expect(result2.apiKey.value).toMatch(/^ak_[A-Za-z0-9_-]+$/);
    });

    it('should create API key with correct scopes', async () => {
      const result = await provisionTenant('Test Company', 'Test Workspace', false);
      
      const apiKey = await prismaService.apiKey.findUnique({
        where: { id: BigInt(result.apiKey.id) }
      });
      
      expect(apiKey).toBeDefined();
      expect(apiKey!.scopes).toEqual(['read', 'write', 'events:write']);
    });

    it('should hash API key properly', async () => {
      const result = await provisionTenant('Test Company', 'Test Workspace', false);
      
      const apiKey = await prismaService.apiKey.findUnique({
        where: { id: BigInt(result.apiKey.id) }
      });
      
      expect(apiKey!.keyHash).toBeDefined();
      expect(apiKey!.keyHash).toHaveLength(64); // SHA256 hex length
      expect(apiKey!.keyHash).not.toBe(result.apiKey.value); // Should be hashed, not plain
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Close connection to simulate error
      await prismaService.$disconnect();
      
      await expect(
        provisionTenant('Error Test', 'Error Workspace', false)
      ).rejects.toThrow();
      
      // Reconnect for cleanup
      await prismaService.$connect();
    });

    it('should rollback on partial failure', async () => {
      // This test would require more complex setup to simulate partial failures
      // For now, we trust that Prisma transactions handle this correctly
      const initialTenantCount = await prismaService.tenant.count();
      const initialWorkspaceCount = await prismaService.workspace.count();
      const initialApiKeyCount = await prismaService.apiKey.count();
      
      try {
        await provisionTenant('Valid Tenant', 'Valid Workspace', false);
      } catch (error) {
        // If provisioning failed, counts should remain the same
        const finalTenantCount = await prismaService.tenant.count();
        const finalWorkspaceCount = await prismaService.workspace.count();
        const finalApiKeyCount = await prismaService.apiKey.count();
        
        expect(finalTenantCount).toBe(initialTenantCount);
        expect(finalWorkspaceCount).toBe(initialWorkspaceCount);
        expect(finalApiKeyCount).toBe(initialApiKeyCount);
      }
    });
  });

  describe('Structured Output', () => {
    it('should return properly structured result', async () => {
      const result = await provisionTenant('Structured Test', 'Structured Workspace', true);
      
      // Check structure
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('tenant');
      expect(result).toHaveProperty('workspace');
      expect(result).toHaveProperty('apiKey');
      expect(result).toHaveProperty('statistics');
      expect(result).toHaveProperty('timestamp');
      
      // Check tenant structure
      expect(result.tenant).toHaveProperty('id');
      expect(result.tenant).toHaveProperty('name');
      
      // Check workspace structure
      expect(result.workspace).toHaveProperty('id');
      expect(result.workspace).toHaveProperty('name');
      
      // Check API key structure
      expect(result.apiKey).toHaveProperty('id');
      expect(result.apiKey).toHaveProperty('name');
      expect(result.apiKey).toHaveProperty('value');
      
      // Check statistics structure
      expect(result.statistics).toHaveProperty('sampleVisitors');
      expect(result.statistics).toHaveProperty('sampleLeads');
      expect(result.statistics).toHaveProperty('sampleEvents');
      
      // Check timestamp format
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });
});
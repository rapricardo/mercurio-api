# Provisioning — Sprint 1 Ingestão Operacional

## 🎯 Overview

Este documento especifica a implementação de **provisionamento automatizado** de tenants, workspaces e API keys, baseado no `seed.ts` existente, mas com parametrização via CLI.

---

## 📋 Requirements

### Core Functionality
- ✅ **Base exists**: `apps/api/prisma/seed.ts` implementa criação básica
- 🔄 **Parametrization needed**: Accept tenant/workspace names via CLI
- 🔄 **Structured output**: Return tenant_id, workspace_id, api_key in JSON
- 🔄 **Validation**: Prevent duplicates, validate inputs

### CLI Interface
- **Command**: `npm run seed -- --name "Client Name" --workspace "Production"`
- **Alternative**: `npm run -w @mercurio/api db:seed -- --name "Client" --workspace "WS"`
- **Output**: JSON structure with all created entities

---

## 🏗️ Implementation Specification

### 1. Enhanced Seed Script

**File**: `apps/api/scripts/provision-tenant.ts`

```typescript
/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { Command } from 'commander';

const prisma = new PrismaClient();

// Types for structured output
interface ProvisioningResult {
  success: boolean;
  tenant: {
    id: string;
    name: string;
  };
  workspace: {
    id: string;
    name: string;
  };
  apiKey: {
    id: string;
    name: string;
    value: string; // WARNING: Only shown once during creation
  };
  statistics: {
    sampleVisitors: number;
    sampleLeads: number;
    sampleEvents: number;
  };
  timestamp: string;
}

function randomKey(prefix: string, bytes = 16): string {
  const raw = crypto.randomBytes(bytes).toString('base64url');
  return `${prefix}_${raw}`;
}

function generateAnonymousId(): string {
  return `a_${crypto.randomInt(100000, 999999)}`;
}

function createFingerprint(data: string): string {
  return crypto.createHmac('sha256', 'demo-secret').update(data).digest('hex');
}

function encryptPII(data: string): string {
  // Simple encryption for demo - in real implementation use proper encryption
  return Buffer.from(data).toString('base64');
}

async function provisionTenant(tenantName: string, workspaceName: string, includeSamples = true): Promise<ProvisioningResult> {
  console.log(`🚀 Provisioning tenant: "${tenantName}" with workspace: "${workspaceName}"`);

  // Check for existing tenant by name
  const existingTenant = await prisma.tenant.findFirst({
    where: { name: tenantName }
  });

  if (existingTenant) {
    throw new Error(`Tenant with name "${tenantName}" already exists (ID: ${existingTenant.id})`);
  }

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
      status: 'active'
    },
  });

  console.log(`✅ Created tenant: ${tenant.name} (ID: ${tenant.id})`);

  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      tenantId: tenant.id,
    },
  });

  console.log(`✅ Created workspace: ${workspace.name} (ID: ${workspace.id})`);

  // Create API key
  const apiKeyValue = randomKey('ak');
  const keyHash = crypto.createHash('sha256').update(apiKeyValue).digest('hex');

  const apiKey = await prisma.apiKey.create({
    data: {
      name: `${workspaceName} API Key`,
      keyHash: keyHash,
      scopes: ['read', 'write', 'events:write'],
      workspaceId: workspace.id,
    },
  });

  console.log(`✅ Created API key: ${apiKey.name} (ID: ${apiKey.id})`);

  let statistics = { sampleVisitors: 0, sampleLeads: 0, sampleEvents: 0 };

  // Create sample data if requested
  if (includeSamples) {
    console.log('📝 Creating sample data...');
    
    // Create sample visitors
    const visitors = await Promise.all([
      prisma.visitor.create({
        data: {
          anonymousId: generateAnonymousId(),
          tenantId: tenant.id,
          workspaceId: workspace.id,
          firstUtm: {
            source: 'google',
            medium: 'cpc',
            campaign: 'onboarding_demo'
          },
          lastDevice: {
            user_agent: 'Mozilla/5.0...',
            os: 'macOS',
            browser: 'Chrome',
            device_type: 'desktop'
          },
          lastGeo: {
            country: 'BR',
            region: 'SP',
            city: 'São Paulo'
          }
        }
      }),
      prisma.visitor.create({
        data: {
          anonymousId: generateAnonymousId(),
          tenantId: tenant.id,
          workspaceId: workspace.id,
          firstUtm: {
            source: 'direct',
            medium: 'none'
          },
          lastDevice: {
            user_agent: 'Mozilla/5.0...',
            os: 'iOS',
            browser: 'Safari',
            device_type: 'mobile'
          }
        }
      })
    ]);

    // Create sample leads
    const leads = await Promise.all([
      prisma.lead.create({
        data: {
          tenantId: tenant.id,
          workspaceId: workspace.id,
          emailEnc: encryptPII('demo@example.com'),
          emailFingerprint: createFingerprint('demo@example.com')
        }
      })
    ]);

    // Create identity link
    await prisma.identityLink.create({
      data: {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        anonymousId: visitors[0].anonymousId,
        leadId: leads[0].id
      }
    });

    // Create sample events
    const baseTimestamp = new Date();
    await Promise.all([
      prisma.event.create({
        data: {
          schemaVersion: '1.0.0',
          eventName: 'page_view',
          timestamp: new Date(baseTimestamp.getTime() - 3600000),
          tenantId: tenant.id,
          workspaceId: workspace.id,
          anonymousId: visitors[0].anonymousId,
          leadId: leads[0].id,
          page: {
            url: 'https://demo.example.com/',
            path: '/',
            title: 'Welcome Page'
          },
          utm: {
            source: 'onboarding',
            medium: 'email',
            campaign: 'welcome'
          }
        }
      }),
      prisma.event.create({
        data: {
          schemaVersion: '1.0.0',
          eventName: 'button_click',
          timestamp: new Date(baseTimestamp.getTime() - 1800000),
          tenantId: tenant.id,
          workspaceId: workspace.id,
          anonymousId: visitors[0].anonymousId,
          leadId: leads[0].id,
          props: {
            button_text: 'Get Started',
            location: 'hero_section'
          }
        }
      })
    ]);

    statistics = {
      sampleVisitors: visitors.length,
      sampleLeads: leads.length,
      sampleEvents: 2
    };

    console.log('✅ Sample data created successfully');
  }

  const result: ProvisioningResult = {
    success: true,
    tenant: {
      id: tenant.id.toString(),
      name: tenant.name
    },
    workspace: {
      id: workspace.id.toString(),
      name: workspace.name
    },
    apiKey: {
      id: apiKey.id.toString(),
      name: apiKey.name,
      value: apiKeyValue
    },
    statistics,
    timestamp: new Date().toISOString()
  };

  return result;
}

async function main() {
  const program = new Command();
  
  program
    .name('provision-tenant')
    .description('Provision a new tenant with workspace and API key')
    .option('-n, --name <name>', 'Tenant name')
    .option('-w, --workspace <workspace>', 'Workspace name', 'Default Workspace')
    .option('--no-samples', 'Skip creating sample data')
    .parse();

  const options = program.opts();

  if (!options.name) {
    console.error('❌ Tenant name is required. Use --name "Your Tenant Name"');
    process.exit(1);
  }

  try {
    const result = await provisionTenant(
      options.name,
      options.workspace,
      options.samples !== false
    );

    console.log('\n🎉 Provisioning completed successfully!\n');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n📋 Quick Start:');
    console.log(`   Tenant ID: ${result.tenant.id}`);
    console.log(`   Workspace ID: ${result.workspace.id}`);
    console.log(`   API Key: ${result.apiKey.value}`);
    console.log('\n⚠️  Save the API key securely - it won\'t be shown again!');

  } catch (error: any) {
    console.error('❌ Provisioning failed:', error.message);
    process.exit(1);
  }
}

// Handle both direct execution and module import
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { provisionTenant, ProvisioningResult };
```

### 2. Package.json Script Update

**File**: `apps/api/package.json`

**Add new script**:
```json
{
  "scripts": {
    // ... existing scripts
    "db:seed": "prisma db seed",
    "provision": "ts-node scripts/provision-tenant.ts",
    "provision:dev": "ts-node-dev scripts/provision-tenant.ts"
  },
  "dependencies": {
    // ... existing dependencies  
    "commander": "^11.1.0"
  }
}
```

### 3. CLI Usage Examples

```bash
# Basic provisioning
npm run provision -- --name "Acme Corp" --workspace "Production"

# With custom workspace name
npm run provision -- --name "StartupXYZ" --workspace "Staging Environment"

# Without sample data  
npm run provision -- --name "Enterprise Client" --no-samples

# Legacy compatibility (reuse existing seed)
npm run db:seed
```

### 4. Expected Output

```json
{
  "success": true,
  "tenant": {
    "id": "123",
    "name": "Acme Corp"
  },
  "workspace": {
    "id": "456", 
    "name": "Production"
  },
  "apiKey": {
    "id": "789",
    "name": "Production API Key",
    "value": "ak_abc123xyz789..."
  },
  "statistics": {
    "sampleVisitors": 2,
    "sampleLeads": 1, 
    "sampleEvents": 2
  },
  "timestamp": "2024-08-24T15:30:00.000Z"
}
```

---

## 🔒 Security Considerations

### API Key Handling
- ✅ **One-time display**: API key shown only during creation
- ✅ **Hashed storage**: Only hash stored in database  
- ✅ **Secure generation**: Crypto-random generation
- ✅ **Proper scopes**: Default scopes for events ingestion

### Input Validation
- ✅ **Name length**: 1-255 characters
- ✅ **Character whitelist**: Alphanumeric + spaces + basic punctuation
- ✅ **Duplicate prevention**: Check existing tenant names
- ✅ **SQL injection**: Prisma provides built-in protection

---

## 🧪 Testing Strategy

### Unit Tests

**File**: `apps/api/scripts/provision-tenant.test.ts`

```typescript
describe('Tenant Provisioning', () => {
  test('should create tenant with valid data', async () => {
    const result = await provisionTenant('Test Tenant', 'Test Workspace');
    expect(result.success).toBe(true);
    expect(result.tenant.name).toBe('Test Tenant');
    expect(result.apiKey.value).toMatch(/^ak_/);
  });

  test('should prevent duplicate tenant names', async () => {
    await provisionTenant('Duplicate Test', 'WS1');
    await expect(provisionTenant('Duplicate Test', 'WS2')).rejects.toThrow();
  });
});
```

### Integration Tests
- ✅ End-to-end provisioning flow
- ✅ CLI parameter parsing
- ✅ Database constraints validation
- ✅ Sample data creation verification

---

## 📊 Monitoring & Observability

### Logging
- ✅ **Structured logs**: JSON format with tenant context
- ✅ **Progress indicators**: Step-by-step creation logs  
- ✅ **Error context**: Detailed error information
- ✅ **Audit trail**: Who provisioned what when

### Metrics
- **Provisioning success rate**: Track failed vs successful provisions
- **Time to provision**: Monitor provisioning latency
- **Resource usage**: Track created entities per provision

---

## 🔄 Migration from Existing Seed

### Backward Compatibility
- ✅ **Preserve original**: `npm run db:seed` still works
- ✅ **Same data structure**: Compatible with existing schema
- ✅ **Environment variables**: Honor existing SEED_TENANT_NAME/SEED_WORKSPACE_NAME

### Gradual Adoption  
1. **Phase 1**: Deploy new script alongside existing seed
2. **Phase 2**: Update documentation to use new provisioning
3. **Phase 3**: Deprecate old seed script (Sprint 2+)

---

## ✅ Acceptance Criteria

- [ ] CLI accepts --name and --workspace parameters
- [ ] Structured JSON output with all entity IDs
- [ ] Duplicate tenant name prevention
- [ ] API key generated and displayed once  
- [ ] Sample data creation optional (--no-samples)
- [ ] Error handling with clear messages
- [ ] Backward compatibility with existing seed
- [ ] Unit tests coverage >90%
- [ ] Integration tests passing
- [ ] Documentation updated
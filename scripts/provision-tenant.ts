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

  // Validate inputs
  if (!tenantName || tenantName.trim().length === 0) {
    throw new Error('Tenant name cannot be empty');
  }

  if (tenantName.length > 255) {
    throw new Error('Tenant name cannot exceed 255 characters');
  }

  if (!workspaceName || workspaceName.trim().length === 0) {
    throw new Error('Workspace name cannot be empty');
  }

  if (workspaceName.length > 255) {
    throw new Error('Workspace name cannot exceed 255 characters');
  }

  // Check for existing tenant by name
  const existingTenant = await prisma.tenant.findFirst({
    where: { name: tenantName.trim() }
  });

  if (existingTenant) {
    throw new Error(`Tenant with name "${tenantName}" already exists (ID: ${existingTenant.id})`);
  }

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName.trim(),
      status: 'active'
    },
  });

  console.log(`✅ Created tenant: ${tenant.name} (ID: ${tenant.id})`);

  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName.trim(),
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
          lastUtm: {
            source: 'google',
            medium: 'cpc',
            campaign: 'onboarding_demo'
          },
          lastDevice: {
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/91.0.4472.124',
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
          lastUtm: {
            source: 'direct',
            medium: 'none'
          },
          lastDevice: {
            user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
            os: 'iOS',
            browser: 'Safari',
            device_type: 'mobile'
          },
          lastGeo: {
            country: 'BR',
            region: 'RJ',
            city: 'Rio de Janeiro'
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

    // Create sample session
    const sessionId = `s_${crypto.randomInt(100000, 999999)}`;
    await prisma.session.create({
      data: {
        sessionId: sessionId,
        tenantId: tenant.id,
        workspaceId: workspace.id,
        anonymousId: visitors[0].anonymousId,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/91.0.4472.124'
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
          sessionId: sessionId,
          page: {
            url: 'https://demo.example.com/',
            path: '/',
            title: 'Welcome Page'
          },
          utm: {
            source: 'onboarding',
            medium: 'email',
            campaign: 'welcome'
          },
          device: {
            os: 'macOS',
            browser: 'Chrome',
            device_type: 'desktop'
          },
          geo: {
            country: 'BR',
            region: 'SP',
            city: 'São Paulo'
          },
          props: { demo: true }
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
          sessionId: sessionId,
          page: {
            url: 'https://demo.example.com/get-started',
            path: '/get-started',
            title: 'Get Started'
          },
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
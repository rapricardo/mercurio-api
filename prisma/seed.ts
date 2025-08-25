/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

function randomKey(prefix: string, bytes = 16) {
  const raw = crypto.randomBytes(bytes).toString('base64url');
  return `${prefix}_${raw}`;
}

function generateAnonymousId() {
  return `a_${crypto.randomInt(100000, 999999)}`;
}

function generateSessionId() {
  return `s_${crypto.randomInt(100000, 999999)}`;
}

function encryptPII(data: string): string {
  // Simple encryption for demo - in real implementation use proper encryption
  return Buffer.from(data).toString('base64');
}

function createFingerprint(data: string): string {
  return crypto.createHmac('sha256', 'demo-secret').update(data).digest('hex');
}

async function main() {
  console.log('🌱 Starting database seeding...');

  const tenantName = process.env.SEED_TENANT_NAME || 'Demo Tenant';
  const workspaceName = process.env.SEED_WORKSPACE_NAME || 'Demo Workspace';

  // Create tenant and workspace
  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      tenantId: tenant.id,
    },
  });

  // Create API key
  const apiKeyValue = randomKey('ak');
  const keyHash = crypto.createHash('sha256').update(apiKeyValue).digest('hex');

  const apiKey = await prisma.apiKey.create({
    data: {
      name: 'Default API Key',
      keyHash: keyHash,
      scopes: ['read', 'write'],
      workspaceId: workspace.id,
    },
  });

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
          campaign: 'summer_sale',
          term: 'analytics',
          content: 'ad1'
        },
        lastUtm: {
          source: 'google',
          medium: 'cpc',
          campaign: 'summer_sale',
          term: 'analytics',
          content: 'ad1'
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
          source: 'facebook',
          medium: 'social',
          campaign: 'awareness',
          content: 'post1'
        },
        lastUtm: {
          source: 'direct',
          medium: 'none'
        },
        lastDevice: {
          user_agent: 'Mozilla/5.0...',
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
  const testEmail = 'user@example.com';
  const testPhone = '+5511999999999';
  
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        emailEnc: encryptPII(testEmail),
        emailFingerprint: createFingerprint(testEmail),
        phoneEnc: encryptPII(testPhone),
        phoneFingerprint: createFingerprint(testPhone)
      }
    }),
    prisma.lead.create({
      data: {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        emailEnc: encryptPII('lead2@example.com'),
        emailFingerprint: createFingerprint('lead2@example.com')
      }
    })
  ]);

  // Create identity links
  await prisma.identityLink.create({
    data: {
      tenantId: tenant.id,
      workspaceId: workspace.id,
      anonymousId: visitors[0].anonymousId,
      leadId: leads[0].id
    }
  });

  // Create sample sessions
  const sessions = await Promise.all([
    prisma.session.create({
      data: {
        sessionId: generateSessionId(),
        tenantId: tenant.id,
        workspaceId: workspace.id,
        anonymousId: visitors[0].anonymousId,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/91.0.4472.124'
      }
    }),
    prisma.session.create({
      data: {
        sessionId: generateSessionId(),
        tenantId: tenant.id,
        workspaceId: workspace.id,
        anonymousId: visitors[1].anonymousId,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) Safari/604.1'
      }
    })
  ]);

  // Create sample events
  const baseTimestamp = new Date();
  await Promise.all([
    prisma.event.create({
      data: {
        schemaVersion: '1.0',
        eventName: 'page_view',
        timestamp: new Date(baseTimestamp.getTime() - 3600000), // 1 hour ago
        tenantId: tenant.id,
        workspaceId: workspace.id,
        anonymousId: visitors[0].anonymousId,
        leadId: leads[0].id,
        sessionId: sessions[0].sessionId,
        page: {
          url: 'https://example.com/',
          path: '/',
          title: 'Homepage',
          referrer: 'https://google.com'
        },
        utm: {
          source: 'google',
          medium: 'cpc',
          campaign: 'summer_sale'
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
        props: {}
      }
    }),
    prisma.event.create({
      data: {
        schemaVersion: '1.0',
        eventName: 'button_click',
        timestamp: new Date(baseTimestamp.getTime() - 3000000), // 50 minutes ago
        tenantId: tenant.id,
        workspaceId: workspace.id,
        anonymousId: visitors[0].anonymousId,
        leadId: leads[0].id,
        sessionId: sessions[0].sessionId,
        page: {
          url: 'https://example.com/product',
          path: '/product',
          title: 'Product Page'
        },
        props: {
          button_text: 'Add to Cart',
          product_id: 'prod_123'
        }
      }
    }),
    prisma.event.create({
      data: {
        schemaVersion: '1.0',
        eventName: 'purchase',
        timestamp: new Date(baseTimestamp.getTime() - 1800000), // 30 minutes ago
        tenantId: tenant.id,
        workspaceId: workspace.id,
        anonymousId: visitors[0].anonymousId,
        leadId: leads[0].id,
        sessionId: sessions[0].sessionId,
        page: {
          url: 'https://example.com/checkout/success',
          path: '/checkout/success',
          title: 'Purchase Complete'
        },
        props: {
          order_id: 'order_456',
          value: 99.99,
          currency: 'BRL'
        }
      }
    })
  ]);

  // Create sample funnel
  const funnel = await prisma.funnel.create({
    data: {
      name: 'E-commerce Conversion Funnel',
      description: 'Tracks users from homepage to purchase completion',
      tenantId: tenant.id,
      workspaceId: workspace.id
    }
  });

  const funnelVersion = await prisma.funnelVersion.create({
    data: {
      funnelId: funnel.id,
      version: 1,
      state: 'published'
    }
  });

  // Create funnel publication
  await prisma.funnelPublication.create({
    data: {
      funnelId: funnel.id,
      version: 1,
      windowDays: 7,
      notes: 'Initial version of e-commerce funnel'
    }
  });

  // Create funnel steps
  const steps = await Promise.all([
    prisma.funnelStep.create({
      data: {
        funnelVersionId: funnelVersion.id,
        orderIndex: 0,
        type: 'start',
        label: 'Homepage Visit',
        metadata: {
          description: 'User lands on homepage'
        }
      }
    }),
    prisma.funnelStep.create({
      data: {
        funnelVersionId: funnelVersion.id,
        orderIndex: 1,
        type: 'page',
        label: 'Product Page',
        metadata: {
          description: 'User views product page'
        }
      }
    }),
    prisma.funnelStep.create({
      data: {
        funnelVersionId: funnelVersion.id,
        orderIndex: 2,
        type: 'event',
        label: 'Add to Cart',
        metadata: {
          description: 'User adds item to cart'
        }
      }
    }),
    prisma.funnelStep.create({
      data: {
        funnelVersionId: funnelVersion.id,
        orderIndex: 3,
        type: 'conversion',
        label: 'Purchase',
        metadata: {
          description: 'User completes purchase'
        }
      }
    })
  ]);

  // Create funnel step matches
  await Promise.all([
    prisma.funnelStepMatch.create({
      data: {
        funnelStepId: steps[0].id,
        kind: 'page',
        rules: {
          url_match: {
            type: 'exact',
            value: 'https://example.com/'
          }
        }
      }
    }),
    prisma.funnelStepMatch.create({
      data: {
        funnelStepId: steps[1].id,
        kind: 'page',
        rules: {
          url_match: {
            type: 'contains',
            value: '/product'
          }
        }
      }
    }),
    prisma.funnelStepMatch.create({
      data: {
        funnelStepId: steps[2].id,
        kind: 'event',
        rules: {
          event_name: 'button_click',
          prop_filters: [
            {
              key: 'button_text',
              operator: 'eq',
              value: 'Add to Cart'
            }
          ]
        }
      }
    }),
    prisma.funnelStepMatch.create({
      data: {
        funnelStepId: steps[3].id,
        kind: 'event',
        rules: {
          event_name: 'purchase'
        }
      }
    })
  ]);

  console.log('✅ Seed completed successfully!');
  console.log({
    tenant: { id: tenant.id, name: tenant.name },
    workspace: { id: workspace.id, name: workspace.name },
    apiKey: { id: apiKey.id, name: apiKey.name, value: apiKeyValue },
    visitors: visitors.length,
    leads: leads.length,
    sessions: sessions.length,
    events: 3,
    funnel: { id: funnel.id, name: funnel.name, steps: steps.length }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


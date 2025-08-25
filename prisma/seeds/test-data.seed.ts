import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test data...');

  // Create test tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      id: BigInt(1),
      name: 'Test Company',
      status: 'active',
    },
  });

  console.log('✅ Created test tenant:', tenant.name);

  // Create test workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      id: BigInt(1),
      tenantId: tenant.id,
      name: 'Test Workspace',
    },
  });

  console.log('✅ Created test workspace:', workspace.name);

  // Generate API key
  const apiKeyValue = 'mk_test_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(apiKeyValue).digest('hex');

  // Create test API key
  const apiKey = await prisma.apiKey.upsert({
    where: { id: BigInt(1) },
    update: {
      keyHash,
      scopes: ['write', 'events:write', 'read'],
    },
    create: {
      id: BigInt(1),
      workspaceId: workspace.id,
      name: 'Test API Key',
      keyHash,
      scopes: ['write', 'events:write', 'read'],
    },
  });

  console.log('✅ Created test API key');
  console.log('');
  console.log('🔑 DADOS PARA TESTE:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('API Key:', apiKeyValue);
  console.log('Tenant ID:', tenant.id.toString());
  console.log('Workspace ID:', workspace.id.toString());
  console.log('');
  console.log('📡 ENDPOINTS DISPONÍVEIS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Base URL: http://localhost:3000');
  console.log('');
  console.log('1. Track Event:');
  console.log('   POST /v1/events/track');
  console.log('');
  console.log('2. Batch Events:');
  console.log('   POST /v1/events/batch');
  console.log('');
  console.log('3. Identify User:');
  console.log('   POST /v1/events/identify');
  console.log('');

  console.log('💼 EXEMPLOS DE PAYLOAD:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('');
  console.log('1. TRACK EVENT (página visitada):');
  console.log(JSON.stringify({
    "event_name": "page_view",
    "timestamp": new Date().toISOString(),
    "anonymous_id": "a_user_123456789",
    "session_id": "s_session_123456789",
    "properties": {
      "page_title": "Dashboard",
      "page_url": "https://app.example.com/dashboard",
      "category": "navigation"
    },
    "page": {
      "url": "https://app.example.com/dashboard",
      "title": "Dashboard",
      "path": "/dashboard"
    },
    "utm": {
      "source": "google",
      "medium": "cpc",
      "campaign": "brand_campaign"
    }
  }, null, 2));

  console.log('');
  console.log('2. TRACK EVENT (botão clicado):');
  console.log(JSON.stringify({
    "event_name": "button_clicked",
    "timestamp": new Date().toISOString(),
    "anonymous_id": "a_user_123456789",
    "session_id": "s_session_123456789",
    "properties": {
      "button_text": "Sign Up",
      "button_location": "header",
      "page_url": "https://app.example.com/landing"
    }
  }, null, 2));

  console.log('');
  console.log('3. IDENTIFY USER (com PII criptografado):');
  console.log(JSON.stringify({
    "anonymous_id": "a_user_123456789",
    "user_id": "usr_real_user_id_12345",
    "traits": {
      "email": "usuario@teste.com",
      "phone": "+5511999887766",
      "name": "João Silva",
      "company": "Empresa Teste"
    },
    "timestamp": new Date().toISOString()
  }, null, 2));

  console.log('');
  console.log('4. BATCH EVENTS:');
  console.log(JSON.stringify({
    "events": [
      {
        "event_name": "page_view",
        "timestamp": new Date().toISOString(),
        "anonymous_id": "a_user_123456789",
        "properties": { "page": "home" }
      },
      {
        "event_name": "button_clicked",
        "timestamp": new Date().toISOString(),
        "anonymous_id": "a_user_123456789",
        "properties": { "button": "cta" }
      }
    ]
  }, null, 2));

  console.log('');
  console.log('🚀 COMANDO CURL DE TESTE:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`curl -X POST http://localhost:3000/v1/events/track \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKeyValue}" \\
  -d '{
    "event_name": "page_view",
    "timestamp": "${new Date().toISOString()}",
    "anonymous_id": "a_test_user_001",
    "properties": {
      "page": "dashboard",
      "source": "test"
    }
  }'`);

  console.log('');
  console.log('⚠️  IMPORTANTE:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('• anonymous_id deve começar com "a_"');
  console.log('• session_id deve começar com "s_" (opcional)');
  console.log('• timestamp deve ser ISO 8601 válido');
  console.log('• Emails/telefones em traits são criptografados automaticamente');
  console.log('• Rate limit: 1000 requests/minuto para tier free');
  console.log('');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
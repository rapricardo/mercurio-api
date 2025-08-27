# 🏢 Tenant Management API

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Sprint**: Multi-tenant Architecture  
**Completed**: 2025-08-27

## 🎯 Overview

A Tenant Management API fornece controle completo sobre o sistema multi-tenant da aplicação Mercurio. Permite criação, gerenciamento e monitoramento de tenants com isolamento completo de dados, autenticação segura e administração granular de permissões.

### 🚀 Principais Benefícios

- **🏢 Multi-tenancy Segura**: Isolamento completo de dados entre tenants
- **🔐 Controle de Acesso**: Permissões granulares por tenant e usuário
- **📊 Administração Completa**: CRUD completo com filtros avançados
- **📈 Analytics Integrado**: Estatísticas e métricas por tenant
- **🔍 Audit Trail**: Rastreamento completo de alterações

---

## 📋 Endpoints Disponíveis

### 1. 📋 List All Tenants
**GET** `/v1/tenants`

Lista todos os tenants com filtros e paginação avançada.

**Parâmetros de Query**:
- `page`: Número da página (padrão: 1)
- `pageSize`: Itens por página (padrão: 20, máx: 100)  
- `search`: Busca por nome do tenant
- `status`: Filtrar por status (`active` | `inactive` | `suspended`)
- `plan`: Filtrar por plano de assinatura
- `sortBy`: Campo de ordenação (`name` | `createdAt` | `status`)
- `sortOrder`: Ordem (`asc` | `desc`, padrão: `desc`)
- `includeStats`: Incluir estatísticas (padrão: `false`)

**Response**:
```json
{
  "data": [
    {
      "id": "1",
      "name": "Acme Corporation",
      "domain": "acme-corp",
      "status": "active",
      "plan": "enterprise",
      "createdAt": "2025-08-20T10:30:15.123Z",
      "updatedAt": "2025-08-25T14:22:33.456Z",
      "settings": {
        "timezone": "America/Sao_Paulo",
        "currency": "BRL",
        "features": ["analytics", "funnels", "exports"]
      },
      "stats": {
        "workspaces": 5,
        "apiKeys": 12,
        "eventsLast30Days": 1250000,
        "storageUsedMB": 2340.5
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 156,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "meta": {
    "search": "acme",
    "sortBy": "createdAt",
    "sortOrder": "desc",
    "includeStats": true
  }
}
```

### 2. 🔍 Get Tenant by ID
**GET** `/v1/tenants/:tenantId`

Recupera detalhes completos de um tenant específico.

**Parâmetros**:
- `tenantId`: ID do tenant

**Response**:
```json
{
  "id": "1",
  "name": "Acme Corporation",
  "domain": "acme-corp",
  "status": "active",
  "plan": "enterprise",
  "createdAt": "2025-08-20T10:30:15.123Z",
  "updatedAt": "2025-08-25T14:22:33.456Z",
  "settings": {
    "timezone": "America/Sao_Paulo",
    "currency": "BRL",
    "language": "pt-BR",
    "features": ["analytics", "funnels", "exports", "realtime"],
    "limits": {
      "maxWorkspaces": 10,
      "maxApiKeys": 50,
      "maxEventsPerMonth": 10000000,
      "dataRetentionDays": 365
    }
  },
  "billing": {
    "billingEmail": "billing@acme-corp.com",
    "paymentMethod": "credit_card",
    "nextBillingDate": "2025-09-20T00:00:00.000Z",
    "subscriptionStatus": "active"
  },
  "stats": {
    "workspaces": 5,
    "apiKeys": 12,
    "eventsLast30Days": 1250000,
    "eventsCurrentMonth": 2340000,
    "storageUsedMB": 2340.5,
    "lastActivityAt": "2025-08-27T14:30:15.123Z"
  },
  "workspaces": [
    {
      "id": "1",
      "name": "Production",
      "description": "Production environment",
      "status": "active",
      "createdAt": "2025-08-20T10:45:22.789Z"
    }
  ]
}
```

### 3. ➕ Create New Tenant
**POST** `/v1/tenants`

Cria um novo tenant no sistema.

**Request Body**:
```json
{
  "name": "New Company Ltd",
  "domain": "new-company",
  "contactEmail": "admin@newcompany.com",
  "plan": "professional",
  "settings": {
    "timezone": "America/Sao_Paulo",
    "currency": "BRL",
    "language": "pt-BR",
    "features": ["analytics", "funnels"]
  },
  "billing": {
    "billingEmail": "billing@newcompany.com",
    "paymentMethod": "credit_card"
  }
}
```

**Response** (201):
```json
{
  "id": "157",
  "name": "New Company Ltd", 
  "domain": "new-company",
  "status": "active",
  "plan": "professional",
  "createdAt": "2025-08-27T15:30:15.123Z",
  "updatedAt": "2025-08-27T15:30:15.123Z",
  "settings": {
    "timezone": "America/Sao_Paulo",
    "currency": "BRL",
    "language": "pt-BR",
    "features": ["analytics", "funnels"],
    "limits": {
      "maxWorkspaces": 5,
      "maxApiKeys": 25,
      "maxEventsPerMonth": 1000000,
      "dataRetentionDays": 90
    }
  },
  "defaultWorkspace": {
    "id": "245",
    "name": "Default",
    "description": "Default workspace"
  }
}
```

### 4. ✏️ Update Tenant
**PATCH** `/v1/tenants/:tenantId`

Atualiza informações de um tenant existente.

**Parâmetros**:
- `tenantId`: ID do tenant

**Request Body** (campos opcionais):
```json
{
  "name": "Updated Company Name",
  "status": "suspended",
  "settings": {
    "features": ["analytics", "funnels", "exports"],
    "limits": {
      "maxEventsPerMonth": 5000000
    }
  },
  "billing": {
    "billingEmail": "new-billing@company.com"
  }
}
```

**Response** (200):
```json
{
  "id": "1",
  "name": "Updated Company Name",
  "status": "suspended",
  "updatedAt": "2025-08-27T15:45:22.456Z",
  "changes": [
    {
      "field": "name",
      "oldValue": "Old Company Name", 
      "newValue": "Updated Company Name"
    },
    {
      "field": "status",
      "oldValue": "active",
      "newValue": "suspended"
    }
  ]
}
```

### 5. 🗑️ Delete Tenant
**DELETE** `/v1/tenants/:tenantId`

Soft delete de um tenant (arquivamento seguro).

**Parâmetros**:
- `tenantId`: ID do tenant

**Response** (200):
```json
{
  "id": "1",
  "name": "Archived Company",
  "status": "deleted",
  "deletedAt": "2025-08-27T15:50:15.789Z",
  "dataRetentionUntil": "2025-11-27T15:50:15.789Z",
  "backupInfo": {
    "backupId": "backup_20250827_tenant_1",
    "expiresAt": "2025-11-27T15:50:15.789Z"
  }
}
```

---

## 🔐 Autenticação e Permissões

### Métodos de Autenticação Suportados

#### 1. API Key (Tenant-scoped)
```bash
curl -H "Authorization: Bearer tenant_api_key" \
     "http://localhost:3000/v1/tenants/1"
```
- **Escopo**: Apenas o tenant proprietário da API key
- **Permissões**: Baseadas no escopo da API key

#### 2. Supabase JWT (User-based)  
```bash
curl -H "Authorization: Bearer supabase_jwt_token" \
     "http://localhost:3000/v1/tenants"
```
- **Escopo**: Baseado nas permissões do usuário
- **Permissões**: Admin, Manager, ou View-only

### Níveis de Permissão

#### 🔴 Super Admin
- **Acesso**: Todos os tenants
- **Operações**: CREATE, READ, UPDATE, DELETE
- **Recursos especiais**: Billing, analytics agregadas

#### 🟡 Tenant Admin
- **Acesso**: Apenas seus tenants
- **Operações**: READ, UPDATE (limitado)
- **Recursos**: Configurações, usuários, workspaces

#### 🟢 API Key (tenant-scoped)
- **Acesso**: Apenas tenant proprietário
- **Operações**: READ (próprio tenant)
- **Recursos**: Informações básicas

---

## 🔧 Configuração e Setup

### Pré-requisitos
- ✅ PostgreSQL com schema multi-tenant
- ✅ Supabase configurado (opcional)
- ✅ Redis para cache (opcional)

### Variáveis de Ambiente
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mercurio

# Tenant Management
TENANT_DEFAULT_PLAN=starter              # Plano padrão
TENANT_MAX_PER_USER=5                   # Max tenants por usuário
TENANT_DOMAIN_VALIDATION=true           # Validar domínios únicos

# Features & Limits
FEATURE_ANALYTICS_ENABLED=true          # Analytics por padrão
FEATURE_FUNNELS_ENABLED=true           # Funnels por padrão
DEFAULT_DATA_RETENTION_DAYS=90          # Retenção padrão

# Billing Integration
BILLING_PROVIDER=stripe                 # stripe | manual
STRIPE_WEBHOOK_SECRET=whsec_...        # Stripe webhook
```

---

## 💡 Exemplos de Uso

### 1. Administração Básica
```bash
# Listar todos os tenants ativos
curl -H "Authorization: Bearer admin_token" \
     "http://localhost:3000/v1/tenants?status=active&includeStats=true"

# Buscar tenants por nome
curl -H "Authorization: Bearer admin_token" \
     "http://localhost:3000/v1/tenants?search=acme&pageSize=10"

# Obter detalhes completos de um tenant
curl -H "Authorization: Bearer admin_token" \
     "http://localhost:3000/v1/tenants/1"
```

### 2. Criação de Tenant
```bash
# Criar novo tenant enterprise
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer admin_token" \
     -d '{
       "name": "Enterprise Corp",
       "domain": "enterprise-corp",
       "contactEmail": "admin@enterprise.com",
       "plan": "enterprise",
       "settings": {
         "timezone": "America/New_York",
         "features": ["analytics", "funnels", "exports", "realtime"]
       }
     }' \
     "http://localhost:3000/v1/tenants"
```

### 3. Gerenciamento de Status
```bash
# Suspender tenant
curl -X PATCH \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer admin_token" \
     -d '{"status": "suspended"}' \
     "http://localhost:3000/v1/tenants/1"

# Reativar tenant
curl -X PATCH \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer admin_token" \
     -d '{"status": "active"}' \
     "http://localhost:3000/v1/tenants/1"
```

### 4. Upgrade de Plano
```bash
# Upgrade para enterprise
curl -X PATCH \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer admin_token" \
     -d '{
       "plan": "enterprise",
       "settings": {
         "features": ["analytics", "funnels", "exports", "realtime", "api_access"],
         "limits": {
           "maxEventsPerMonth": 10000000,
           "dataRetentionDays": 365
         }
       }
     }' \
     "http://localhost:3000/v1/tenants/1"
```

---

## 📊 Tenant Analytics

### Métricas Disponíveis
- **Eventos**: Total de eventos dos últimos 30 dias
- **Storage**: Uso de armazenamento em MB
- **Workspaces**: Número de workspaces ativos
- **API Keys**: Número de chaves ativas
- **Última Atividade**: Timestamp da última atividade

### Dashboard de Admin
```bash
# Obter estatísticas agregadas
curl -H "Authorization: Bearer admin_token" \
     "http://localhost:3000/v1/tenants?includeStats=true&pageSize=100" | \
     jq '.data | map({name, plan, eventsLast30Days: .stats.eventsLast30Days}) | sort_by(.eventsLast30Days) | reverse'
```

---

## 🛠️ Troubleshooting

### Problemas Comuns

#### 1. Tenant Not Found (404)
**Causa**: Tenant não existe ou usuário sem permissão
**Solução**:
```bash
# Verificar se tenant existe
curl -H "Authorization: Bearer admin_token" \
     "http://localhost:3000/v1/tenants" | jq '.data[] | select(.id == "1")'
```

#### 2. Domain Already Exists (409)  
**Causa**: Domain já está em uso por outro tenant
**Solução**:
```bash
# Listar tenants com domínio similar
curl -H "Authorization: Bearer admin_token" \
     "http://localhost:3000/v1/tenants?search=domain-name"
```

#### 3. Insufficient Permissions (403)
**Causa**: API key ou usuário sem permissões adequadas
**Diagnóstico**:
```bash
# Verificar permissões da API key
curl -H "Authorization: Bearer api_key" \
     "http://localhost:3000/v1/auth/me"
```

#### 4. Plan Limits Exceeded
**Causa**: Tenant excedeu limites do plano atual
**Solução**: Upgrade de plano ou redução de uso
```bash
# Verificar limites atuais
curl -H "Authorization: Bearer admin_token" \
     "http://localhost:3000/v1/tenants/1" | jq '.settings.limits'
```

---

## 📚 Recursos Adicionais

### Links Úteis
- **Workspace Management**: [Workspace API docs](/docs/features/workspaces/README.md)
- **Authentication Guide**: [Auth docs](/docs/features/authentication/hybrid-auth-guide.md)
- **Multi-tenant Architecture**: [Architecture docs](/docs/architecture/tenancy.md)

### Scripts de Administração
```bash
# Bulk tenant status update
./scripts/bulk-tenant-operation.sh suspend inactive-tenants.txt

# Tenant usage report  
./scripts/generate-tenant-report.sh --period 30d --format csv

# Tenant cleanup (soft delete old inactive tenants)
./scripts/cleanup-inactive-tenants.sh --days 90
```

### Integração com Billing
```javascript
// Webhook handler para Stripe
app.post('/webhooks/stripe', (req, res) => {
  const event = req.body;
  
  switch (event.type) {
    case 'customer.subscription.updated':
      updateTenantPlan(event.data.object.customer, event.data.object.plan);
      break;
    case 'customer.subscription.deleted':
      suspendTenant(event.data.object.customer);
      break;
  }
  
  res.json({ received: true });
});
```

---

**🏢 Tenant Management API - Versão 1.0.0**  
*Implementado com ❤️ pelo time Mercurio*
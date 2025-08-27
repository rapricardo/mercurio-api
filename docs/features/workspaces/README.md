# 🏗️ Workspace Management API

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Sprint**: Multi-tenant Architecture  
**Completed**: 2025-08-27

## 🎯 Overview

A Workspace Management API fornece controle granular sobre os workspaces dentro de cada tenant. Os workspaces representam ambientes isolados (produção, staging, desenvolvimento) permitindo segregação completa de dados, configurações e permissões dentro do mesmo tenant.

### 🚀 Principais Benefícios

- **🏗️ Isolamento por Ambiente**: Separação completa entre prod/staging/dev
- **🔐 Permissões Granulares**: Controle de acesso por workspace 
- **📊 Analytics Independentes**: Métricas isoladas por workspace
- **🔑 API Keys Específicas**: Chaves dedicadas por workspace
- **⚙️ Configurações Flexíveis**: Settings independentes por ambiente

---

## 📋 Endpoints Disponíveis

### 1. 📋 List Tenant Workspaces
**GET** `/v1/tenants/:tenantId/workspaces`

Lista todos os workspaces de um tenant com filtros e paginação.

**Parâmetros de Path**:
- `tenantId`: ID do tenant

**Parâmetros de Query**:
- `page`: Número da página (padrão: 1)
- `pageSize`: Itens por página (padrão: 20, máx: 100)
- `search`: Busca por nome do workspace
- `status`: Filtrar por status (`active` | `inactive` | `archived`)
- `environment`: Filtrar por tipo (`production` | `staging` | `development`)
- `sortBy`: Campo de ordenação (`name` | `createdAt` | `status`)
- `sortOrder`: Ordem (`asc` | `desc`, padrão: `desc`)
- `includeStats`: Incluir estatísticas (padrão: `false`)

**Response**:
```json
{
  "data": [
    {
      "id": "1",
      "tenantId": "1",
      "name": "Production",
      "description": "Production environment for live traffic",
      "environment": "production",
      "status": "active",
      "createdAt": "2025-08-20T10:30:15.123Z",
      "updatedAt": "2025-08-25T14:22:33.456Z",
      "settings": {
        "timezone": "America/Sao_Paulo",
        "dataRetentionDays": 365,
        "features": ["analytics", "funnels", "realtime"],
        "apiRateLimit": {
          "requestsPerMinute": 10000,
          "burstLimit": 20000
        }
      },
      "stats": {
        "apiKeys": 8,
        "eventsLast30Days": 850000,
        "averageEventsPerDay": 28333,
        "storageUsedMB": 1240.5,
        "lastActivityAt": "2025-08-27T14:30:15.123Z"
      }
    },
    {
      "id": "2", 
      "tenantId": "1",
      "name": "Staging",
      "description": "Staging environment for testing",
      "environment": "staging",
      "status": "active",
      "createdAt": "2025-08-20T11:15:22.789Z",
      "updatedAt": "2025-08-22T09:10:45.321Z",
      "settings": {
        "timezone": "America/Sao_Paulo",
        "dataRetentionDays": 90,
        "features": ["analytics", "funnels"],
        "apiRateLimit": {
          "requestsPerMinute": 1000,
          "burstLimit": 2000
        }
      },
      "stats": {
        "apiKeys": 3,
        "eventsLast30Days": 45000,
        "averageEventsPerDay": 1500,
        "storageUsedMB": 67.8
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 5,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": {
    "tenantId": "1",
    "sortBy": "createdAt",
    "sortOrder": "desc",
    "includeStats": true
  }
}
```

### 2. 🔍 Get Workspace by ID
**GET** `/v1/tenants/:tenantId/workspaces/:workspaceId`

Recupera detalhes completos de um workspace específico.

**Parâmetros**:
- `tenantId`: ID do tenant
- `workspaceId`: ID do workspace

**Response**:
```json
{
  "id": "1",
  "tenantId": "1",
  "name": "Production",
  "description": "Production environment for live traffic",
  "environment": "production", 
  "status": "active",
  "createdAt": "2025-08-20T10:30:15.123Z",
  "updatedAt": "2025-08-25T14:22:33.456Z",
  "settings": {
    "timezone": "America/Sao_Paulo",
    "dataRetentionDays": 365,
    "features": ["analytics", "funnels", "realtime", "exports"],
    "apiRateLimit": {
      "requestsPerMinute": 10000,
      "burstLimit": 20000,
      "dailyLimit": 10000000
    },
    "security": {
      "ipWhitelist": ["203.0.113.0/24", "198.51.100.0/24"],
      "allowedOrigins": ["https://myapp.com", "https://admin.myapp.com"],
      "enforceHttps": true
    },
    "integrations": {
      "webhooks": {
        "enabled": true,
        "url": "https://api.myapp.com/webhooks/mercurio",
        "events": ["event.received", "funnel.completed"]
      }
    }
  },
  "limits": {
    "maxApiKeys": 20,
    "maxEventsPerMonth": 5000000,
    "maxFunnels": 50,
    "maxExportsPerDay": 10
  },
  "stats": {
    "apiKeys": 8,
    "activeFunnels": 12,
    "eventsLast30Days": 850000,
    "eventsCurrentMonth": 1200000,
    "averageEventsPerDay": 28333,
    "storageUsedMB": 1240.5,
    "lastActivityAt": "2025-08-27T14:30:15.123Z",
    "topEvents": [
      {"name": "page_view", "count": 450000},
      {"name": "button_click", "count": 285000},
      {"name": "form_submit", "count": 115000}
    ]
  },
  "apiKeys": [
    {
      "id": "1",
      "name": "Production Frontend",
      "keyPreview": "ak_prod_****",
      "scopes": ["events:write", "analytics:read"],
      "status": "active",
      "lastUsedAt": "2025-08-27T14:15:33.789Z"
    }
  ]
}
```

### 3. ➕ Create New Workspace
**POST** `/v1/tenants/:tenantId/workspaces`

Cria um novo workspace dentro de um tenant.

**Parâmetros**:
- `tenantId`: ID do tenant

**Request Body**:
```json
{
  "name": "Development",
  "description": "Development environment for testing new features",
  "environment": "development",
  "settings": {
    "timezone": "America/Sao_Paulo",
    "dataRetentionDays": 30,
    "features": ["analytics", "funnels"],
    "apiRateLimit": {
      "requestsPerMinute": 500,
      "burstLimit": 1000
    }
  }
}
```

**Response** (201):
```json
{
  "id": "6",
  "tenantId": "1", 
  "name": "Development",
  "description": "Development environment for testing new features",
  "environment": "development",
  "status": "active",
  "createdAt": "2025-08-27T15:30:15.123Z",
  "updatedAt": "2025-08-27T15:30:15.123Z",
  "settings": {
    "timezone": "America/Sao_Paulo",
    "dataRetentionDays": 30,
    "features": ["analytics", "funnels"],
    "apiRateLimit": {
      "requestsPerMinute": 500,
      "burstLimit": 1000,
      "dailyLimit": 100000
    }
  },
  "limits": {
    "maxApiKeys": 10,
    "maxEventsPerMonth": 100000,
    "maxFunnels": 10,
    "maxExportsPerDay": 2
  },
  "defaultApiKey": {
    "id": "25",
    "name": "Default Development Key",
    "keyPreview": "ak_dev_****",
    "scopes": ["events:write", "analytics:read"]
  }
}
```

### 4. ✏️ Update Workspace
**PATCH** `/v1/tenants/:tenantId/workspaces/:workspaceId`

Atualiza configurações de um workspace existente.

**Parâmetros**:
- `tenantId`: ID do tenant  
- `workspaceId`: ID do workspace

**Request Body** (campos opcionais):
```json
{
  "name": "Updated Production",
  "description": "Updated production environment",
  "settings": {
    "dataRetentionDays": 730,
    "features": ["analytics", "funnels", "realtime", "exports", "advanced_analytics"],
    "apiRateLimit": {
      "requestsPerMinute": 15000,
      "burstLimit": 30000
    },
    "security": {
      "ipWhitelist": ["203.0.113.0/24"],
      "enforceHttps": true
    }
  }
}
```

**Response** (200):
```json
{
  "id": "1",
  "tenantId": "1",
  "name": "Updated Production", 
  "description": "Updated production environment",
  "updatedAt": "2025-08-27T15:45:22.456Z",
  "changes": [
    {
      "field": "name",
      "oldValue": "Production",
      "newValue": "Updated Production"
    },
    {
      "field": "settings.dataRetentionDays", 
      "oldValue": 365,
      "newValue": 730
    },
    {
      "field": "settings.features",
      "oldValue": ["analytics", "funnels", "realtime"],
      "newValue": ["analytics", "funnels", "realtime", "exports", "advanced_analytics"]
    }
  ]
}
```

### 5. 🗑️ Delete Workspace
**DELETE** `/v1/tenants/:tenantId/workspaces/:workspaceId`

Soft delete de um workspace (arquivamento seguro).

**Parâmetros**:
- `tenantId`: ID do tenant
- `workspaceId`: ID do workspace

**Response** (200):
```json
{
  "id": "6",
  "tenantId": "1",
  "name": "Development",
  "status": "archived",
  "archivedAt": "2025-08-27T15:50:15.789Z",
  "dataRetentionUntil": "2025-09-27T15:50:15.789Z",
  "backupInfo": {
    "backupId": "workspace_backup_20250827_6",
    "eventsBackedUp": 15450,
    "expiresAt": "2025-09-27T15:50:15.789Z"
  },
  "apiKeysStatus": {
    "total": 3,
    "revoked": 3,
    "revokedAt": "2025-08-27T15:50:15.789Z"
  }
}
```

---

## 🔐 Autenticação e Permissões

### Métodos de Autenticação Suportados

#### 1. API Key (Workspace-scoped)
```bash
curl -H "Authorization: Bearer workspace_api_key" \
     "http://localhost:3000/v1/tenants/1/workspaces/1"
```
- **Escopo**: Apenas o workspace proprietário da API key
- **Permissões**: Baseadas no escopo da API key

#### 2. Supabase JWT (User-based)
```bash
curl -H "Authorization: Bearer supabase_jwt_token" \
     "http://localhost:3000/v1/tenants/1/workspaces"
```
- **Escopo**: Baseado nas permissões do usuário no tenant
- **Permissões**: Admin, Manager, ou View-only

### Níveis de Permissão

#### 🔴 Tenant Admin
- **Acesso**: Todos os workspaces do tenant
- **Operações**: CREATE, READ, UPDATE, DELETE
- **Recursos**: Configurações, API keys, analytics

#### 🟡 Workspace Manager
- **Acesso**: Workspaces específicos
- **Operações**: READ, UPDATE (configurações limitadas)
- **Recursos**: Analytics, configurações básicas

#### 🟢 API Key (workspace-scoped)
- **Acesso**: Apenas workspace proprietário  
- **Operações**: READ (próprio workspace)
- **Recursos**: Informações básicas, estatísticas

---

## 🔧 Configuração e Setup

### Pré-requisitos
- ✅ Tenant válido existente
- ✅ Permissões adequadas no tenant
- ✅ Limites do plano respeitados

### Variáveis de Ambiente
```bash
# Workspace Defaults
WORKSPACE_DEFAULT_RETENTION_DAYS=90     # Retenção padrão
WORKSPACE_DEFAULT_RATE_LIMIT=1000       # Rate limit padrão/min
WORKSPACE_MAX_PER_TENANT=10             # Max workspaces por tenant

# Environment Types
WORKSPACE_PROD_MIN_RETENTION=365        # Min retenção para prod
WORKSPACE_DEV_MAX_RETENTION=30          # Max retenção para dev

# Features & Limits
WORKSPACE_DEFAULT_FEATURES="analytics,events"  # Features padrão
WORKSPACE_MAX_API_KEYS=50               # Max API keys por workspace
```

### Workspace Templates por Ambiente

#### Production Template
```json
{
  "settings": {
    "dataRetentionDays": 365,
    "features": ["analytics", "funnels", "realtime", "exports"],
    "apiRateLimit": {
      "requestsPerMinute": 10000,
      "burstLimit": 20000,
      "dailyLimit": 10000000
    },
    "security": {
      "enforceHttps": true,
      "ipWhitelist": []
    }
  },
  "limits": {
    "maxApiKeys": 20,
    "maxFunnels": 100,
    "maxExportsPerDay": 50
  }
}
```

#### Staging Template
```json
{
  "settings": {
    "dataRetentionDays": 90,
    "features": ["analytics", "funnels"],
    "apiRateLimit": {
      "requestsPerMinute": 2000,
      "burstLimit": 5000,
      "dailyLimit": 1000000  
    }
  },
  "limits": {
    "maxApiKeys": 10,
    "maxFunnels": 20,
    "maxExportsPerDay": 10
  }
}
```

#### Development Template
```json
{
  "settings": {
    "dataRetentionDays": 30,
    "features": ["analytics"],
    "apiRateLimit": {
      "requestsPerMinute": 500,
      "burstLimit": 1000,
      "dailyLimit": 100000
    }
  },
  "limits": {
    "maxApiKeys": 5,
    "maxFunnels": 5,
    "maxExportsPerDay": 2
  }
}
```

---

## 💡 Exemplos de Uso

### 1. Gerenciamento Básico
```bash
# Listar workspaces de um tenant
curl -H "Authorization: Bearer tenant_admin_token" \
     "http://localhost:3000/v1/tenants/1/workspaces?includeStats=true"

# Buscar workspace específico
curl -H "Authorization: Bearer tenant_admin_token" \
     "http://localhost:3000/v1/tenants/1/workspaces?search=production"

# Obter detalhes completos
curl -H "Authorization: Bearer tenant_admin_token" \
     "http://localhost:3000/v1/tenants/1/workspaces/1"
```

### 2. Criação de Ambientes
```bash
# Criar workspace de staging
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer tenant_admin_token" \
     -d '{
       "name": "Staging Environment",
       "description": "Testing environment before production",
       "environment": "staging",
       "settings": {
         "dataRetentionDays": 90,
         "features": ["analytics", "funnels"]
       }
     }' \
     "http://localhost:3000/v1/tenants/1/workspaces"
```

### 3. Configuração de Produção
```bash
# Configurar workspace de produção com segurança
curl -X PATCH \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer tenant_admin_token" \
     -d '{
       "settings": {
         "security": {
           "ipWhitelist": ["203.0.113.0/24"],
           "allowedOrigins": ["https://myapp.com"],
           "enforceHttps": true
         },
         "apiRateLimit": {
           "requestsPerMinute": 15000,
           "burstLimit": 30000
         }
       }
     }' \
     "http://localhost:3000/v1/tenants/1/workspaces/1"
```

### 4. Monitoramento de Usage  
```bash
# Monitorar uso de todos os workspaces
curl -H "Authorization: Bearer tenant_admin_token" \
     "http://localhost:3000/v1/tenants/1/workspaces?includeStats=true" | \
     jq '.data[] | {name, environment, eventsLast30Days: .stats.eventsLast30Days, storageUsedMB: .stats.storageUsedMB}'

# Verificar workspace próximo dos limites
curl -H "Authorization: Bearer tenant_admin_token" \
     "http://localhost:3000/v1/tenants/1/workspaces/1" | \
     jq '{
       name, 
       usage: .stats.eventsCurrentMonth, 
       limit: .limits.maxEventsPerMonth,
       percentage: (.stats.eventsCurrentMonth / .limits.maxEventsPerMonth * 100)
     }'
```

---

## 🏗️ Workspace Environments

### Environment Types

#### 🔴 Production
- **Características**: Dados reais, alta disponibilidade, backups automáticos
- **Retenção**: 365 dias (mínimo) 
- **Rate Limits**: Altos limites para tráfego real
- **Features**: Todas as features disponíveis
- **Security**: IP whitelist, HTTPS obrigatório

#### 🟡 Staging  
- **Características**: Testes pre-prod, dados sintéticos, espelho da produção
- **Retenção**: 90 dias
- **Rate Limits**: Médios, adequados para testes
- **Features**: Maioria das features
- **Security**: Configurações flexíveis

#### 🟢 Development
- **Características**: Desenvolvimento, testes, dados mock
- **Retenção**: 30 dias
- **Rate Limits**: Baixos, adequados para dev
- **Features**: Features básicas
- **Security**: Configurações mínimas

### Workspace Isolation

Cada workspace tem **isolamento completo**:
- **Dados**: Events, analytics, funnels separados
- **API Keys**: Chaves específicas por workspace
- **Configurações**: Settings independentes
- **Limites**: Quotas dedicadas
- **Backup**: Políticas de backup separadas

---

## 📊 Workspace Analytics

### Métricas Disponíveis por Workspace
- **Events**: Total de eventos (último mês, mês atual)
- **Storage**: Uso de armazenamento específico
- **API Usage**: Requests por API key
- **Top Events**: Rankings de eventos mais frequentes
- **Performance**: Latências médias de ingestão

### Monitoring Cross-Workspace
```bash
# Comparar performance entre ambientes
curl -H "Authorization: Bearer tenant_admin_token" \
     "http://localhost:3000/v1/tenants/1/workspaces?includeStats=true" | \
     jq '.data | map({
       name, 
       environment, 
       eventsPerDay: (.stats.eventsLast30Days / 30),
       avgEventsPerDay: .stats.averageEventsPerDay
     }) | sort_by(.eventsPerDay) | reverse'
```

---

## 🛠️ Troubleshooting

### Problemas Comuns

#### 1. Workspace Limit Exceeded
**Erro**: "Maximum workspaces per tenant exceeded"
**Solução**:
```bash
# Verificar limite atual
curl -H "Authorization: Bearer tenant_admin_token" \
     "http://localhost:3000/v1/tenants/1" | jq '.settings.limits.maxWorkspaces'

# Listar workspaces para cleanup
curl -H "Authorization: Bearer tenant_admin_token" \
     "http://localhost:3000/v1/tenants/1/workspaces?status=inactive"
```

#### 2. API Key Access Denied
**Erro**: 403 Forbidden ao tentar acessar workspace
**Diagnóstico**:
```bash
# Verificar escopo da API key
curl -H "Authorization: Bearer api_key" \
     "http://localhost:3000/v1/auth/me" | jq '.workspace'
```

#### 3. Rate Limit Exceeded
**Erro**: 429 Too Many Requests
**Solução**: Verificar e ajustar rate limits
```bash
# Ver configurações de rate limit
curl -H "Authorization: Bearer admin_token" \
     "http://localhost:3000/v1/tenants/1/workspaces/1" | jq '.settings.apiRateLimit'
```

#### 4. Storage Limit Approaching
**Warning**: Workspace próximo do limite de storage
**Monitoring**:
```bash
# Monitor storage usage
curl -H "Authorization: Bearer admin_token" \
     "http://localhost:3000/v1/tenants/1/workspaces?includeStats=true" | \
     jq '.data[] | select(.stats.storageUsedMB > 1000) | {name, storageUsedMB: .stats.storageUsedMB}'
```

---

## 📚 Recursos Adicionais

### Links Úteis
- **Tenant Management**: [Tenant API docs](/docs/features/tenants/README.md)
- **API Keys Management**: [API Keys docs](/docs/features/authentication/hybrid-auth-guide.md)
- **Analytics per Workspace**: [Analytics docs](/docs/features/analytics/README.md)

### Scripts de Administração
```bash
# Bulk workspace creation
./scripts/create-workspace-environments.sh tenant-1 production,staging,development

# Workspace usage report
./scripts/workspace-usage-report.sh --tenant 1 --period 30d

# Cleanup inactive workspaces  
./scripts/cleanup-inactive-workspaces.sh --days 60
```

### Automation Examples
```javascript
// Auto-create environments for new tenant
async function createDefaultWorkspaces(tenantId) {
  const environments = [
    { name: 'Production', environment: 'production', template: 'prod' },
    { name: 'Staging', environment: 'staging', template: 'staging' }, 
    { name: 'Development', environment: 'development', template: 'dev' }
  ];
  
  for (const env of environments) {
    await createWorkspace(tenantId, {
      name: env.name,
      environment: env.environment,
      settings: getTemplateSettings(env.template)
    });
  }
}
```

### Monitoring Integration
```javascript
// Monitor workspace limits
setInterval(async () => {
  const workspaces = await getWorkspacesWithStats();
  
  workspaces.forEach(workspace => {
    const usage = workspace.stats.eventsCurrentMonth;
    const limit = workspace.limits.maxEventsPerMonth;
    const percentage = (usage / limit) * 100;
    
    if (percentage > 80) {
      sendAlert(`Workspace ${workspace.name} at ${percentage}% of event limit`);
    }
  });
}, 60000 * 60); // Every hour
```

---

**🏗️ Workspace Management API - Versão 1.0.0**  
*Implementado com ❤️ pelo time Mercurio*
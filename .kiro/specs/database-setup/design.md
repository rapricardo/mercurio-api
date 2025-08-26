# Design Document

## Overview

Este documento detalha o design do sistema de banco de dados do Mercurio, incluindo a estrutura de migrações, convenções de nomenclatura, schema das tabelas principais e estratégias de indexação. O design prioriza performance, escalabilidade e facilidade de manutenção, utilizando IDs compactos (BIGINT) ao invés de UUIDs para melhor eficiência.

## Architecture

### Migration System
- **Ferramenta**: Prisma como ORM principal com migrações SQL nativas
- **Estrutura**: Arquivos de migração em `apps/api/prisma/migrations/`
- **Nomenclatura**: `YYYYMMDD_HHMMSS_descricao_da_mudanca/migration.sql`
- **Versionamento**: Controle via Prisma com tabela `_prisma_migrations`
- **Rollback**: Suporte a down migrations quando necessário

### ID Strategy
- **Tipo**: BIGINT auto-increment para PKs internas
- **Prefixos externos**: 
  - `tn_` para tenants
  - `ws_` para workspaces  
  - `ld_` para leads
  - `a_` para anonymous_ids (gerados client-side)
  - `s_` para sessions
- **Formato**: Prefixo + ID numérico (ex: `tn_123`, `ws_456`)

### Multi-tenancy
- **Isolamento**: Lógico via `tenant_id` + `workspace_id` em todas as tabelas
- **Índices**: Sempre começam com `(tenant_id, workspace_id, ...)`
- **Queries**: Row Level Security (RLS) ou filtros obrigatórios na aplicação

## Components and Interfaces

### Core Tables

#### Tenancy & Auth
```sql
-- Tenant principal
tenant (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Workspace dentro do tenant
workspace (
  id BIGINT PRIMARY KEY,
  tenant_id BIGINT REFERENCES tenant(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chaves de API por workspace
api_key (
  id BIGINT PRIMARY KEY,
  workspace_id BIGINT REFERENCES workspace(id),
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL, -- bcrypt hash
  scopes JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP
);
```

#### Identity System
```sql
-- Visitantes anônimos
visitor (
  anonymous_id VARCHAR(50) PRIMARY KEY, -- client-generated: a_xxxxx
  tenant_id BIGINT NOT NULL,
  workspace_id BIGINT NOT NULL,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  first_utm JSONB,
  last_utm JSONB,
  last_device JSONB,
  last_geo JSONB
);

-- Leads identificados
lead (
  id BIGINT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  workspace_id BIGINT NOT NULL,
  email_enc TEXT, -- encrypted
  email_fingerprint VARCHAR(64), -- HMAC-SHA256 for matching
  phone_enc TEXT, -- encrypted  
  phone_fingerprint VARCHAR(64), -- HMAC-SHA256 for matching
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Vínculo entre anonymous e lead
identity_link (
  tenant_id BIGINT NOT NULL,
  workspace_id BIGINT NOT NULL,
  anonymous_id VARCHAR(50) NOT NULL,
  lead_id BIGINT NOT NULL,
  first_at TIMESTAMP DEFAULT NOW(),
  last_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (tenant_id, workspace_id, anonymous_id, lead_id)
);
```

#### Events & Sessions
```sql
-- Sessões de usuário
session (
  session_id VARCHAR(50) PRIMARY KEY, -- client-generated: s_xxxxx
  tenant_id BIGINT NOT NULL,
  workspace_id BIGINT NOT NULL,
  anonymous_id VARCHAR(50) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  user_agent TEXT
);

-- Eventos capturados
event (
  id BIGINT PRIMARY KEY,
  schema_version VARCHAR(10) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  tenant_id BIGINT NOT NULL,
  workspace_id BIGINT NOT NULL,
  anonymous_id VARCHAR(50) NOT NULL,
  lead_id BIGINT,
  session_id VARCHAR(50),
  page JSONB,
  utm JSONB,
  device JSONB,
  geo JSONB,
  props JSONB,
  ingested_at TIMESTAMP DEFAULT NOW()
);
```

#### Funnel System
```sql
-- Funis principais
funnel (
  id BIGINT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  workspace_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by BIGINT, -- user_id quando implementado
  created_at TIMESTAMP DEFAULT NOW(),
  archived_at TIMESTAMP
);

-- Versões de funil (draft/published)
funnel_version (
  id BIGINT PRIMARY KEY,
  funnel_id BIGINT REFERENCES funnel(id),
  version INTEGER NOT NULL,
  state VARCHAR(20) DEFAULT 'draft', -- draft, published
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Publicações (snapshots imutáveis)
funnel_publication (
  id BIGINT PRIMARY KEY,
  funnel_id BIGINT REFERENCES funnel(id),
  version INTEGER NOT NULL,
  published_at TIMESTAMP DEFAULT NOW(),
  window_days INTEGER DEFAULT 7,
  notes TEXT
);

-- Steps do funil
funnel_step (
  id BIGINT PRIMARY KEY,
  funnel_version_id BIGINT REFERENCES funnel_version(id),
  order_index INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL, -- start, page, event, decision, conversion
  label VARCHAR(255) NOT NULL,
  metadata JSONB
);

-- Regras de matching por step
funnel_step_match (
  id BIGINT PRIMARY KEY,
  funnel_step_id BIGINT REFERENCES funnel_step(id),
  kind VARCHAR(20) NOT NULL, -- page, event
  rules JSONB NOT NULL -- { url_match, event_name, prop_filters, etc }
);
```

## Data Models

### JSON Structures

#### UTM Object
```json
{
  "source": "google",
  "medium": "cpc", 
  "campaign": "verao",
  "term": "analytics",
  "content": "ad1"
}
```

#### Device Object
```json
{
  "user_agent": "Mozilla/5.0...",
  "os": "iOS",
  "browser": "Safari",
  "device_type": "mobile"
}
```

#### Page Object
```json
{
  "url": "https://site.com/page",
  "path": "/page",
  "referrer": "https://google.com",
  "title": "Page Title"
}
```

#### Geo Object
```json
{
  "country": "BR",
  "region": "SP", 
  "city": "São Paulo"
}
```

#### Funnel Step Rules
```json
{
  "url_match": {
    "type": "exact|contains|regex",
    "value": "/checkout"
  },
  "event_name": "purchase",
  "prop_filters": [
    {
      "key": "value",
      "operator": "gte",
      "value": 100
    }
  ]
}
```

## Error Handling

### Migration Errors
- **Syntax errors**: Validação prévia via dry-run
- **Constraint violations**: Rollback automático
- **Timeout**: Configuração de timeout por migração
- **Dependency issues**: Verificação de ordem de execução

### Data Integrity
- **Foreign key constraints**: Cascade deletes onde apropriado
- **Check constraints**: Validação de enums e ranges
- **Unique constraints**: Prevenção de duplicatas
- **Not null constraints**: Campos obrigatórios

## Testing Strategy

### Migration Testing
- **Unit tests**: Validação de cada migração individualmente
- **Integration tests**: Teste de sequência completa de migrações
- **Rollback tests**: Verificação de down migrations
- **Performance tests**: Tempo de execução em datasets grandes

### Schema Testing
- **Constraint tests**: Verificação de todas as constraints
- **Index tests**: Validação de performance de queries
- **Data integrity tests**: Testes de consistência referencial
- **Multi-tenancy tests**: Isolamento entre tenants

### Prisma Integration
- **Schema validation**: Verificação do schema.prisma
- **Client generation**: Testes de geração do cliente
- **Query tests**: Validação de queries geradas
- **Type safety**: Verificação de tipos TypeScript
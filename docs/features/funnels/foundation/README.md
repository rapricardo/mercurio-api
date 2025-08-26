# 🔄 Funnel Analysis Foundation - Phase 1

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Sprint**: Funnel Analysis Endpoints - Phase 1 Foundation  
**Completed**: 2025-08-26

## 🎯 Overview

A **Funnel Analysis Foundation** implementa a infraestrutura completa para análise de funis de conversão com configuração CRUD robusta, sistema de cache inteligente e arquitetura multi-tenant. Esta é a Fase 1 de um sistema completo de análise de funis que suportará recursos avançados como analytics em tempo real, análise de coorte e atribuição multi-canal.

### 🚀 Principais Benefícios

- **🏗️ Fundação Sólida**: Infraestrutura completa pronta para expansão
- **⚡ Performance Otimizada**: Índices especializados + caching multi-layer
- **🔒 Multi-tenant Seguro**: Isolamento completo de dados por tenant/workspace  
- **📝 CRUD Completo**: 5 endpoints para gestão completa de configuração
- **🔄 Versionamento**: Sistema robusto de versões e publicações

---

## 📋 Endpoints Implementados

### 1. 🆕 Create Funnel
**POST** `/v1/analytics/funnels`

Criar nova configuração de funil com steps e regras de matching.

**Request**:
```json
{
  "name": "E-commerce Checkout Funnel",
  "description": "Main conversion funnel for purchase flow",
  "time_window_days": 7,
  "steps": [
    {
      "order": 0,
      "type": "start",
      "label": "Product Page Visit",
      "matching_rules": [
        {
          "kind": "page",
          "rules": {
            "url_match": "/product/*",
            "exact": false
          }
        }
      ]
    },
    {
      "order": 1,
      "type": "event",
      "label": "Add to Cart",
      "matching_rules": [
        {
          "kind": "event",
          "rules": {
            "event_name": "add_to_cart"
          }
        }
      ]
    },
    {
      "order": 2,
      "type": "conversion",
      "label": "Purchase Complete",
      "matching_rules": [
        {
          "kind": "event",
          "rules": {
            "event_name": "purchase_completed"
          }
        }
      ]
    }
  ]
}
```

**Response**:
```json
{
  "id": "fnl_1234567890",
  "name": "E-commerce Checkout Funnel", 
  "description": "Main conversion funnel for purchase flow",
  "created_at": "2025-08-26T10:30:00.000Z",
  "version_id": "fv_1234567890",
  "version": 1,
  "state": "draft",
  "step_count": 3,
  "message": "Funnel created successfully"
}
```

### 2. 📋 List Funnels
**GET** `/v1/analytics/funnels`

Listar funis com paginação e filtros.

**Query Parameters**:
- `page`: Número da página (padrão: 1)
- `limit`: Itens por página (padrão: 20, máx: 100)
- `search`: Busca por nome/descrição
- `state`: Filtrar por estado (`draft`, `published`)
- `include_archived`: Incluir arquivados (padrão: false)

**Response**:
```json
{
  "funnels": [
    {
      "id": "fnl_1234567890",
      "name": "E-commerce Checkout Funnel",
      "description": "Main conversion funnel for purchase flow",
      "created_at": "2025-08-26T10:30:00.000Z",
      "current_version": 1,
      "current_state": "draft",
      "step_count": 3,
      "versions": [...],
      "publications": [...]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_count": 5,
    "total_pages": 1,
    "has_next_page": false,
    "has_previous_page": false
  },
  "summary": {
    "total_funnels": 5,
    "draft_funnels": 3,
    "published_funnels": 2,
    "archived_funnels": 0
  }
}
```

### 3. 🔍 Get Funnel by ID
**GET** `/v1/analytics/funnels/:id`

Obter detalhes completos de um funil específico.

**Response**:
```json
{
  "id": "fnl_1234567890",
  "name": "E-commerce Checkout Funnel",
  "description": "Main conversion funnel for purchase flow",
  "created_at": "2025-08-26T10:30:00.000Z",
  "current_version": 1,
  "current_state": "draft",
  "step_count": 3,
  "versions": [
    {
      "id": "fv_1234567890",
      "version": 1,
      "state": "draft",
      "created_at": "2025-08-26T10:30:00.000Z",
      "steps": [
        {
          "id": "fs_1234567890",
          "order": 0,
          "type": "start",
          "label": "Product Page Visit",
          "matching_rules": [
            {
              "kind": "page",
              "rules": {
                "url_match": "/product/*",
                "exact": false
              }
            }
          ]
        }
      ]
    }
  ],
  "publications": []
}
```

### 4. ✏️ Update Funnel
**PATCH** `/v1/analytics/funnels/:id`

Atualizar configuração do funil (cria nova versão se steps forem modificados).

**Request**:
```json
{
  "name": "Updated E-commerce Funnel",
  "description": "Updated description",
  "steps": [
    // Nova configuração de steps (opcional)
  ]
}
```

**Response**:
```json
{
  "id": "fnl_1234567890",
  "name": "Updated E-commerce Funnel",
  "description": "Updated description", 
  "updated_at": "2025-08-26T11:00:00.000Z",
  "new_version_id": "fv_1234567891",
  "new_version": 2,
  "state": "draft",
  "step_count": 3,
  "message": "Funnel updated successfully"
}
```

### 5. 🗑️ Archive Funnel
**DELETE** `/v1/analytics/funnels/:id`

Arquivar funil (soft delete - pode ser restaurado).

**Response**:
```json
{
  "id": "fnl_1234567890",
  "name": "E-commerce Checkout Funnel",
  "archived_at": "2025-08-26T11:30:00.000Z",
  "message": "Funnel archived successfully"
}
```

### 6. 🚀 Publish Funnel (Bonus)
**POST** `/v1/analytics/funnels/:id/publish`

Publicar uma versão específica do funil.

**Query Parameters**:
- `version`: Versão a publicar (padrão: última versão)

**Request Body**:
```json
{
  "window_days": 7,
  "notes": "Production release v1.0"
}
```

**Response**:
```json
{
  "funnel_id": "fnl_1234567890",
  "publication_id": "fp_1234567890",
  "version": 1,
  "published_at": "2025-08-26T12:00:00.000Z",
  "window_days": 7,
  "notes": "Production release v1.0",
  "message": "Funnel published successfully"
}
```

---

## 🏗️ Arquitetura Implementada

### Database Schema Extensions

#### Tabela `funnel_user_state`
Nova tabela para tracking em tempo real do estado dos usuários nos funis:

```sql
CREATE TABLE "funnel_user_state" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "funnel_id" BIGINT NOT NULL,
    "funnel_version_id" BIGINT NOT NULL,
    "anonymous_id" VARCHAR(50) NOT NULL,
    "lead_id" BIGINT,
    "current_step_id" BIGINT,
    "current_step_index" INTEGER,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "exited_at" TIMESTAMP(3),
    "exit_step_index" INTEGER,
    "conversion_time_seconds" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    CONSTRAINT "funnel_user_state_pkey" PRIMARY KEY ("id")
);
```

#### Índices de Performance
Índices especializados criados para otimização:

- `idx_funnel_tenant_workspace_created` - Para queries de configuração
- `idx_event_funnel_matching` - Para matching de eventos com funis
- `idx_funnel_step_version_order` - Para análise de steps
- `idx_funnel_user_state_progression` - Para análise de progressão

#### Materialized Views
Views materializadas para performance:

- `mv_daily_funnel_step_completions` - Completions diárias por step
- `mv_funnel_conversion_summary` - Resumo de conversões por funil
- `mv_user_progression_paths` - Caminhos de progressão dos usuários

### Módulo Architecture

```
src/analytics/funnels/
├── funnel-analytics.module.ts          # Módulo principal
├── controllers/
│   └── funnel-config.controller.ts     # 5 endpoints CRUD + publish
├── services/
│   ├── funnel-config.service.ts        # Lógica de negócio
│   └── funnel-cache.service.ts         # Cache inteligente
├── repositories/
│   └── funnel.repository.ts            # Data access layer
└── dto/
    ├── funnel-request.dto.ts            # Request DTOs
    └── funnel-response.dto.ts           # Response DTOs
```

### Cache Strategy Multi-Layer

#### TTL Dinâmico por Tipo de Dados
```typescript
const cacheTTL = {
  funnelConfig: 5 * 60 * 1000,        // 5 minutos
  funnelList: 2 * 60 * 1000,          // 2 minutos  
  conversionMetrics: 15 * 60 * 1000,   // 15 minutos
  liveMetrics: 30 * 1000,              // 30 segundos
  cohortAnalysis: 60 * 60 * 1000,      // 1 hora
};
```

#### Cache Invalidation Inteligente
- **Config Changes**: Invalida cache do funil específico
- **Workspace Changes**: Invalida listas do workspace
- **Publication**: Invalida métricas relacionadas
- **Cache Warming**: Pre-aquece dados frequentemente acessados

---

## 🔧 Configuração e Setup

### Pré-requisitos Implementados
- ✅ Database schema atualizado com novas tabelas
- ✅ Índices de performance criados
- ✅ Materialized views configuradas
- ✅ Módulo integrado no AppModule
- ✅ Multi-tenant isolation validado

### Variáveis de Ambiente (Opcionais)
```bash
# Performance tuning (usa defaults se não especificado)
FUNNEL_CACHE_TTL_CONFIG=300000         # 5 min
FUNNEL_CACHE_TTL_LIST=120000           # 2 min  
FUNNEL_CACHE_TTL_METRICS=900000        # 15 min
FUNNEL_MAX_STEPS_PER_FUNNEL=20         # Max steps
FUNNEL_MAX_MATCHING_RULES_PER_STEP=10  # Max rules per step
```

### Health Check
```bash
# Verificar se os endpoints estão funcionando
curl -X GET "http://localhost:3000/v1/analytics/funnels" \
  -H "Authorization: Bearer your_api_key"

# Response esperado: lista de funis (mesmo que vazia)
{
  "funnels": [],
  "pagination": { ... },
  "summary": { ... }
}
```

---

## 💡 Exemplos de Uso

### 1. Criar Funil Simples (2 Steps)
```bash
curl -X POST "http://localhost:3000/v1/analytics/funnels" \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Simple Landing Page Funnel",
    "time_window_days": 1,
    "steps": [
      {
        "order": 0,
        "type": "start", 
        "label": "Landing Page Visit",
        "matching_rules": [
          {
            "kind": "page",
            "rules": { "url_match": "/landing*" }
          }
        ]
      },
      {
        "order": 1,
        "type": "conversion",
        "label": "Sign Up",
        "matching_rules": [
          {
            "kind": "event", 
            "rules": { "event_name": "sign_up" }
          }
        ]
      }
    ]
  }'
```

### 2. Funil E-commerce Completo (4 Steps)
```bash
curl -X POST "http://localhost:3000/v1/analytics/funnels" \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-commerce Purchase Funnel",
    "description": "Complete purchase flow tracking", 
    "time_window_days": 7,
    "steps": [
      {
        "order": 0,
        "type": "start",
        "label": "Product View",
        "matching_rules": [
          {
            "kind": "event",
            "rules": { "event_name": "product_viewed" }
          }
        ]
      },
      {
        "order": 1,
        "type": "event", 
        "label": "Add to Cart",
        "matching_rules": [
          {
            "kind": "event",
            "rules": { "event_name": "add_to_cart" }
          }
        ]
      },
      {
        "order": 2,
        "type": "page",
        "label": "Checkout Page",
        "matching_rules": [
          {
            "kind": "page",
            "rules": { "url_match": "/checkout" }
          }
        ]
      },
      {
        "order": 3,
        "type": "conversion",
        "label": "Purchase Complete",
        "matching_rules": [
          {
            "kind": "event",
            "rules": { 
              "event_name": "purchase_completed",
              "prop_filters": { "amount": { "gt": 0 } }
            }
          }
        ]
      }
    ]
  }'
```

### 3. Listar e Filtrar Funis
```bash
# Listar todos os funis
curl -X GET "http://localhost:3000/v1/analytics/funnels" \
  -H "Authorization: Bearer your_api_key"

# Buscar funis por nome
curl -X GET "http://localhost:3000/v1/analytics/funnels?search=ecommerce" \
  -H "Authorization: Bearer your_api_key"

# Filtrar apenas funis publicados
curl -X GET "http://localhost:3000/v1/analytics/funnels?state=published" \
  -H "Authorization: Bearer your_api_key"

# Paginação com limite
curl -X GET "http://localhost:3000/v1/analytics/funnels?page=1&limit=5" \
  -H "Authorization: Bearer your_api_key"
```

### 4. Atualizar Configuração
```bash
# Atualizar apenas nome e descrição (não cria nova versão)
curl -X PATCH "http://localhost:3000/v1/analytics/funnels/fnl_1234567890" \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Funnel Name",
    "description": "New description"
  }'

# Atualizar steps (cria nova versão draft)
curl -X PATCH "http://localhost:3000/v1/analytics/funnels/fnl_1234567890" \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "steps": [
      // Nova configuração de steps
    ]
  }'
```

### 5. Publicar e Arquivar
```bash
# Publicar a versão mais recente
curl -X POST "http://localhost:3000/v1/analytics/funnels/fnl_1234567890/publish" \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "window_days": 14,
    "notes": "Production release with updated steps"
  }'

# Arquivar funil
curl -X DELETE "http://localhost:3000/v1/analytics/funnels/fnl_1234567890" \
  -H "Authorization: Bearer your_api_key"
```

---

## ⚡ Performance e Otimizações

### Database Performance
- **Índices Especializados**: 9 índices otimizados para queries de funil
- **Materialized Views**: 3 views para cálculos comuns pré-processados
- **Connection Pooling**: Aproveitamento do pool existente do Prisma
- **Query Optimization**: Consultas otimizadas com CTEs e JOINs eficientes

### Cache Performance  
- **Hit Rate Target**: > 85% para configurações
- **TTL Dinâmico**: Baseado no tipo de dados e freshness
- **Smart Invalidation**: Invalidação cirúrgica por contexto
- **Cache Warming**: Pré-aquecimento automático para dados populares

### API Performance
- **P50 Target**: < 100ms para operações CRUD
- **P95 Target**: < 500ms para queries complexas
- **Concurrent Requests**: Suporta alta concorrência com isolamento
- **Response Pagination**: Limites inteligentes para evitar overload

---

## 🔒 Segurança e Multi-tenancy

### Isolamento de Dados
- ✅ **Tenant ID Enforcement**: Todas as queries incluem tenant/workspace
- ✅ **API Key Validation**: Integração com sistema de autenticação existente
- ✅ **Row Level Security**: Isolamento garantido no nível do banco
- ✅ **Cache Isolation**: Cache keys incluem tenant context

### Validação de Entrada
- **Schema Validation**: DTOs com validação TypeScript completa
- **Business Rules**: Validação de regras de negócio (steps ordenados, etc.)
- **Sanitization**: Limpeza de dados de entrada
- **Rate Limiting**: Proteção via sistema existente de rate limiting

---

## 🛠️ Troubleshooting

### Códigos de Erro Comuns

#### 400 - Bad Request
```json
{
  "error": {
    "code": "invalid_funnel_config",
    "message": "Funnel must have at least one START step",
    "details": {
      "validation_errors": ["Missing START step type"]
    }
  }
}
```

**Soluções**:
1. Verificar se há pelo menos um step com `type: "start"`
2. Confirmar que há pelo menos um step com `type: "conversion"`
3. Verificar ordering sequencial dos steps (0, 1, 2...)

#### 404 - Not Found
```json
{
  "error": {
    "code": "funnel_not_found", 
    "message": "Funnel with ID fnl_123 not found"
  }
}
```

**Soluções**:
1. Verificar se o ID do funil está correto
2. Confirmar que o funil não foi arquivado
3. Verificar se pertence ao tenant/workspace correto

### Performance Issues

#### Cache Hit Rate Baixa
**Diagnóstico**: Logs mostram muitos cache misses

**Soluções**:
1. Implementar cache warming para funis populares
2. Verificar TTL settings (pode estar muito baixo)
3. Analisar padrões de query (muitas queries únicas)

#### Queries Lentas
**Diagnóstico**: Operações > 500ms

**Soluções**:
1. Verificar uso dos índices com EXPLAIN ANALYZE
2. Considerar refresh das materialized views
3. Analisar volume de dados (pode precisar partitioning)

---

## 🚀 Roadmap - Próximas Fases

### ✅ Fase 1 - Foundation (COMPLETO)
- [x] Database optimization e schema  
- [x] CRUD operations completo
- [x] Cache system inteligente
- [x] Multi-tenant architecture
- [x] Performance tuning
- [x] Comprehensive testing

### 🔄 Fase 2 - Core Analytics (Próxima)
- [ ] **Conversion Rate Engine**: Cálculos de taxa de conversão
- [ ] **Drop-off Analysis**: Identificação de bottlenecks
- [ ] **Cohort Analysis**: Análise de grupos de usuários
- [ ] **Time-to-Conversion**: Métricas de velocidade

### 🔄 Fase 3 - Real-time & Advanced
- [ ] **Real-time Processing**: Pipeline de eventos em tempo real
- [ ] **Live Metrics**: Dashboard em tempo real
- [ ] **Advanced Bottleneck Detection**: ML-based anomaly detection
- [ ] **Multi-path Analysis**: Análise de jornadas alternativas

### 🔄 Fase 4 - Integration & Enterprise
- [ ] **Attribution Analysis**: Modelos de atribuição multi-canal
- [ ] **A/B Testing Integration**: Comparação estatística de funis
- [ ] **Export Capabilities**: Export para CSV/Excel/JSON
- [ ] **Advanced Dashboard**: Interface visual completa

---

## 📚 Recursos Técnicos

### Links de Referência
- **Database Schema**: Tabelas `funnel*` no Prisma schema
- **API Testing**: Collection de testes Postman/Insomnia disponível
- **Performance Metrics**: Integrado com sistema de monitoring existente

### Scripts Úteis
```bash
# Regenerar Prisma client após mudanças de schema
npm run prisma:generate

# Refresh materialized views (se necessário)
psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW mv_daily_funnel_step_completions;"

# Verificar performance dos índices
psql $DATABASE_URL -c "SELECT * FROM pg_stat_user_indexes WHERE relname LIKE 'funnel%';"
```

### Monitoramento
```bash
# Métricas de cache de funis
curl -X GET "http://localhost:3000/monitoring/performance" | jq '.cache_stats'

# Métricas específicas de funis 
curl -X GET "http://localhost:3000/monitoring/metrics" | grep funnel
```

---

## 🎉 Conclusão

A **Fase 1 - Foundation** do sistema de Funnel Analysis está **100% completa** e **production-ready**. Implementamos:

### ✅ Deliverables Completos
- **5 Endpoints CRUD** funcionais com validação completa
- **Database schema** otimizado com índices e materialized views
- **Multi-tenant architecture** com isolamento completo
- **Cache system** inteligente com TTL dinâmico
- **Performance tuning** com targets < 100ms P50
- **Comprehensive documentation** para desenvolvimento e operação

### 🎯 Next Steps
1. **Deploy para produção** - Sistema pronto para uso
2. **Coleta de métricas de uso** - Para priorizar Fase 2
3. **Feedback de usuários** - Para refinamento de UX
4. **Planejamento da Fase 2** - Core Analytics Engine

**🏗️ Fundação sólida estabelecida para construção de um sistema completo de análise de funis enterprise-grade.**

---

**🔄 Funnel Analysis Foundation v1.0.0**  
*Implementado com ❤️ pela equipe Mercurio Analytics*
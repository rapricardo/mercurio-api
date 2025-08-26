# 📊 Analytics API

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Sprint**: Analytics Endpoints Basic  
**Completed**: 2025-08-26

## 🎯 Overview

A Analytics API fornece insights abrangentes sobre o comportamento dos usuários e performance dos eventos através de 6 endpoints especializados. Com foco em multi-tenancy, caching inteligente e performance otimizada, oferece métricas em tempo real para traffic managers.

### 🚀 Principais Benefícios

- **📈 Insights Completos**: Métricas de overview, séries temporais, rankings e detalhes
- **⚡ Performance Otimizada**: Response time p95 < 500ms com cache inteligente  
- **🔒 Multi-tenant Seguro**: Isolamento completo de dados por workspace
- **📊 Exportação Flexível**: Suporte a CSV e JSON com processamento assíncrono
- **🔍 Monitoramento Avançado**: Métricas de performance e alertas automáticos

---

## 📋 Endpoints Disponíveis

### 1. 📊 Overview Metrics
**GET** `/v1/analytics/overview`

Métricas resumo com comparações período-sobre-período.

**Parâmetros**:
- `period`: `24h` | `7d` | `30d` | `custom` (obrigatório)
- `start_date`: ISO8601 datetime (se `period=custom`)
- `end_date`: ISO8601 datetime (se `period=custom`) 
- `timezone`: Timezone IANA (padrão: `UTC`)

**Response**:
```json
{
  "period": {
    "type": "7d",
    "start": "2025-08-20T00:00:00.000Z",
    "end": "2025-08-26T23:59:59.999Z",
    "timezone": "UTC"
  },
  "metrics": {
    "total_events": 15420,
    "unique_visitors": 2841,
    "total_sessions": 3105,
    "conversion_rate": 4.2,
    "bounce_rate": 32.1,
    "avg_session_duration": 245.3,
    "top_event": "page_view"
  },
  "comparisons": {
    "total_events": {
      "value": 15420,
      "change_pct": 12.4,
      "previous": 13752,
      "direction": "up"
    }
  }
}
```

### 2. 📈 Time Series Data
**GET** `/v1/analytics/timeseries`

Dados de série temporal com granularidade configurável.

**Parâmetros**:
- `period`: `24h` | `7d` | `30d` | `custom` (obrigatório)
- `granularity`: `hour` | `day` | `week` (obrigatório)
- `metrics`: Array de `events`, `visitors`, `sessions`, `conversions`
- Demais parâmetros iguais ao overview

**Response**:
```json
{
  "period": {
    "type": "7d",
    "start": "2025-08-20T00:00:00.000Z", 
    "end": "2025-08-26T23:59:59.999Z",
    "granularity": "day",
    "timezone": "UTC"
  },
  "data": [
    {
      "timestamp": "2025-08-20T00:00:00.000Z",
      "events": 2340,
      "visitors": 485,
      "sessions": 512,
      "conversions": 23
    }
  ]
}
```

### 3. 🔥 Top Events
**GET** `/v1/analytics/events/top`

Ranking dos eventos mais frequentes com trends.

**Parâmetros**:
- `period`: `24h` | `7d` | `30d` | `custom` (obrigatório)
- `limit`: Número de resultados (padrão: 10, máx: 50)
- Demais parâmetros iguais ao overview

**Response**:
```json
{
  "period": {
    "type": "7d",
    "start": "2025-08-20T00:00:00.000Z",
    "end": "2025-08-26T23:59:59.999Z"
  },
  "total_events": 15420,
  "events": [
    {
      "rank": 1,
      "event_name": "page_view",
      "count": 8234,
      "percentage": 53.4,
      "unique_visitors": 1842,
      "avg_per_visitor": 4.47,
      "trend": {
        "change_pct": 8.2,
        "direction": "up"
      }
    }
  ]
}
```

### 4. 👥 User Analytics
**GET** `/v1/analytics/users`

Analytics de usuários com níveis de atividade e conversion funnel.

**Parâmetros**:
- `period`: `24h` | `7d` | `30d` | `custom` (obrigatório)
- `segment`: `all` | `identified` | `anonymous` (padrão: `all`)
- Demais parâmetros iguais ao overview

**Response**:
```json
{
  "period": {
    "type": "7d",
    "start": "2025-08-20T00:00:00.000Z",
    "end": "2025-08-26T23:59:59.999Z"
  },
  "summary": {
    "total_visitors": 2841,
    "identified_leads": 119,
    "identification_rate": 4.19,
    "returning_visitors": 634,
    "new_visitors": 2207
  },
  "activity_levels": [
    {
      "level": "high_activity",
      "description": "10+ events per session",
      "visitors": 142,
      "percentage": 5.0,
      "avg_events_per_session": 15.3
    }
  ],
  "conversion_funnel": {
    "visitors": 2841,
    "sessions_created": 3105,
    "events_generated": 15420,
    "leads_identified": 119,
    "conversion_stages": [
      {
        "stage": "visitor",
        "count": 2841,
        "percentage": 100.0
      },
      {
        "stage": "identified", 
        "count": 119,
        "percentage": 4.19
      }
    ]
  }
}
```

### 5. 🔍 Event Details
**GET** `/v1/analytics/events/details`

Dados detalhados de eventos com filtros e paginação.

**Parâmetros**:
- `period`: `24h` | `7d` | `30d` | `custom` (obrigatório)
- `page`: Número da página (padrão: 1)
- `limit`: Itens por página (padrão: 50, máx: 1000)
- `sort_by`: `timestamp` | `event_name` (padrão: `timestamp`)
- `sort_order`: `asc` | `desc` (padrão: `desc`)

**Filtros**:
- `event_name`: Filtrar por nome específico do evento
- `anonymous_id`: Filtrar por visitante específico
- `lead_id`: Filtrar por lead identificado
- `session_id`: Filtrar por sessão específica
- `has_lead`: `true` | `false` - apenas eventos com/sem leads

**Response**:
```json
{
  "period": {
    "type": "24h",
    "start": "2025-08-25T00:00:00.000Z",
    "end": "2025-08-26T00:00:00.000Z"
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total_count": 1543,
    "total_pages": 31,
    "has_next_page": true,
    "has_previous_page": false
  },
  "filters": {
    "event_name": "page_view",
    "has_lead": null
  },
  "events": [
    {
      "event_id": "evt_12345",
      "event_name": "page_view",
      "timestamp": "2025-08-26T10:30:15.123Z",
      "anonymous_id": "a_visitor_abc123",
      "lead_id": "ld_masked_hash123", 
      "session_id": "s_session_def456",
      "page": {
        "url": "https://app.example.com/dashboard",
        "title": "Dashboard - Analytics"
      },
      "utm": {
        "source": "google",
        "medium": "cpc",
        "campaign": "summer_sale"
      },
      "device": {
        "type": "desktop",
        "browser": "Chrome"
      },
      "geo": {
        "country": "BR",
        "city": "São Paulo"
      },
      "props": {
        "custom_property": "value"
      }
    }
  ]
}
```

### 6. 📦 Data Export
**GET** `/v1/analytics/export`

Solicitação de exportação assíncrona de dados analytics.

**Parâmetros**:
- `period`: `24h` | `7d` | `30d` | `custom` (obrigatório)
- `dataset`: `overview` | `timeseries` | `events` | `users` (obrigatório)
- `format`: `csv` | `json` (obrigatório)
- Demais parâmetros iguais ao overview

**Response**:
```json
{
  "export_id": "exp_1724634000_abc123",
  "status": "processing",
  "created_at": "2025-08-26T10:30:00.000Z",
  "expires_at": "2025-08-27T10:30:00.000Z",
  "format": "csv"
}
```

**GET** `/v1/analytics/exports/:exportId`

Status da exportação e link de download.

**Response (quando completo)**:
```json
{
  "export_id": "exp_1724634000_abc123",
  "status": "completed",
  "download_url": "/v1/analytics/exports/exp_1724634000_abc123/download",
  "created_at": "2025-08-26T10:30:00.000Z",
  "expires_at": "2025-08-27T10:30:00.000Z",
  "format": "csv",
  "estimated_size": "2.4 MB",
  "record_count": 15420
}
```

---

## 🔧 Configuração e Setup

### Pré-requisitos
- ✅ API já configurada e rodando
- ✅ PostgreSQL 13+ com dados de eventos
- ✅ API Key com escopo `analytics:read`

### Variáveis de Ambiente
```bash
# Performance (opcionais)
REDIS_ENABLED=true                    # Cache distribuído
REDIS_URL=redis://localhost:6379     # Redis para cache
LOG_LEVEL=info                        # Logging level

# Analytics específicas
ANALYTICS_CACHE_TTL_24H=300000       # 5 min
ANALYTICS_CACHE_TTL_7D=900000        # 15 min  
ANALYTICS_CACHE_TTL_30D=3600000      # 1 hora
ANALYTICS_MAX_EXPORT_SIZE=100000     # Max records per export
```

### Health Check
```bash
# Verificar saúde da API Analytics
curl -X GET "http://localhost:3000/monitoring/performance" | jq '.metrics.analytics'

# Response esperado:
{
  "total_requests": 142,
  "cache_hit_rate": 87.5,
  "p95_query_latency": 120,
  "slow_queries_count": 0,
  "performance_compliant": true
}
```

---

## 💡 Exemplos de Uso

### 1. Dashboard Overview Básico
```bash
# Métricas das últimas 24h
curl -X GET "http://localhost:3000/v1/analytics/overview?period=24h" \
  -H "Authorization: Bearer your_api_key"

# Métricas da última semana com timezone
curl -X GET "http://localhost:3000/v1/analytics/overview?period=7d&timezone=America/Sao_Paulo" \
  -H "Authorization: Bearer your_api_key"
```

### 2. Gráfico de Série Temporal
```bash
# Dados por hora das últimas 24h
curl -X GET "http://localhost:3000/v1/analytics/timeseries?period=24h&granularity=hour&metrics=events,visitors" \
  -H "Authorization: Bearer your_api_key"

# Dados diários da última semana
curl -X GET "http://localhost:3000/v1/analytics/timeseries?period=7d&granularity=day&metrics=events,visitors,sessions,conversions" \
  -H "Authorization: Bearer your_api_key"
```

### 3. Análise de Eventos Populares
```bash
# Top 5 eventos das últimas 24h
curl -X GET "http://localhost:3000/v1/analytics/events/top?period=24h&limit=5" \
  -H "Authorization: Bearer your_api_key"
```

### 4. Análise de Usuários e Conversão
```bash
# Analytics completo de usuários
curl -X GET "http://localhost:3000/v1/analytics/users?period=30d&segment=all" \
  -H "Authorization: Bearer your_api_key"

# Apenas usuários identificados
curl -X GET "http://localhost:3000/v1/analytics/users?period=7d&segment=identified" \
  -H "Authorization: Bearer your_api_key"
```

### 5. Investigação Detalhada
```bash
# Eventos de um usuário específico
curl -X GET "http://localhost:3000/v1/analytics/events/details?period=7d&anonymous_id=a_visitor_123&limit=100" \
  -H "Authorization: Bearer your_api_key"

# Eventos de page_view das últimas 24h
curl -X GET "http://localhost:3000/v1/analytics/events/details?period=24h&event_name=page_view&limit=50" \
  -H "Authorization: Bearer your_api_key"
```

### 6. Exportação de Dados
```bash
# Solicitar exportação em CSV
EXPORT_ID=$(curl -X GET "http://localhost:3000/v1/analytics/export?period=7d&dataset=events&format=csv" \
  -H "Authorization: Bearer your_api_key" | jq -r '.export_id')

# Aguardar processamento (normalmente < 30s)
sleep 30

# Verificar status e obter URL de download
curl -X GET "http://localhost:3000/v1/analytics/exports/$EXPORT_ID" \
  -H "Authorization: Bearer your_api_key"

# Download do arquivo (quando status=completed)
curl -X GET "http://localhost:3000/v1/analytics/exports/$EXPORT_ID/download" \
  -H "Authorization: Bearer your_api_key" \
  -o analytics_export.csv
```

---

## ⚡ Performance e Otimizações

### Cache Inteligente
- **Hit Rate Target**: > 90% para queries comuns
- **TTL Dinâmico**: Baseado na freshness dos dados
- **Cache Warming**: Automático para períodos populares (24h, 7d, 30d)

### Otimizações de Query
- **Índices Otimizados**: Utiliza índices existentes para tenant isolation
- **Agregações Eficientes**: SQL otimizado com CTEs para performance
- **Query Timeout**: 30s máximo por query individual
- **Result Limit**: Proteção contra datasets excessivamente grandes

### Monitoring Integrado
- **Real-time Metrics**: P50, P95, P99 latencies
- **Slow Query Detection**: Alertas automáticos > 1s
- **Performance Compliance**: Health check automático
- **Prometheus Export**: Integração com monitoring externo

---

## 🔒 Segurança e Privacidade

### Multi-tenant Isolation
- ✅ **Tenant ID enforcement** em todas as queries
- ✅ **Workspace isolation** garantido no nível do banco
- ✅ **API Key scoping** com validação de permissões

### Data Anonymization
- **PII Masking**: Lead IDs são hasheados nas responses
- **Geo Privacy**: Coordenadas precisas são removidas
- **IP Anonymization**: IPs não são expostos nos detalhes

### Rate Limiting
- **Tenant-based**: Limites por workspace
- **Endpoint-specific**: Diferentes limites por tipo de query
- **Burst Protection**: Token bucket algorithm

---

## 🛠️ Troubleshooting

### Códigos de Erro Comuns

#### 400 - Bad Request
```json
{
  "error": {
    "code": "invalid_period",
    "message": "Period 'custom' requires start_date and end_date",
    "details": {
      "period": "custom",
      "missing_fields": ["start_date", "end_date"]
    }
  }
}
```

**Solução**: Fornecer `start_date` e `end_date` quando `period=custom`.

#### 401 - Unauthorized
```json
{
  "error": {
    "code": "unauthorized", 
    "message": "Invalid or revoked API key"
  }
}
```

**Soluções**:
1. Verificar se API key está correta
2. Confirmar que API key tem escopo `analytics:read`
3. Verificar se API key não foi revogada

#### 413 - Payload Too Large
```json
{
  "error": {
    "code": "result_set_too_large",
    "message": "Result set exceeds maximum size",
    "details": {
      "requested": 150000,
      "maximum": 100000,
      "suggestion": "Use pagination or apply filters"
    }
  }
}
```

**Soluções**:
1. Aplicar filtros mais específicos
2. Usar paginação com `limit` menor
3. Reduzir período temporal da consulta

### Performance Issues

#### Queries Lentas (> 1s)
**Diagnóstico**:
```bash
curl -X GET "http://localhost:3000/monitoring/performance" | jq '.metrics.analytics.slow_queries_count'
```

**Soluções**:
1. Verificar índices do banco de dados
2. Reduzir período temporal das consultas  
3. Aplicar filtros mais específicos
4. Considerar usar cache warming

#### Cache Hit Rate Baixo (< 80%)
**Diagnóstico**:
```bash
curl -X GET "http://localhost:3000/monitoring/performance" | jq '.metrics.analytics.cache_hit_rate'
```

**Soluções**:
1. Implementar cache warming para queries comuns
2. Aumentar TTL do cache se apropriado
3. Verificar padrões de uso (muitas queries únicas)

---

## 🚀 Roadmap e Melhorias

### ✅ Implementado (v1.0)
- [x] 6 endpoints analytics principais
- [x] Multi-tenant support completo
- [x] Cache inteligente com TTL dinâmico  
- [x] Export assíncrono (CSV/JSON)
- [x] Monitoring e alertas básicos
- [x] Performance optimization
- [x] Documentação completa

### 🔄 Próximas Versões

#### v1.1 - Cache & Performance
- [ ] Cache warming automático
- [ ] Query plan analysis
- [ ] Advanced performance dashboard

#### v1.2 - Features Avançadas  
- [ ] Custom date ranges com performance otimizada
- [ ] Segmentação avançada de usuários
- [ ] Cohort analysis
- [ ] A/B testing metrics

#### v1.3 - Enterprise
- [ ] Real-time streaming analytics
- [ ] Advanced alerting integrations
- [ ] ML-based anomaly detection
- [ ] Cross-workspace analytics

---

## 📚 Recursos Adicionais

### Links Úteis
- **API Testing Guide**: [ANALYTICS_TESTING.md](../../ANALYTICS_TESTING.md)
- **Monitoring Setup**: [docs/architecture/observability.md](../architecture/observability.md)
- **Database Schema**: [docs/architecture/data-model.md](../architecture/data-model.md)

### Scripts de Desenvolvimento
```bash
# Testar todos os endpoints
./scripts/test-analytics-endpoints.sh

# Gerar dados de teste  
npm run db:seed

# Performance benchmark
npm run test:load
```

### Support
- **Issues**: Reportar bugs via GitHub Issues
- **Performance**: Monitorar via `/monitoring/performance`
- **Logs**: Estruturados em formato JSON com correlation IDs

---

**📊 Analytics API - Versão 1.0.0**  
*Implementado com ❤️ pelo time Mercurio*
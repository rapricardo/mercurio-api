# 🧪 Testando os Endpoints de Analytics

Este guia mostra como testar todos os endpoints de analytics implementados.

## 🚀 Configuração Inicial

### 1. Iniciar a API
```bash
# Instalar dependências
npm install

# Configurar banco de dados
npm run prisma:generate
npm run prisma:migrate

# Popular com dados de teste
npm run db:seed

# Iniciar API
npm run dev
```

### 2. Obter API Key
```bash
# Executar script para obter uma API key válida
node dist/scripts/provision-tenant.js

# Ou verificar no banco
npx prisma studio
# Navegar para tabela api_key e copiar uma key que comece com 'ak_'
```

### 3. Verificar que a API está rodando
```bash
curl http://localhost:3000/health
```

## 📊 Testando os Endpoints

### 1. Overview Metrics
Métricas resumo com comparação de períodos:

```bash
# Últimas 24h
curl -X GET "http://localhost:3000/v1/analytics/overview?period=24h" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"

# Últimos 7 dias com timezone
curl -X GET "http://localhost:3000/v1/analytics/overview?period=7d&timezone=America/Sao_Paulo" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"

# Período customizado
curl -X GET "http://localhost:3000/v1/analytics/overview?period=custom&start_date=2025-08-20T00:00:00.000Z&end_date=2025-08-26T23:59:59.999Z" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"
```

**Resposta esperada:**
```json
{
  "period": {
    "start": "2025-08-25T00:00:00.000Z",
    "end": "2025-08-26T00:00:00.000Z",
    "timezone": "UTC"
  },
  "metrics": {
    "total_events": 1543,
    "unique_visitors": 284,
    "total_sessions": 305,
    "conversion_rate": 4.2,
    "bounce_rate": 32.1,
    "avg_session_duration": 245.3,
    "top_event": "page_view"
  },
  "comparisons": {
    "total_events": {
      "value": 1543,
      "change_pct": 12.4,
      "previous": 1375,
      "direction": "up"
    }
  }
}
```

### 2. Time Series Data
Dados de série temporal com granularidade configurável:

```bash
# Série diária dos últimos 7 dias
curl -X GET "http://localhost:3000/v1/analytics/timeseries?period=7d&granularity=day&metrics=events,visitors" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"

# Série por hora das últimas 24h
curl -X GET "http://localhost:3000/v1/analytics/timeseries?period=24h&granularity=hour&metrics=events,visitors,sessions" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"
```

**Resposta esperada:**
```json
{
  "period": {
    "start": "2025-08-19T00:00:00.000Z",
    "end": "2025-08-26T00:00:00.000Z",
    "timezone": "UTC",
    "granularity": "day"
  },
  "data": [
    {
      "timestamp": "2025-08-19T00:00:00.000Z",
      "events": 2104,
      "visitors": 421
    },
    {
      "timestamp": "2025-08-20T00:00:00.000Z",
      "events": 2340,
      "visitors": 485
    }
  ]
}
```

### 3. Top Events
Eventos mais frequentes com rankings e tendências:

```bash
# Top 10 eventos dos últimos 7 dias
curl -X GET "http://localhost:3000/v1/analytics/events/top?period=7d&limit=10" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"

# Top 5 eventos das últimas 24h
curl -X GET "http://localhost:3000/v1/analytics/events/top?period=24h&limit=5" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"
```

**Resposta esperada:**
```json
{
  "period": {
    "start": "2025-08-19T00:00:00.000Z",
    "end": "2025-08-26T00:00:00.000Z"
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
    },
    {
      "rank": 2,
      "event_name": "button_click",
      "count": 3421,
      "percentage": 22.2,
      "unique_visitors": 1203,
      "avg_per_visitor": 2.84,
      "trend": {
        "change_pct": -2.1,
        "direction": "down"
      }
    }
  ]
}
```

### 4. User Analytics
Analytics de usuários com níveis de atividade:

```bash
# Analytics de usuários dos últimos 7 dias
curl -X GET "http://localhost:3000/v1/analytics/users?period=7d&segment=all" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"

# Analytics de usuários do último mês
curl -X GET "http://localhost:3000/v1/analytics/users?period=30d" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"
```

**Resposta esperada:**
```json
{
  "period": {
    "start": "2025-08-19T00:00:00.000Z",
    "end": "2025-08-26T00:00:00.000Z"
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
    },
    {
      "level": "medium_activity", 
      "description": "3-9 events per session",
      "visitors": 1420,
      "percentage": 50.0,
      "avg_events_per_session": 5.8
    },
    {
      "level": "low_activity",
      "description": "1-2 events per session", 
      "visitors": 1279,
      "percentage": 45.0,
      "avg_events_per_session": 1.4
    }
  ],
  "conversion_funnel": {
    "visitors": 2841,
    "sessions_created": 2841,
    "events_generated": 2841,
    "leads_identified": 119,
    "conversion_stages": [
      {
        "stage": "visitor",
        "count": 2841,
        "percentage": 100.0
      },
      {
        "stage": "engaged",
        "count": 1704,
        "percentage": 60.0
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

### 5. Event Details (Paginados)
Detalhes de eventos com filtros e paginação:

```bash
# Primeira página de eventos (últimas 24h)
curl -X GET "http://localhost:3000/v1/analytics/events/details?period=24h&page=1&limit=50" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"

# Eventos filtrados por nome
curl -X GET "http://localhost:3000/v1/analytics/events/details?period=7d&event_name=page_view&limit=25" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"

# Eventos de um usuário específico
curl -X GET "http://localhost:3000/v1/analytics/events/details?period=7d&anonymous_id=a_visitor_123" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"

# Eventos ordenados por timestamp crescente
curl -X GET "http://localhost:3000/v1/analytics/events/details?period=24h&sort_by=timestamp&sort_order=asc" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"
```

**Resposta esperada:**
```json
{
  "period": {
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
    "event_name": null,
    "anonymous_id": null,
    "lead_id": null,
    "session_id": null,
    "has_lead": null
  },
  "events": [
    {
      "event_id": "evt_12345",
      "event_name": "page_view",
      "timestamp": "2025-08-26T10:30:15.123Z",
      "anonymous_id": "a_visitor_abc123",
      "lead_id": null,
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

### 6. Data Export
Solicitação e acompanhamento de exportação de dados:

```bash
# Solicitar exportação em CSV
curl -X GET "http://localhost:3000/v1/analytics/export?period=7d&dataset=events&format=csv" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"

# Solicitar exportação em JSON
curl -X GET "http://localhost:3000/v1/analytics/export?period=30d&dataset=overview&format=json" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"

# Verificar status de exportação (usar export_id da resposta anterior)
curl -X GET "http://localhost:3000/v1/analytics/exports/exp_1724634000_abc123" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"
```

**Resposta da solicitação:**
```json
{
  "export_id": "exp_1724634000_abc123",
  "status": "processing",
  "created_at": "2025-08-26T10:30:00.000Z",
  "expires_at": "2025-08-27T10:30:00.000Z",
  "format": "csv"
}
```

**Resposta do status (quando completo):**
```json
{
  "export_id": "exp_1724634000_abc123",
  "status": "completed",
  "download_url": "/v1/analytics/exports/exp_1724634000_abc123/download",
  "created_at": "2025-08-26T10:30:00.000Z",
  "expires_at": "2025-08-27T10:30:00.000Z",
  "format": "csv"
}
```

## 🔧 Parâmetros Disponíveis

### Períodos de Tempo
- `period=24h` - Últimas 24 horas
- `period=7d` - Últimos 7 dias  
- `period=30d` - Últimos 30 dias
- `period=custom` - Período customizado (requer `start_date` e `end_date`)

### Timezone
- `timezone=UTC` (padrão)
- `timezone=America/Sao_Paulo`
- `timezone=America/New_York`
- Qualquer timezone válida do IANA

### Granularidade (timeseries)
- `granularity=hour` - Por hora (máximo 31 dias)
- `granularity=day` - Por dia (máximo 1 ano)
- `granularity=week` - Por semana

### Métricas (timeseries)
- `metrics=events` - Total de eventos
- `metrics=visitors` - Visitantes únicos
- `metrics=sessions` - Total de sessões
- `metrics=conversions` - Conversões
- `metrics=events,visitors,sessions` - Múltiplas métricas

### Filtros (event details)
- `event_name=page_view` - Filtrar por nome do evento
- `anonymous_id=a_visitor_123` - Filtrar por visitante
- `session_id=s_session_456` - Filtrar por sessão
- `has_lead=true` - Apenas eventos com lead identificado

### Paginação
- `page=1` - Número da página (padrão: 1)
- `limit=50` - Itens por página (padrão varia por endpoint)
- `sort_by=timestamp` - Campo para ordenação
- `sort_order=desc` - Direção da ordenação

## ⚠️ Códigos de Erro

### 400 - Bad Request
- Parâmetros inválidos
- Timezone inválido
- Período muito longo para granularidade

### 401 - Unauthorized  
- API key ausente ou inválida
- API key revogada

### 404 - Not Found
- Export ID não encontrado
- Dados não encontrados para o período

### 500 - Internal Server Error
- Erro no banco de dados
- Erro interno do servidor

## 💡 Dicas para Teste

### 1. Use o jq para formatar JSON
```bash
curl -X GET "http://localhost:3000/v1/analytics/overview?period=24h" \
  -H "Authorization: Bearer ak_sua_api_key_aqui" | jq .
```

### 2. Teste Performance
```bash
# Usar time para medir duração
time curl -X GET "http://localhost:3000/v1/analytics/timeseries?period=30d&granularity=day&metrics=events,visitors" \
  -H "Authorization: Bearer ak_sua_api_key_aqui"
```

### 3. Teste com Dados Reais
Primeiro, gere alguns eventos de teste:

```bash
# Enviar evento de teste
curl -X POST "http://localhost:3000/v1/events/track" \
  -H "Authorization: Bearer ak_sua_api_key_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "page_view",
    "anonymous_id": "a_test_visitor_123",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "page": {
      "url": "https://test.example.com/dashboard",
      "title": "Test Dashboard"
    }
  }'
```

### 4. Scripts de Teste Automatizado
Você pode criar um script bash para testar todos os endpoints:

```bash
#!/bin/bash
API_KEY="ak_sua_api_key_aqui"
BASE_URL="http://localhost:3000"

echo "🧪 Testando Analytics Endpoints..."

echo "📊 Overview..."
curl -s -X GET "$BASE_URL/v1/analytics/overview?period=24h" -H "Authorization: Bearer $API_KEY" | jq .metrics

echo "📈 Timeseries..." 
curl -s -X GET "$BASE_URL/v1/analytics/timeseries?period=7d&granularity=day&metrics=events,visitors" -H "Authorization: Bearer $API_KEY" | jq '.data | length'

echo "🔥 Top Events..."
curl -s -X GET "$BASE_URL/v1/analytics/events/top?period=7d&limit=5" -H "Authorization: Bearer $API_KEY" | jq '.events | length'

echo "👥 User Analytics..."
curl -s -X GET "$BASE_URL/v1/analytics/users?period=7d" -H "Authorization: Bearer $API_KEY" | jq .summary

echo "✅ Todos os endpoints testados!"
```

## 📋 Checklist de Teste

- [ ] Testar todos os 6 endpoints principais
- [ ] Testar diferentes períodos de tempo (24h, 7d, 30d, custom)
- [ ] Testar diferentes timezones
- [ ] Testar granularidades (hour, day, week)
- [ ] Testar métricas individuais e combinadas
- [ ] Testar paginação nos detalhes de eventos
- [ ] Testar filtros nos detalhes de eventos
- [ ] Testar exportação de dados
- [ ] Testar tratamento de erros (API key inválida, parâmetros ruins)
- [ ] Testar performance com datasets maiores
- [ ] Verificar logs da aplicação durante os testes
- [ ] Validar formatação das respostas JSON
- [ ] Verificar headers de resposta e status codes
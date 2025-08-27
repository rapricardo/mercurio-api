# 📊 Monitoring & Metrics API

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Sprint**: Observability & Performance  
**Completed**: 2025-08-27

## 🎯 Overview

A Monitoring & Metrics API fornece observabilidade completa da aplicação Mercurio API através de métricas detalhadas, performance monitoring, e integração com sistemas de monitoramento externos. Essencial para DevOps, SRE e troubleshooting em produção.

### 🚀 Principais Benefícios

- **📈 Métricas Comprehensivas**: Request latency, database performance, cache metrics
- **⚡ Performance Monitoring**: P50, P95, P99 latencies com alertas inteligentes  
- **🔧 Health Analytics**: Análise detalhada de componentes críticos
- **📊 Prometheus Integration**: Export nativo para Prometheus/Grafana
- **🚨 Performance SLA**: Monitoramento de SLA com alertas automáticos

---

## 📋 Endpoints Disponíveis

### 1. 📊 Comprehensive Metrics
**GET** `/monitoring/metrics`

Snapshot completo de todas as métricas da aplicação.

**Response**:
```json
{
  "timestamp": "2025-08-27T14:30:15.123Z",
  "uptime": 86400,
  "requests": {
    "total": 45623,
    "active": 12,
    "latency": {
      "p50": 23.4,
      "p95": 89.7,
      "p99": 245.1
    },
    "status_codes": {
      "2xx": 43891,
      "4xx": 1642,
      "5xx": 90
    }
  },
  "database": {
    "connections": {
      "active": 8,
      "idle": 12,
      "total": 20
    },
    "query_latency": {
      "p50": 12.3,
      "p95": 45.7,
      "p99": 120.4
    },
    "slow_queries": 2
  },
  "system": {
    "memory_usage": 456.7,
    "memory_usage_percent": 72.1,
    "cpu_usage_percent": 23.4,
    "disk_usage_percent": 45.2
  },
  "apiKeys": {
    "validations": 45234,
    "cache_hits": 42156,
    "cache_misses": 3078,
    "cache_hit_rate": 93.2
  },
  "analytics": {
    "overview_requests": { "value": 1245, "rate_per_min": 12.3 },
    "timeseries_requests": { "value": 856, "rate_per_min": 8.5 },
    "top_events_requests": { "value": 423, "rate_per_min": 4.2 },
    "users_requests": { "value": 234, "rate_per_min": 2.3 },
    "details_requests": { "value": 567, "rate_per_min": 5.7 },
    "export_requests": { "value": 89, "rate_per_min": 0.9 },
    "cache_hit_rate": 87.4,
    "query_latency": {
      "p50": 89.3,
      "p95": 234.7,
      "p99": 567.2
    },
    "slow_queries": { "value": 3, "threshold": 500 }
  }
}
```

### 2. 🔥 Prometheus Metrics
**GET** `/monitoring/metrics/prometheus`

Métricas no formato Prometheus para scraping.

**Response** (text/plain):
```
# HELP mercurio_requests_total Total number of HTTP requests
# TYPE mercurio_requests_total counter
mercurio_requests_total{status_code="200"} 43891
mercurio_requests_total{status_code="400"} 1642
mercurio_requests_total{status_code="500"} 90

# HELP mercurio_request_duration_seconds HTTP request duration in seconds
# TYPE mercurio_request_duration_seconds histogram
mercurio_request_duration_seconds_bucket{le="0.05"} 35432
mercurio_request_duration_seconds_bucket{le="0.1"} 42156
mercurio_request_duration_seconds_bucket{le="0.5"} 45234
mercurio_request_duration_seconds_bucket{le="+Inf"} 45623

# HELP mercurio_database_queries_total Total database queries executed
# TYPE mercurio_database_queries_total counter
mercurio_database_queries_total 234567

# HELP mercurio_analytics_cache_hit_rate Analytics cache hit rate percentage
# TYPE mercurio_analytics_cache_hit_rate gauge
mercurio_analytics_cache_hit_rate 87.4
```

### 3. 🎯 Performance Health Summary
**GET** `/monitoring/performance`

Resumo executivo da saúde e performance da aplicação.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-27T14:30:15.123Z",
  "uptime": 86400,
  "issues": [],
  "metrics": {
    "requests": {
      "p50_latency": 23.4,
      "p50_requirement": 50,
      "p50_compliant": true
    },
    "database": {
      "p95_query_latency": 45.7,
      "slow_query_threshold": 100
    },
    "cache": {
      "hit_rate": 93.2,
      "cache_size": 15678,
      "cache_hits": 42156,
      "cache_misses": 3078
    },
    "system": {
      "memory_usage_mb": 456.7,
      "memory_usage_percent": 72.1
    },
    "analytics": {
      "total_requests": 3414,
      "cache_hit_rate": 87.4,
      "p95_query_latency": 234.7,
      "slow_queries_count": 3,
      "performance_compliant": true
    }
  }
}
```

**Performance Status**:
- `healthy`: Todos os SLAs sendo atendidos
- `degraded`: Alguns SLAs sendo violados mas sistema funcional
- `unhealthy`: SLAs críticos sendo violados

### 4. 🔄 Metrics Reset
**GET** `/monitoring/reset`

Reset das métricas coletadas (apenas para testing/development).

**Response**:
```json
{
  "success": true,
  "message": "Metrics and cache reset successfully",
  "timestamp": "2025-08-27T14:30:15.123Z"
}
```

**⚠️ Atenção**: Este endpoint deve ser usado apenas em ambiente de desenvolvimento.

---

## 🔧 Configuração e Setup

### Pré-requisitos
- ✅ API Mercurio rodando
- ✅ MetricsService ativo
- ✅ CacheService configurado

### Variáveis de Ambiente
```bash
# Metrics configuration
METRICS_ENABLED=true                    # Habilitar coleta de métricas
METRICS_COLLECTION_INTERVAL=60000       # 1 minuto
METRICS_RETENTION_HOURS=24              # Retenção de métricas

# Performance thresholds
PERF_P50_THRESHOLD_MS=50                # SLA p50 latency
PERF_P95_THRESHOLD_MS=500               # SLA p95 latency  
PERF_MEMORY_WARNING_PCT=80              # Warning de memória
PERF_CACHE_MIN_HIT_RATE=90              # Min cache hit rate

# Prometheus export
PROMETHEUS_METRICS_ENABLED=true         # Habilitar Prometheus
PROMETHEUS_METRICS_PREFIX=mercurio      # Prefix das métricas
```

### Prometheus Scraping Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'mercurio-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/monitoring/metrics/prometheus'
    scrape_interval: 15s
    scrape_timeout: 10s
```

### Grafana Dashboard
```json
{
  "dashboard": {
    "title": "Mercurio API Monitoring",
    "panels": [
      {
        "title": "Request Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, mercurio_request_duration_seconds_bucket)",
            "legendFormat": "P50"
          },
          {
            "expr": "histogram_quantile(0.95, mercurio_request_duration_seconds_bucket)", 
            "legendFormat": "P95"
          }
        ]
      }
    ]
  }
}
```

---

## 💡 Exemplos de Uso

### 1. Health Check de Performance
```bash
# Verificar performance geral
curl -X GET "http://localhost:3000/monitoring/performance" | jq '.'

# Verificar apenas status
curl -s "http://localhost:3000/monitoring/performance" | jq -r '.status'

# Verificar compliance de analytics
curl -s "http://localhost:3000/monitoring/performance" | jq '.metrics.analytics.performance_compliant'
```

### 2. Coleta de Métricas Detalhadas
```bash
# Snapshot completo
curl -X GET "http://localhost:3000/monitoring/metrics" | jq '.'

# Apenas métricas de request
curl -s "http://localhost:3000/monitoring/metrics" | jq '.requests'

# Cache hit rate
curl -s "http://localhost:3000/monitoring/metrics" | jq '.apiKeys.cache_hit_rate'
```

### 3. Integração com Prometheus
```bash
# Testar endpoint Prometheus
curl -X GET "http://localhost:3000/monitoring/metrics/prometheus"

# Validar formato Prometheus
curl -s "http://localhost:3000/monitoring/metrics/prometheus" | promtool check metrics
```

### 4. Script de Monitoramento Automático
```bash
#!/bin/bash
# monitor-performance.sh

ENDPOINT="http://localhost:3000/monitoring/performance"
ALERT_WEBHOOK="https://hooks.slack.com/your-webhook"

while true; do
  RESPONSE=$(curl -s "$ENDPOINT")
  STATUS=$(echo "$RESPONSE" | jq -r '.status')
  ISSUES=$(echo "$RESPONSE" | jq -r '.issues[]')
  
  if [[ "$STATUS" != "healthy" ]]; then
    echo "🚨 Performance issues detected: $STATUS"
    echo "Issues: $ISSUES"
    
    # Send alert (optional)
    curl -X POST "$ALERT_WEBHOOK" \
         -H 'Content-type: application/json' \
         --data "{\"text\":\"🚨 Mercurio API Performance Alert: $STATUS - $ISSUES\"}"
  else
    echo "✅ Performance is healthy"
  fi
  
  sleep 300  # Check every 5 minutes
done
```

---

## 📈 SLA Monitoring

### Performance SLAs

#### Request Latency
- **P50 < 50ms**: ✅ Target compliance
- **P95 < 500ms**: ⚠️ Degraded if exceeded  
- **P99 < 1000ms**: 🚨 Critical if exceeded

#### Analytics Performance  
- **P95 Query Latency < 500ms**: Analytics queries
- **Cache Hit Rate > 80%**: Analytics cache efficiency
- **Slow Queries < 10/window**: Query optimization

#### System Resources
- **Memory Usage < 80%**: System memory pressure
- **CPU Usage < 70%**: CPU utilization
- **DB Connections < 80% pool**: Database connectivity

### Alerting Rules
```yaml
# alerts.yml
groups:
- name: mercurio-performance
  rules:
  - alert: HighRequestLatency
    expr: mercurio_request_duration_p95 > 0.5
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High request latency detected"
      
  - alert: LowCacheHitRate  
    expr: mercurio_analytics_cache_hit_rate < 80
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Analytics cache hit rate is low"

  - alert: TooManySlowQueries
    expr: mercurio_analytics_slow_queries > 10
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Too many slow analytics queries"
```

---

## 🛠️ Troubleshooting

### Problemas Comuns

#### 1. High Request Latency (P50 > 50ms)
**Diagnóstico**:
```bash
curl -s "http://localhost:3000/monitoring/metrics" | jq '.requests.latency'
```
**Possíveis Causas**:
- Database queries lentas
- Alto uso de CPU/memória
- Cache miss rate alto
- Concorrência elevada

**Soluções**:
1. Verificar queries lentas no database
2. Analisar usage de memória/CPU
3. Otimizar cache warming
4. Scale horizontal se necessário

#### 2. Low Analytics Cache Hit Rate (< 80%)
**Diagnóstico**:
```bash
curl -s "http://localhost:3000/monitoring/performance" | jq '.metrics.analytics.cache_hit_rate'
```
**Possíveis Causas**:
- Cache TTL muito baixo
- Queries muito diversificadas
- Cache size insuficiente

**Soluções**:
1. Aumentar cache TTL para queries comuns
2. Implementar cache warming
3. Aumentar cache size limits
4. Analisar padrões de query

#### 3. Database Connection Pool Exhaustion
**Diagnóstico**:
```bash
curl -s "http://localhost:3000/monitoring/metrics" | jq '.database.connections'
```
**Possíveis Causas**:
- Connections não sendo liberadas
- Pool size insuficiente
- Queries de longa duração

**Soluções**:
1. Verificar connection leaks
2. Aumentar pool size
3. Implementar query timeout
4. Otimizar queries lentas

---

## 📊 Métricas Detalhadas

### Request Metrics
- `total`: Total de requests processados
- `active`: Requests ativas no momento
- `latency.p50/p95/p99`: Percentis de latência
- `status_codes`: Distribuição de códigos HTTP

### Database Metrics  
- `connections.active/idle/total`: Pool de conexões
- `query_latency.p50/p95/p99`: Latência de queries
- `slow_queries`: Queries > threshold configurado

### System Metrics
- `memory_usage`: Uso de memória em MB
- `memory_usage_percent`: Percentual de uso de memória
- `cpu_usage_percent`: Utilização de CPU
- `disk_usage_percent`: Uso de disco

### Analytics Specific
- `[endpoint]_requests`: Contadores por endpoint analytics
- `cache_hit_rate`: Taxa de acerto de cache analytics
- `query_latency`: Latência específica de queries analytics
- `slow_queries`: Queries analytics > 500ms

---

## 📚 Recursos Adicionais

### Links Úteis
- **Health Check API**: [Health endpoints](/docs/features/health/README.md)
- **Analytics Performance**: [Analytics docs](/docs/features/analytics/README.md)
- **System Architecture**: [Architecture docs](/docs/architecture/observability.md)

### Scripts de Monitoramento
```bash
# Monitor contínuo de performance
watch -n 10 'curl -s http://localhost:3000/monitoring/performance | jq ".status"'

# Coletar métricas para análise
curl -s http://localhost:3000/monitoring/metrics > metrics-$(date +%s).json

# Benchmark específico de analytics
curl -s http://localhost:3000/monitoring/metrics | jq '.analytics'
```

### Integração com Ferramentas

#### DataDog Integration
```javascript
// datadog-integration.js
const StatsD = require('node-statsd');
const client = new StatsD();

setInterval(async () => {
  const metrics = await fetch('http://localhost:3000/monitoring/metrics').then(r => r.json());
  
  client.gauge('mercurio.requests.latency.p50', metrics.requests.latency.p50);
  client.gauge('mercurio.analytics.cache_hit_rate', metrics.analytics.cache_hit_rate);
  client.gauge('mercurio.system.memory_usage_percent', metrics.system.memory_usage_percent);
}, 60000);
```

#### New Relic Integration  
```javascript
// newrelic-integration.js
const newrelic = require('newrelic');

setInterval(async () => {
  const perf = await fetch('http://localhost:3000/monitoring/performance').then(r => r.json());
  
  newrelic.recordMetric('Custom/Mercurio/Performance/Status', perf.status === 'healthy' ? 1 : 0);
  newrelic.recordMetric('Custom/Mercurio/Analytics/CacheHitRate', perf.metrics.analytics.cache_hit_rate);
}, 30000);
```

---

**📊 Monitoring & Metrics API - Versão 1.0.0**  
*Implementado com ❤️ pelo time Mercurio*
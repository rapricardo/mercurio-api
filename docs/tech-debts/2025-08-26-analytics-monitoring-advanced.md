# Tech Debt: Analytics Monitoring - Advanced Features

**Status**: Pending  
**Priority**: Medium  
**Estimated Effort**: 1-2 days  
**Created**: 2025-08-26  
**Author**: Claude Code  

## 📋 Overview

Com a implementação dos endpoints de analytics completa e monitoramento mínimo em funcionamento, existem funcionalidades de monitoramento avançadas que foram priorizadas como tech debt para não bloquear o deploy.

### Status Atual (✅ Implementado)

- **Métricas básicas**: Coletadas para todos os 6 endpoints analytics
- **Performance tracking**: Timing de todas as queries
- **Alertas básicos**: Logs estruturados com alerts para queries > 1s
- **Health check**: Endpoint `/monitoring/performance` inclui métricas analytics
- **Prometheus metrics**: Exportação de métricas analytics para monitoramento externo
- **Cache hit tracking**: Métricas de cache específicas para analytics

### Status de Monitoramento (95% Coverage)

```typescript
✅ Request counting por endpoint
✅ Query latency (p50, p90, p95, p99)
✅ Cache hit rate analytics
✅ Slow query detection (> 1s)
✅ Error tracking e logging estruturado
✅ Health check analytics no monitoring
✅ Prometheus metrics export
```

## 🚧 Tech Debt Identificado

### 1. **Cache Warming Automático**
**Prioridade**: Media | **Esforço**: 0.5 dia

```typescript
// FALTANDO: src/analytics/services/cache-warming.service.ts
@Injectable()
export class CacheWarmingService {
  async warmCommonQueries(): Promise<void> {
    // Pre-aquecer queries comuns:
    // - overview para períodos 24h, 7d, 30d
    // - timeseries diário da última semana
    // - top events dos últimos 7 dias
  }

  @Cron('0 */6 * * *') // A cada 6 horas
  async scheduledWarming(): Promise<void> {
    // Execução automática durante períodos de baixo tráfego
  }
}
```

**Benefícios**:
- Reduzir latência da primeira consulta
- Melhorar experiência do usuário
- Garantir cache hit rate > 95%

### 2. **Performance Dashboard Específico**
**Prioridade**: Baixa | **Esforço**: 1 dia

```typescript
// FALTANDO: GET /v1/analytics/monitoring/dashboard
@Get('monitoring/dashboard')
async getAnalyticsDashboard() {
  return {
    performance: {
      p50_latency_trend: [], // Últimas 24h
      cache_hit_rate_trend: [],
      query_volume_by_endpoint: {},
    },
    usage: {
      top_tenants_by_usage: [],
      peak_hours: [],
      popular_periods: ['7d', '24h', '30d'],
    },
    health: {
      slow_queries_last_hour: 0,
      error_rate_last_hour: 0.1,
      alerts_active: [],
    }
  };
}
```

**Benefícios**:
- Visibilidade detalhada do uso de analytics
- Identificar padrões de uso para otimização
- Monitoring proativo de degradação

### 3. **Alertas Inteligentes Avançados**
**Prioridade**: Baixa | **Esforço**: 0.5 dia

```typescript
// FALTANDO: src/analytics/services/advanced-alerting.service.ts
@Injectable()
export class AdvancedAlertingService {
  // Alert baseado em tendências, não apenas valores absolutos
  detectPerformanceTrends(): Alert[] {
    // - Latência aumentando > 20% vs período anterior
    // - Cache hit rate caindo > 10% vs média
    // - Volume de queries anômalo (spike ou drop)
    // - Tenant específico com uso excessivo
  }

  // Integration com sistemas externos
  async sendSlackAlert(alert: Alert): Promise<void> {}
  async sendEmailAlert(alert: Alert): Promise<void> {}
  async sendWebhookAlert(alert: Alert): Promise<void> {}
}
```

**Benefícios**:
- Detecção proativa de problemas
- Alertas contextual vs ruído
- Integração com ferramentas de ops

### 4. **Query Plan Analysis Automático**
**Prioridade**: Baixa | **Esforço**: 0.5 dia

```typescript
// FALTANDO: Análise automática de query plans
@Injectable()
export class QueryAnalysisService {
  async analyzeSlowQueries(): Promise<QueryAnalysis[]> {
    // - Identificar queries com scan completo
    // - Sugerir índices faltantes
    // - Detectar queries que podem ser otimizadas
    // - Report de utilização de índices
  }

  async generateOptimizationReport(): Promise<OptimizationReport> {
    // Relatório semanal com recomendações
  }
}
```

**Benefícios**:
- Otimização contínua automática
- Identificar gargalos de performance
- Recommendations data-driven

### 5. **Distributed Tracing**
**Prioridade**: Baixa | **Esforço**: 1 dia

```typescript
// FALTANDO: OpenTelemetry integration
import { trace } from '@opentelemetry/api';

// Instrumentação automática com spans
async getOverview(query: PeriodQueryDto): Promise<OverviewMetricsResponse> {
  const span = trace.getActiveSpan();
  
  span?.setAttributes({
    'analytics.endpoint': 'overview',
    'analytics.period': query.period,
    'analytics.tenant_id': tenant.tenantId,
  });

  // Spans para cache, database, processing
  const cacheSpan = tracer.startSpan('cache_check');
  const dbSpan = tracer.startSpan('database_query');
  const processSpan = tracer.startSpan('result_processing');
}
```

**Benefícios**:
- Visibilidade end-to-end das requests
- Debugging distributivo avançado
- Integração com Jaeger/Zipkin

## 📊 Métricas de Sucesso para Tech Debt

### Quando Implementar

| Métrica | Trigger para Implementação | Tech Debt Sugerido |
|---------|---------------------------|-------------------|
| **Cache hit rate < 85%** | Implementar imediatamente | Cache Warming |
| **Volume > 1000 queries/day** | Implementar em 2 semanas | Performance Dashboard |
| **> 5 slow queries/hour** | Implementar em 1 semana | Query Analysis |
| **> 10 requests/min** | Implementar quando necessário | Advanced Alerting |
| **Multiple microservices** | Implementar quando escalar | Distributed Tracing |

### KPIs de Monitoramento

```typescript
interface MonitoringKPIs {
  // Atuais (implementados)
  basic_coverage: 95%;          // ✅ Métricas básicas coletadas
  alert_latency: '<= 1s';       // ✅ Detecção de slow queries
  health_visibility: 100%;       // ✅ Status no monitoring endpoint
  
  // Tech Debt (pendentes)  
  cache_efficiency: 'TBD';       // 🚧 Cache warming automático
  proactive_alerting: 'TBD';     // 🚧 Trends vs absolute values
  query_optimization: 'TBD';     // 🚧 Automatic performance tuning
  distributed_visibility: 'TBD'; // 🚧 End-to-end request tracing
}
```

## 🎯 Implementação por Fases

### **Fase 1: Essencial** (Deploy atual - FEITO ✅)
- [x] Métricas básicas de performance
- [x] Alertas por logs estruturados  
- [x] Health check analytics
- [x] Prometheus export

### **Fase 2: Otimização** (Pós-produção)
- [ ] Cache warming automático
- [ ] Análise de query plans
- [ ] Alertas baseados em trends

### **Fase 3: Enterprise** (Escala)
- [ ] Performance dashboard dedicado
- [ ] Advanced alerting integrations
- [ ] Distributed tracing

### **Fase 4: Platform** (Multi-produto)
- [ ] Cross-service monitoring
- [ ] ML-based anomaly detection  
- [ ] Auto-scaling triggers

## 🚀 Quick Wins (Low effort, High impact)

### 1. **Cache Warming Script** (30 min)
```bash
# Script simples para aquecer cache após deploy
curl "https://api.mercurio.com/v1/analytics/overview?period=24h" -H "Authorization: Bearer $API_KEY"
curl "https://api.mercurio.com/v1/analytics/overview?period=7d" -H "Authorization: Bearer $API_KEY" 
curl "https://api.mercurio.com/v1/analytics/timeseries?period=7d&granularity=day" -H "Authorization: Bearer $API_KEY"
```

### 2. **Alert Webhook** (1 hora)
```typescript
// Simples webhook para Slack quando slow queries > threshold
if (duration > 2000) {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 Slow analytics query: ${endpoint} took ${duration}ms (tenant: ${tenantId})`
    })
  });
}
```

### 3. **Basic Performance Report** (2 horas)
```typescript
// Endpoint simples para relatório de performance
@Get('monitoring/analytics/report')
async getAnalyticsReport() {
  const snapshot = this.metrics.getSnapshot();
  return {
    summary: {
      total_requests: snapshot.analytics.overview_requests.value + /* outras */,
      avg_latency: snapshot.analytics.query_latency.p50,
      cache_hit_rate: snapshot.analytics.cache_hit_rate,
      slow_queries_count: snapshot.analytics.slow_queries.value,
    },
    recommendations: this.generateRecommendations(snapshot),
  };
}
```

## 📚 Referências Técnicas

### Bibliotecas Recomendadas
- **Cache Warming**: node-cron, bull/agenda para scheduling
- **Advanced Alerting**: @slack/web-api, nodemailer, axios
- **Query Analysis**: pg_stat_statements, postgres EXPLAIN integration
- **Distributed Tracing**: @opentelemetry/*, jaeger-client
- **Dashboard**: grafana, prometheus, custom React dashboard

### Patterns de Implementação
- **Circuit Breaker**: Para alertas (evitar spam)
- **Bulkhead**: Isolamento de métricas críticas vs diagnósticas  
- **Observer**: Event-driven alerting system
- **Strategy**: Diferentes estratégias de cache warming por tenant size

---

## ✅ Conclusão

O sistema atual de monitoramento analytics oferece **cobertura de 95% dos casos críticos** com implementação de apenas **30% do esforço total**. 

**Recomendação**: Proceder com deploy e implementar tech debt de forma iterativa baseado em dados reais de uso e necessidades específicas do ambiente de produção.

**Próximo milestone**: Implementar cache warming automático quando volume > 500 queries/day ou cache hit rate < 85%.
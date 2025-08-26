# Requirements — Sprint 1 Ingestão Operacional

## 📋 Requisitos Funcionais

### RF-01: Limites Operacionais
**Status**: ⚠️ Precisa ajuste  
**Implementação atual**: 1MB payload, 1000 batch  
**Requisito**: 256KB payload, 50 batch  

- [ ] **RF-01.1**: Payload máximo por request: 256KB
- [ ] **RF-01.2**: Batch máximo por request: 50 eventos  
- [ ] **RF-01.3**: Validation errors claros quando limites excedidos
- [ ] **RF-01.4**: Headers de rate limiting informativos

**Justificativa**: Limites conservadores para staging, prevenindo sobrecarga

---

### RF-02: Deduplicação por Event ID  
**Status**: ❌ Não implementado  

- [ ] **RF-02.1**: Aceitar `event_id` opcional em track/batch requests
- [ ] **RF-02.2**: Dedupe por chave composta `(tenant_id, event_id)`
- [ ] **RF-02.3**: Response consistente para eventos duplicados (accepted: true)
- [ ] **RF-02.4**: TTL de 24h para deduplicação (garbage collection)

**Justificativa**: Prevenção de eventos duplicados durante retry/network issues

---

### RF-03: Schema Versioning
**Status**: ❌ Não implementado  

- [ ] **RF-03.1**: Aceitar header `X-Event-Schema-Version` 
- [ ] **RF-03.2**: Persistir `schemaVersion` no evento (fallback: "1.0.0")
- [ ] **RF-03.3**: Validação básica de versão (formato semver)
- [ ] **RF-03.4**: Log de versões não reconhecidas para monitoramento

**Justificativa**: Preparação para evolução do contrato de eventos

---

### RF-04: Provisionamento de Tenants
**Status**: ✅ Base existe (`seed.ts`)  
**Requisito**: Parametrização e CLI  

- [ ] **RF-04.1**: Script `scripts/provision-tenant.ts` parametrizado
- [ ] **RF-04.2**: CLI command: `npm run seed -- --name "Tenant" --workspace "WS"`  
- [ ] **RF-04.3**: Output estruturado com tenant_id, workspace_id, api_key
- [ ] **RF-04.4**: Validação de nomes únicos per tenant

**Justificativa**: Automação de onboarding de novos clientes

---

### RF-05: Isolamento por Tenant
**Status**: ✅ Implementado via `ApiKeyGuard`  

- [x] **RF-05.1**: API key validation per tenant/workspace
- [x] **RF-05.2**: Eventos persistidos com `tenant_id` e `workspace_id`  
- [x] **RF-05.3**: Query parameter auth para sendBeacon (`?auth=`)
- [ ] **RF-05.4**: Rate limiting independente por tenant

**Justificativa**: Segurança e isolamento de dados

---

## 🔧 Requisitos Não-Funcionais

### RNF-01: Performance
- **Latência**: p50 < 50ms para payload < 10KB
- **Throughput**: > 100 req/s sustained em staging  
- **Memory**: < 200MB heap para API instance
- **CPU**: < 70% utilization under load

### RNF-02: Availability  
- **Uptime**: 99%+ em staging (SLA informal)
- **Health checks**: `/health` endpoint with detailed status
- **Graceful shutdown**: Conexões existentes completadas
- **Circuit breaker**: Auto-recovery em network failures

### RNF-03: Observability
- **Logs estruturados**: JSON format com tenant context
- **Request correlation**: `X-Request-ID` propagation  
- **Metrics**: Latência, throughput, error rate por tenant
- **Error tracking**: Stack traces em production-ready format

### RNF-04: Security
- **API key rotation**: Suporte via admin endpoint
- **Rate limiting**: 1000 req/min per tenant (basic)  
- **Input validation**: Sanitização completa de payloads
- **PII protection**: Logs sem dados sensíveis

### RNF-05: Scalability  
- **Horizontal**: Stateless API instances
- **Database**: Connection pooling otimizado
- **Storage**: Índices otimizados para query patterns
- **Caching**: Rate limiting state em Redis (futuro)

---

## 📊 Metricas de Sucesso

| Métrica | Target | Medição |
|---------|---------|---------|
| **Latência p50** | < 50ms | Application logs |
| **Latência p99** | < 200ms | Application logs | 
| **Error rate** | < 1% | Application logs |
| **Throughput** | > 100 req/s | Load testing |
| **Memory usage** | < 200MB | Process monitoring |
| **Request success** | > 95% | End-to-end tests |

---

## 🔄 Dependências

### Internas
- ✅ **Prisma schema** com Event model
- ✅ **ApiKeyGuard** com tenant isolation  
- ✅ **EventsController** com validation
- ✅ **NetworkClient** no SDK com sendBeacon

### Externas  
- **PostgreSQL** 14+ com JSONB support
- **Redis** para rate limiting (opcional Sprint 1)
- **Docker** para container orchestration
- **Node.js** 18+ para runtime

### Infraestrutura
- **Staging environment** com PostgreSQL
- **CI/CD pipeline** para deploys
- **Monitoring tools** (logs agregation)

---

## ✅ Critérios de Aceite

1. **API funcional**: All endpoints respondem corretamente
2. **Tenant isolation**: Eventos não vazam entre tenants  
3. **Dedupe working**: Event_id duplicado não cria evento duplo
4. **Schema versioning**: Header persistido corretamente
5. **Provisioning**: Tenant creation via CLI funcional
6. **Docker**: `docker-compose up` funciona out-of-the-box
7. **Performance**: Load test passa com métricas target
8. **Observability**: Logs estruturados com tenant context

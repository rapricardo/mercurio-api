# Sprint 1 — Ingestão Operacional

**Objetivo**: Receber eventos com isolamento por tenant e fluxo de provisionamento simples em staging.

**Duração**: 1-2 semanas  
**Prioridade**: HIGH - Fundação para integração do frontend

## 🎯 Escopo

### Core Features
- ✅ **Base de eventos** já implementada (`EventsController`, `EventProcessor`)
- ✅ **Isolamento por tenant** via `ApiKeyGuard` 
- ✅ **sendBeacon compatibility** para reliability
- 🔄 **Limites operacionais**: payload ≤256KB, batch ≤50
- 🔄 **Dedupe por event_id**: `(tenant_id, event_id)` único
- 🔄 **Schema versioning**: header `X-Event-Schema-Version`
- 🔄 **Provisionamento**: CLI parametrizado
- 🔄 **Infra staging**: docker-compose + health checks
- 🔄 **Observabilidade**: logs estruturados + correlação

### Operational Readiness
- **Rate limiting** básico por tenant  
- **Monitoring** de latência p50 < 50ms
- **Documentation** completa da API
- **Scripts** de deployment/seeding

## 📊 Critérios de Aceite

1. **Funcional**:
   - ✅ Receber `track`, `batch`, `identify` com chaves reais
   - ✅ Eventos persistidos e isolados por tenant  
   - 🔄 Dedupe funcional via `event_id` opcional
   - 🔄 Schema versioning persistido corretamente

2. **Performance**: 
   - 95%+ requests válidos processados
   - Latência p50 < 50ms para payloads pequenos
   - Throughput > 100 req/s em staging

3. **Operacional**:
   - 🔄 Provisionamento de tenant via CLI
   - 🔄 Docker-compose funcional
   - 🔄 Logs com contexto tenant/workspace
   - 🔄 Health checks operacionais

## 🗂️ Especificações

| Documento | Descrição |
|-----------|-----------|
| [`requirements.md`](./requirements.md) | Requisitos funcionais e não-funcionais |
| [`api-changes.md`](./api-changes.md) | Mudanças na API (limites, dedupe, headers) |
| [`provisioning.md`](./provisioning.md) | Scripts de provisionamento e CLI |
| [`infrastructure.md`](./infrastructure.md) | Docker-compose, .env, health checks |
| [`observability.md`](./observability.md) | Logs estruturados e correlação |
| [`testing-acceptance.md`](./testing-acceptance.md) | Testes e critérios de aceite |
| [`implementation-roadmap.md`](./implementation-roadmap.md) | Cronograma e milestones |

## 🚀 Valor de Negócio

1. **Frontend Team Unblocked**: Pode começar integração real com SDK
2. **Production Ready Foundation**: Base sólida para escalar
3. **Tenant Isolation**: Segurança e compliance desde o início  
4. **Observability**: Debug e monitoramento operacional

## ⚠️ Riscos & Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Dedupe parcial** | Medium | Começar com índice + upsert, evolir no Sprint 2 |
| **Rate limiting básico** | Low | Implementação simples com Redis, evoluir depois |
| **Schema evolution** | Low | Versionamento preparado, compatibilidade mantida |

## 🔄 Próximos Sprints

- **Sprint 2**: Queue assíncrona, métricas avançadas, alerting
- **Sprint 3**: Multi-region, retention policies, analytics queries
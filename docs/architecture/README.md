# ARCHITECTURE — Mercurio V1

## Visão de contexto
- Fontes: Web via GTM (padrão único V1).
- Ingestão: API de coleta assíncrona com validação de esquema e HMAC.
- Processamento: persistência transacional (Postgres) e agregações de funil sob demanda.
- Consumo: API de consulta (eventos e métricas) e painel web (builder + dashboards).

## Componentes
- API de Ingestão: `POST /v1/ingest/events`, `POST /v1/ingest/identify`.
- Validação: JSON Schema por `schema_version` (rejeita/dropeia eventos inválidos com motivo rastreável).
- Armazenamento: Postgres (metadados, eventos, funis, publicações). ClickHouse considerado no futuro para escala.
- Serviço de Métricas de Funil: resolve regras de match por etapa e calcula progressões em janelas configuráveis.
- API de Consulta: métricas por funil/etapa, listagem/filtragem de eventos.
- Frontend: construtor de funis (React) e dashboards.

## Fluxos principais
1) Ingestão: GTM envia batch (até 50 eventos) → autenticação HMAC → validação → persistência.
2) Identidade: evento identify com email/telefone → criação de `lead_id` → vínculo com `anonymous_id`.
3) Publicação de funil: snapshot imutável das regras → consultas usam snapshot para consistência.
4) Métricas: cálculo por janela (ex.: 7 dias) com taxas de step→step e tempos entre etapas.

## 4+1
- Cenários (use cases): ingestão, unificação, publicação, análise.
- Lógico: módulos de ingestão, identidade, funil, métricas, consulta, UI.
- Processo: ingestão assíncrona, consultas síncronas cacheáveis.
- Desenvolvimento: monorepo (`apps/api`, `apps/web`, `packages/shared`, `docs/`).
- Implantação: ambientes dev/stg/prod, migrações, observabilidade.

## Decisões (ADRs)
- Tech Stack (proposta): Node.js (NestJS) + Postgres; React (Next.js) para web. Ver [ADR/0001-tech-stack.md](../ADR/0001-tech-stack.md).

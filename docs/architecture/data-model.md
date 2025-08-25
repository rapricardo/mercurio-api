# DATA_MODEL — Entidades e Relacionamentos (V1)

## Multi-tenant
- Todas as tabelas de domínio incluem `tenant_id` e `workspace_id`.
- Partições/índices por `tenant_id`, `workspace_id` e data.

## Entidades principais
- tenant: `id`, `name`, `status`, `created_at`.
- workspace: `id`, `tenant_id`, `name`, `created_at`.
- api_key: `id`, `workspace_id`, `name`, `key_hash`, `scopes`, `created_at`, `last_used_at`, `revoked_at`.
- visitor: `anonymous_id`, `tenant_id`, `workspace_id`, `first_seen_at`, `last_seen_at`, `first_utm` (json), `last_utm` (json), `last_device` (json), `last_geo` (json).
- lead: `id` (lead_id), `tenant_id`, `workspace_id`, `email_enc`, `email_fingerprint`, `phone_enc`, `phone_fingerprint`, `created_at`, `updated_at`.
- identity_link: `tenant_id`, `workspace_id`, `anonymous_id`, `lead_id`, `first_at`, `last_at`.
- session: `session_id`, `tenant_id`, `workspace_id`, `anonymous_id`, `started_at`, `ended_at`, `user_agent`.
- event: `id`, `schema_version`, `event_name`, `timestamp`, `tenant_id`, `workspace_id`, `anonymous_id`, `lead_id?`, `session_id?`, `page` (json), `utm` (json), `device` (json), `geo` (json), `props` (jsonb), `ingested_at`.
- funnel: `id`, `tenant_id`, `workspace_id`, `name`, `description?`, `created_by`, `created_at`, `archived_at?`.
- funnel_version: `id`, `funnel_id`, `version`, `state` (draft), `created_by`, `created_at`.
- funnel_publication: `id`, `funnel_id`, `version`, `published_at`, `window_days` (ex.: 7), `notes?`.
- funnel_step: `id`, `funnel_version_id`, `order`, `type` (start|page|event|decision|conversion), `label`, `metadata` (json).
- funnel_step_match: `id`, `funnel_step_id`, `kind` (page|event), `rules` (json: url_match, event_name, prop_filters, etc.).

## Relacionamentos
- workspace → api_key (1:N)
- visitor (anonymous_id) ↔ identity_link ↔ lead (N:N via vínculos)
- funnel → funnel_version (1:N) → funnel_step (1:N) → funnel_step_match (1:N)
- funnel → funnel_publication (1:N) (snapshot por versão)

## Índices sugeridos
- event: (`tenant_id`, `workspace_id`, `timestamp` desc), (`event_name`, `timestamp`), (`anonymous_id`), (`lead_id`).
- identity_link: (`tenant_id`, `workspace_id`, `anonymous_id`), (`lead_id`).
- funnel_step_match: (`funnel_step_id`).

## Notas
- JSONB para `props` e colunas compostas (`page`, `utm`, `device`, `geo`) no Postgres V1.
- Futuro: mover fatos de eventos para data store colunar (ex.: ClickHouse) mantendo Postgres para metadados e chaves.

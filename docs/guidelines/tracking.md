# Tracking — Convenções de Eventos

Status: Draft
Última atualização: 2025-08-23

## Objetivo
Padronizar nomes, campos e práticas de instrumentação para alta qualidade de dados.

## Nomenclatura
- `event_name` em snake_case, iniciando por letra: `page_view`, `view_item`, `add_to_cart`, `begin_checkout`, `purchase`.
- Campos em snake_case. Não use abreviações obscuras.

## Campos Reservados
- Obrigatórios: `schema_version`, `event_name`, `timestamp`, `tenant_id`, `workspace_id`, `anonymous_id`.
- Recomendados: `event_id` (ULID), `session_id`.
- Estruturados: `page{ url, path, referrer, title }`, `utm{ source, medium, campaign, term?, content? }`, `device{ user_agent, os?, browser?, device_type? }`, `geo{ country?, region?, city? }`.
- Custom: `props{ ... }` (até 50 chaves por evento; nesting máximo: 2 níveis).

## PII e Identify
- PII (email/telefone) nunca em `props`. Use `POST /v1/ingest/identify`.
- Sempre condicionar PII a consentimento válido e registrado.

## Deduplicação
- Envie `event_id` quando possível. O backend deduplica idempotentemente.

## Timestamps e Timezone
- Sempre UTC ISO‑8601. Rejeitar/ajustar eventos fora da janela de ±48h.

## UTM e Atribuição
- Capture first‑touch e last‑touch no client. Promover first‑touch do visitor ao lead quando identificado.

## Anonymous e Sessões
- `anonymous_id` via cookie 1st‑party `mercurio_aid` (httpOnly quando possível) com fallback a localStorage.
- `session_id` reseta após 30 min de inatividade (configurável).

## Tamanho e Limites
- Body ≤ 256 KB; lote ≤ 50 eventos; `props` ≤ 50 chaves; strings ≤ 1 KB por valor.

## Qualidade
- Valide antes de enviar (tags GTM com validação básica).
- Adote naming review para novos `event_name`. Registre exemplos e objetivo do evento.

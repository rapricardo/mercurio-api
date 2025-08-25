# API Style — Padrões de API (REST)

Status: Draft
Última atualização: 2025-08-23

## Objetivo
Garantir consistência e previsibilidade das APIs (ingestão e consulta) do Mercurio.

## Versionamento
- Prefixo de versão no path: `/v1/...`.
- Mudanças breaking criam nova versão (`/v2`). Pequenas adições são backward‑compatible.

## Endpoints e Naming
- Recursos em kebab-case no path (ex.: `/ingest/events`, `/funnels/{id}/metrics`).
- Ações não CRUD explicitadas no path (ex.: `/ingest/identify`).
- IDs opacos (ULID/UUID com prefixo), nunca IDs incrementais.

## Campos e Tipos
- JSON sempre; `Content-Type: application/json`.
- Timestamps: ISO‑8601 UTC (`2025-01-01T12:34:56.789Z`).
- Nomes de campos em snake_case. Valores boolean/number/string; use objetos para grupos (`page`, `utm`, ...).

## Respostas
- Envelopes simples e explícitos. Para ingestão: `202 Accepted` com `{ accepted, rejected, errors[] }`.
- Para listas: retorno com `data[]` e paginação por cursor.

## Erros
- Formato: `{ error: { code: string, message: string, details?: any } }`.
- Códigos padronizados: `unauthorized`, `invalid_signature`, `invalid_schema`, `payload_too_large`, `replay_detected`, `invalid_origin`, `rate_limited`, `not_found`, `conflict`, `internal_error`.
- HTTP Status: 4xx para erros do cliente; 5xx para servidor.

## Paginação (cursor)
- Parâmetros: `limit` (1..1000), `cursor` (opaco). Resposta inclui `next_cursor`.
- Exemplo resposta: `{ data: [...], next_cursor: "..." }`.

## Idempotência
- Ingestão deve deduplicar por `event_id` quando presente.
- Endpoints que criam recursos podem aceitar cabeçalho `Idempotency-Key`.

## Segurança
- Ingestão: sGTM (HMAC) ou client‑side (Write Key) conforme `docs/api/README.md`.
- CORS restritivo; origins por chave. Janela anti‑replay (timestamp) e `nonce` no client‑side.
- Nunca retornar PII em logs/respostas de erro.

## Headers Padrão
- Request: `X-Mercurio-Key`/`X-Mercurio-WriteKey`, `X-Mercurio-Timestamp`, `X-Mercurio-Nonce?`.
- Resposta (consulta): `X-RateLimit-*` quando aplicável.

## Depreciação
- Anunciar em `ROADMAP` + cabeçalho `Deprecation: true` + `Sunset: <date>` quando aplicável.

## Exemplos
- Erro de schema: `400 { error: { code: "invalid_schema", message: "timestamp required" } }`.
- Paginação: `GET /events?limit=500&cursor=eyJvZmZzZXQiOiIyMDI1LTAxLTAx..."`.

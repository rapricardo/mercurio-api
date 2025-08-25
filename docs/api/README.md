# API — Ingestão e Consulta (V1)

Base URL (exemplo): `/v1`

## Autenticação
- Ingestão (dois modos):
  - Server-side GTM (recomendado) — API Key + Secret: `X-Mercurio-Key` + `X-Mercurio-Timestamp` + `X-Mercurio-Signature`.
    - Assinatura: `hex(hmac_sha256(secret, timestamp + "." + raw_body))`.
    - Janela de tempo: aceitar apenas se `|now - timestamp|` ≤ 5 min (configurável).
  - Client-side GTM (browser) — Write Key pública: `X-Mercurio-WriteKey` + `X-Mercurio-Timestamp` + `X-Mercurio-Nonce`.
    - Proteções: CORS com origins permitidos por chave, allowlist de domínios, janela de tempo (≤ 5 min), deduplicação de `nonce` (TTL), rate limiting e detecção de abuso.
    - Opcional: `X-Mercurio-Token` (JWT efêmero emitido pelo backend do cliente) para reforçar confiança do domínio.
- Painel: JWT (futuro) com escopo de tenant/workspace.

## Ingestão
- POST `/ingest/events`
  - Body: objeto com `schema_version` e `events: []` (até 50).
  - Respostas: `202 Accepted` com `{ accepted: n, rejected: m, errors: [{ index, code, message }] }`.
  - Autenticação: sGTM (HMAC) OU client-side (Write Key). Se ambos enviados, HMAC tem precedência.
- POST `/ingest/identify`
  - Body: `{ schema_version, tenant_id, workspace_id, anonymous_id, timestamp, traits: { email?, phone? }, consent?: {...} }`.
  - Respostas: `202 Accepted` com `{ lead_id, linked: true }`.
  - Autenticação: igual a `/ingest/events`.

## Consulta
- GET `/funnels/{funnel_id}/metrics?from=...&to=...&window_days=7`
  - Retorna métricas agregadas por etapa para a última publicação ou para `publication_id` se fornecido.
  - Resposta: `{ publication_id, steps: [{ step_id, label, entered, converted, drop_off, rate, p50_time_s?, p95_time_s? }] }`.
- GET `/events?event_name=...&from=...&to=...&limit=...&anonymous_id=...&lead_id=...`
  - Lista eventos com filtros comuns. Paginado (cursor).

## Erros
- Formato: `{ error: { code: string, message: string, details?: any } }`.
- Códigos típicos: `unauthorized`, `invalid_signature`, `invalid_schema`, `payload_too_large`, `replay_detected`, `invalid_origin`, `rate_limited`.

## Rate limiting
- Por API key (ingestão) e por usuário (consulta). Políticas a definir no deploy.
  - Client-side (Write Key): limites mais conservadores e bloqueio por origem/IP.
  - sGTM (HMAC): limites maiores por confiança do canal server-to-server.

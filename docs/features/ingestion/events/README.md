# EVENTS_SPEC — Padrão de Eventos (GTM) V1

Contrato para envio de eventos ao Mercurio a partir do Google Tag Manager. Todos os eventos devem incluir `schema_version` e campos obrigatórios. Campos adicionais vão em `props`.

## Endpoint
- URL: `POST /v1/ingest/events`
- Autenticação (dois modos):
  - Server-side GTM (recomendado) — `X-Mercurio-Key`, `X-Mercurio-Timestamp`, `X-Mercurio-Signature`.
    - Assinatura: `hex(hmac_sha256(secret, timestamp + "." + raw_body))`.
  - Client-side GTM (browser) — `X-Mercurio-WriteKey`, `X-Mercurio-Timestamp`, `X-Mercurio-Nonce`.
    - Proteções: CORS (origins permitidos), allowlist de domínios por chave, janela de tempo (≤ 5 min), deduplicação de nonce e rate limiting.
- Conteúdo: `application/json`
- Lote: até 50 eventos por requisição.
- Resposta: `202 Accepted` com resumo e erros por item, se houver.

## Campos do evento (payload)
- schema_version (string, obrigatório): versão do contrato, ex.: `v1`.
- event_name (string, obrigatório): nome do evento, ex.: `page_view`, `add_to_cart`, `purchase`.
- event_id (string, opcional mas recomendado): id único (UUID/ULID) para deduplicação.
- timestamp (string ISO-8601, obrigatório): momento do evento em UTC.
- tenant_id (string, obrigatório): id do tenant.
- workspace_id (string, obrigatório): id do workspace dentro do tenant.
- anonymous_id (string, obrigatório): id anônimo do visitante.
- lead_id (string, opcional): id do lead se conhecido.
- session_id (string, opcional): id da sessão.
- page (objeto, opcional): `url`, `path`, `referrer`, `title`.
- utm (objeto, opcional): `source`, `medium`, `campaign`, `term`, `content`.
- device (objeto, opcional): `user_agent`, `os`, `browser`, `device_type`.
- geo (objeto, opcional): `country`, `region`, `city` (sem IP bruto).
- props (objeto, opcional): propriedades específicas do evento.

## Exemplo (lote)
```
{
  "schema_version": "v1",
  "events": [
    {
      "event_name": "page_view",
      "event_id": "01J3Z3W4H4TY7S9Z8KQ0X2B7VA",
      "timestamp": "2025-01-01T12:34:56.789Z",
      "tenant_id": "tn_123",
      "workspace_id": "ws_abc",
      "anonymous_id": "a_9d1f...",
      "session_id": "s_7b2c...",
      "page": { "url": "https://site.com/p", "path": "/p", "referrer": "https://google.com", "title": "Página" },
      "utm": { "source": "google", "medium": "cpc", "campaign": "verao" },
      "device": { "user_agent": "...", "os": "iOS", "browser": "Safari", "device_type": "mobile" },
      "geo": { "country": "BR", "region": "SP", "city": "São Paulo" },
      "props": { "ab_variant": "B" }
    },
    {
      "event_name": "purchase",
      "event_id": "01J3Z3W5...",
      "timestamp": "2025-01-01T12:40:00.000Z",
      "tenant_id": "tn_123",
      "workspace_id": "ws_abc",
      "anonymous_id": "a_9d1f...",
      "lead_id": "ld_88c3...",
      "session_id": "s_7b2c...",
      "page": { "url": "https://site.com/checkout/sucesso", "path": "/checkout/sucesso" },
      "utm": { "source": "google", "medium": "cpc", "campaign": "verao" },
      "props": { "order_id": "o_123", "value": 299.9, "currency": "BRL" }
    }
  ]
}
```

## Regras e limites
- Tamanho máximo do corpo: 256 KB por requisição.
- `events.length` ≤ 50.
- `event_name`: snake_case, começando com letra (`[a-z][a-z0-9_]*`).
- PII em `props` deve ser evitada; quando necessária, usar eventos `identify`.
- `timestamp` fora de uma janela aceitável (±48h) pode ser rejeitado.
 - `X-Mercurio-Timestamp` fora da janela (±5 min) resulta em `replay_detected`.
 - `X-Mercurio-Nonce` repetido em janela de TTL resulta em `replay_detected` (client-side).

## Assinatura HMAC
- Cálculo (sGTM): `hex(hmac_sha256(secret, timestamp + "." + raw_body))`.
- Cabeçalhos: `X-Mercurio-Key`, `X-Mercurio-Timestamp`, `X-Mercurio-Signature`.
- Rejeitar se assinatura inválida, chave revogada ou timestamp fora da janela.

## Versionamento
- Incrementar `schema_version` para mudanças incompatíveis.
- Publicar JSON Schema correspondente a cada versão (futuro: `docs/schemas/event.v1.json`).

## GTM (diretrizes V1)
- Disparar via tag Custom Template/HTTP Request.
- Popular `anonymous_id` a partir de cookie 1st-party (`mercurio_aid`) com fallback localStorage.
- `identify`: enviar separadamente quando email/telefone forem capturados (ver API).

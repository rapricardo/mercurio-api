# API Style — Padrões de API (REST)

Status: Draft
Última atualização: 2025-09-05

## Objetivo
Garantir consistência e previsibilidade das APIs (ingestão e gestão) do Mercurio.

## Versionamento
- Prefixo de versão no path: `/v1/...`.
- Mudanças breaking criam nova versão (`/v2`). Pequenas adições são backward‑compatible.

## Endpoints e Naming
- Recursos em kebab-case no path (ex.: `/ingest/events`, `/funnels/{id}/metrics`).
- Ações não CRUD explicitadas no path (ex.: `/ingest/identify`).
- IDs opacos quando expostos externamente (ver IDs Externos).

## Padrão de Campos por Domínio
- Ingestão/telemetria: `snake_case` (ex.: `event_name`, `anonymous_id`, `schema_version`).
- Gestão/Admin (CRUD Tenants/Workspaces/Analytics): `camelCase` (ex.: `tenantName`, `pageSize`).
- Documente no endpoint qual padrão é usado e mantenha coerência por domínio.

## Campos e Tipos
- JSON sempre; `Content-Type: application/json`.
- Timestamps: ISO‑8601 UTC (`2025-01-01T12:34:56.789Z`).
- Valores boolean/number/string; use objetos para grupos (`page`, `utm`, `device`, `geo`).

## IDs Externos
- Política atual: APIs de gestão retornam IDs numéricos como string (ex.: `"id": "123"`).
- Prefixos reservados para exposição externa/SDKs: `tn_`, `ws_`, `ld_`, `ak_`, `fn_`, `a_`, `s_`.
- Roadmap: padronizar prefixos nos contratos públicos antes de adoção ampla.

## Respostas
- Envelopes simples e explícitos.
- Ingestão: `202 Accepted` com `{ accepted, rejected, errors[] }`.
- Listas: `{ data: [...], pagination: { total, page, pageSize, ... } }` ou cursor `{ data, next_cursor }` (consistência por família de endpoints).

## Erros
- Formato: `{ error: { code: string, message: string, details?: any } }`.
- Códigos: `unauthorized`, `invalid_signature`, `invalid_schema`, `payload_too_large`, `replay_detected`, `invalid_origin`, `rate_limited`, `not_found`, `conflict`, `internal_error`.
- 401/403: autenticação/autorizações; 409: conflitos/idempotência; 5xx: servidor.

## Paginação
- Cursor: `limit` (1..1000), `cursor` (opaco) → `{ data, next_cursor }`.
- Paginador clássico: `page`, `pageSize`, `sortBy`, `sortOrder` → `{ data, pagination }`.

## Idempotência
- Ingestão deduplica por `event_id` quando presente.
- Endpoints de criação podem aceitar `Idempotency-Key`.

## Segurança
- Ingestão: sGTM (HMAC) ou client‑side (Write Key) — ver `docs/api/ingestion.md`.
- Híbrido (JWT Supabase + API Key): JWT tem precedência; documentar cabeçalhos e erros.
- CORS restritivo; origins por chave. Anti‑replay (timestamp/nonce). Nunca logar PII.

## Headers Padrão
- Request: `Authorization: Bearer <jwt|ak_...>`, `X-Mercurio-*` quando aplicável.
- Resposta: `X-RateLimit-*` quando aplicável.

## Depreciação
- Anunciar em `ROADMAP` + `Deprecation: true` + `Sunset: <date>`.

## Checklist (PR)
- Versão correta (`/v1`).
- Padrão de campos coerente (snake_case vs camelCase).
- Erros padronizados; códigos corretos (401/403/409/5xx).
- Padrão de paginação consistente.
- Exemplos atualizados (requests/responses).

## Exemplos (Gestão/Admin)

### Listar Tenants (camelCase, paginação clássica)
Request:
```
GET /v1/tenants?page=1&pageSize=10&includeStats=false
Authorization: Bearer <jwt>
Content-Type: application/json
```
Response 200:
```
{
  "data": [
    { "id": "123", "name": "Acme", "status": "active", "createdAt": "2025-09-05T12:34:56.789Z" }
  ],
  "pagination": { "total": 1, "page": 1, "pageSize": 10, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false }
}
```

### Obter Tenant por ID
Request:
```
GET /v1/tenants/123
Authorization: Bearer <jwt>
```
Response 200:
```
{ "id": "123", "name": "Acme", "status": "active", "createdAt": "2025-09-05T12:34:56.789Z" }
```

### Onboarding (criar tenant + workspace para o usuário atual)
Request:
```
POST /v1/onboarding
Authorization: Bearer <jwt>
Content-Type: application/json

{ "tenantName": "Acme", "workspaceName": "Default" }
```
Response 201:
```
{
  "tenant": { "id": "123", "name": "Acme", "status": "active", "createdAt": "2025-09-05T12:34:56.789Z" },
  "workspace": { "id": "456", "tenantId": "123", "name": "Default", "createdAt": "2025-09-05T12:34:56.789Z" },
  "userAccess": { "tenantId": "123", "workspaceId": "456", "role": "admin", "grantedAt": "2025-09-05T12:34:56.789Z" }
}
```

### Listar Workspaces do Tenant
Request:
```
GET /v1/tenants/123/workspaces?page=1&pageSize=10
Authorization: Bearer <jwt>
```
Response 200:
```
{
  "data": [ { "id": "456", "tenantId": "123", "name": "Default", "createdAt": "2025-09-05T12:34:56.789Z" } ],
  "pagination": { "total": 1, "page": 1, "pageSize": 10, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false },
  "tenant": { "id": "123", "name": "Acme", "status": "active" }
}
```

### Criar Tenant
Request:
```
POST /v1/tenants
Authorization: Bearer <jwt-admin>
Content-Type: application/json

{ "name": "Nova Empresa" }
```
Response 201:
```
{ "id": "200", "name": "Nova Empresa", "status": "active", "createdAt": "2025-09-05T12:34:56.789Z" }
```

### Atualizar Tenant
Request:
```
PATCH /v1/tenants/200
Authorization: Bearer <jwt-admin>
Content-Type: application/json

{ "name": "Empresa Renomeada" }
```
Response 200:
```
{ "id": "200", "name": "Empresa Renomeada", "status": "active", "createdAt": "2025-09-05T12:34:56.789Z" }
```

### Criar Workspace
Request:
```
POST /v1/tenants/200/workspaces
Authorization: Bearer <jwt>
Content-Type: application/json

{ "name": "Marketing" }
```
Response 201:
```
{ "id": "300", "tenantId": "200", "name": "Marketing", "createdAt": "2025-09-05T12:34:56.789Z" }
```

### Atualizar Workspace
Request:
```
PATCH /v1/tenants/200/workspaces/300
Authorization: Bearer <jwt-editor|admin>
Content-Type: application/json

{ "name": "Marketing Global" }
```
Response 200:
```
{ "id": "300", "tenantId": "200", "name": "Marketing Global", "createdAt": "2025-09-05T12:34:56.789Z" }
```

### Erros padronizados
```
401 Unauthorized
{ "error": { "code": "unauthorized", "message": "Invalid JWT" } }

403 Forbidden
{ "error": { "code": "forbidden", "message": "Insufficient permissions" } }

409 Conflict
{ "error": { "code": "conflict", "message": "Tenant name already exists" } }
```

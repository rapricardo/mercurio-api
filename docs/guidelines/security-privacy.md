# SECURITY_PRIVACY — Segurança e Privacidade (LGPD)

Status: Updated
Última atualização: 2025-09-05

## Princípios
- Minimização: coletar apenas o necessário para o objetivo (analytics de funil).
- Transparência e consentimento: registrar base legal, permitir opt-out.
- Pseudonimização por padrão; PII separada e controlada.

## PII
- Email/telefone armazenados criptografados em repouso.
- Fingerprint HMAC-SHA256 por tenant para matching sem expor PII em claro.
- Acesso à PII restrito por escopo/necessidade (controle de acesso futuro).

## Retenção e remoção
- Retenção padrão a definir (ex.: 24 meses para eventos; 36 meses para leads, revisável).
- DSAR: exportação/remoção por `lead_id`/email com auditoria de execução.

## Consentimento
- Registro de consentimento: `{ lead_id/anonymous_id, granted:boolean, timestamp, policy_version, source }`.
- Gatear `identify` e PII por consentimento válido.

## Rede e dados em trânsito
- TLS obrigatório.
- Ingestão — Modos e controles:
  - sGTM (recomendado): HMAC (`timestamp.raw_body`) com janela de 5 min, proteção contra replay.
  - Client-side (Write Key): CORS restritivo, allowlist de domínios, `timestamp` + `nonce` com deduplicação (TTL), rate limiting por origem/IP, heurísticas anti-abuso (UA, velocidade), e opção de JWT efêmero emitido pelo backend do cliente.

## Logs e auditoria
- Logs estruturados sem PII; mascarar valores sensíveis.
- Auditoria para ações administrativas (criação/revogação de API keys, publicações de funil, DSAR).

## JWT Supabase (Autenticação Híbrida)
- Issuer: usar `${SUPABASE_URL}/auth/v1` (tokens do GoTrue). Validar também `aud = "authenticated"`.
- Algoritmo: HS256 (padrão). Se usar RS256, adotar JWKS do GoTrue. Tornar algoritmo configurável.
- Cache: TTL curto (ex.: 5 min) para validação; invalidação rápida em falhas.
- Logs: nunca logar o token (nem prefixos). Logar apenas `sub`, `iss` normalizado e hash do token.
- Referência: docs/features/authentication/hybrid-auth-guide.md.

## PgBouncer + Prisma (Operação)
- Produção com Pooler (porta 6543): `?pgbouncer=true&connection_limit=1` na `DATABASE_URL` para desabilitar prepared statements.
- Sintoma comum: Postgres 42P05 `prepared statement "sX" already exists`.
- Mitigação: corrigir `DATABASE_URL`, aplicar retry com reset de conexão, e health que alerta configuração incorreta.
- Ver guia: docs/guidelines/operational-db.md.

## Checklist Pré‑Release (Segurança)
- CORS: origins permitidos alinhados às chaves/ambiente; `credentials` apenas quando necessário.
- JWT: issuer `${SUPABASE_URL}/auth/v1`, `aud='authenticated'`, segredo/algoritmo corretos; sem logs de token.
- API Keys: escopos validados; rate limiting habilitado e testado.
- PII: sem PII em logs; encryption ativa (KEK/DEKs configuradas) e fingerprints HMAC por tenant.
- PgBouncer: `DATABASE_URL` com `pgbouncer=true&connection_limit=1` (quando usando pooler), sem 42P05 nos logs.
- Observabilidade: métricas e logs estruturados ativos; alertas para 401/403/5xx anormais.

## Recomendações operacionais
- Priorizar sGTM para contas com maior risco/regulatório.
- Monitorar taxas de rejeição por motivo (`invalid_signature`, `invalid_origin`, `replay_detected`).
- Implementar WAF e bloqueios automáticos por IP/origem em padrões de abuso.

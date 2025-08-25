# SECURITY_PRIVACY — Segurança e Privacidade (LGPD)

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

## Recomendações operacionais
- Priorizar sGTM para contas com maior risco/regulatório.
- Monitorar taxas de rejeição por motivo (`invalid_signature`, `invalid_origin`, `replay_detected`).
- Implementar WAF e bloqueios automáticos por IP/origem em padrões de abuso.

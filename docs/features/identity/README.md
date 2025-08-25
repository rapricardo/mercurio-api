# IDENTITY — Modelo de Identidade

## Objetivos
- Rastrear jornada desde o anônimo até a identificação (lead) preservando o histórico.
- Minimizar PII, aplicar consentimento e possibilitar opt-out.

## Identificadores
- anonymous_id: gerado cliente (cookie 1st-party `mercurio_aid`, httpOnly quando possível; fallback localStorage). Estável por navegador/dispositivo.
- session_id: janela de interação, reinicia após inatividade (ex.: 30 min).
- lead_id: criado quando recebemos PII válida (email/telefone), único por lead.

## Unificação (merge)
- Recebendo `identify` com email/telefone:
  - Criar/obter `lead_id` e vincular ao(s) `anonymous_id` conhecido(s).
  - Manter `anonymous_id` para histórico; `lead_id` passa a acompanhar eventos subsequentes.
- Estratégia de match de PII segura:
  - Persistir email/telefone criptografados (at-rest) e fingerprint HMAC-SHA256 por tenant para matching.

## Consentimento e privacidade
- Coleta de PII condicionada a consentimento explícito e registrável (timestamp, fonte, versão do termo).
- Suportar DSAR (acesso/remoção) por `lead_id`/email.
- Não armazenar IP bruto; derivar apenas geolocalização aproximada.

## API Identify (V1)
- Endpoint: `POST /v1/ingest/identify`
- Campos mínimos: `schema_version`, `tenant_id`, `workspace_id`, `anonymous_id`, `timestamp`, `traits: { email?, phone? }`.
- Regras: validar formato de email/telefone, aplicar consentimento e políticas de minimização.

# SDK ↔ API Alignment — Débitos Técnicos

Status: Draft
Owner: SDK Core
Atualizado: 2025-08-24

## 1) Auth em sendBeacon (SDK) × ApiKeyGuard (API)
- Contexto: `sendBeacon` não envia cabeçalhos; SDK usa `?auth=<ak_...>`; guard só lê `Authorization`.
- Risco: Alto — perda de eventos em unload/visibilidade; difícil reproduzir.
- Esforço: Baixo/Médio.
- Proposta:
  - API: em `apps/api/src/common/auth/api-key.guard.ts`, se `Authorization` ausente, aceitar `auth` (query) OU `x-api-key` (header). Mas apenas para rotas `POST /v1/events/*`.
  - Log: mascarar chave (exibir só prefixo + 6 chars), nunca logar a chave inteira.
  - SDK: manter `sendBeacon` atrás de flag (`useBeacon: true`) e documentar fallback.
  - Testes: e2e (track/identify com beacon) e unit do guard.

## 2) Header proibido `User-Agent`
- Contexto: `fetch`/XHR no browser não permite definir `User-Agent`.
- Risco: Médio — pode quebrar requests em alguns browsers.
- Esforço: Baixo.
- Proposta:
  - SDK: trocar por `X-Mercurio-SDK: <version>` e `X-Mercurio-Build: <build-date>` em `network-client.ts#buildHeaders`.
  - Ajustar testes de cabeçalhos.

## 3) Export default da SDK × README
- Contexto: default export é a classe (`MercurioSDKImpl`), README também mostra uso como instância.
- Risco: Médio — onboarding falha com import incorreto.
- Esforço: Baixo.
- Proposta:
  - Documentação: padronizar para uma das opções:
    - Classe: `import Mercurio from '@mercurio/sdk'; const mercurio = new Mercurio();`
    - Instância nomeada: `import { mercurio } from '@mercurio/sdk';`
  - Não alterar exports por enquanto para evitar breaking change.

## 4) Flag SSR no `MercurioProvider` (React)
- Contexto: `shouldInitialize` ignora `disableInServer`.
- Risco: Baixo/Médio — inicialização indevida em ambientes híbridos.
- Esforço: Baixo.
- Proposta: corrigir condição para `isBrowser && !config.disableInServer` e reforçar docs Next (client components).

## 5) Exposição de `sessionId`
- Contexto: Provider acessa `sessionManager` via `any`.
- Risco: Baixo — tipo frágil; API não clara.
- Esforço: Baixo.
- Proposta: adicionar `getSessionId()` à interface pública da SDK e consumir no Provider/hook.

## 6) Limites de payload e batch (contrato)
- Contexto: SDK usa 1MB/∞; API atual 1MB/1000; guidelines recomendam ≤256KB / ≤50.
- Risco: Médio — desalinhamento com políticas futuras/CI.
- Esforço: Baixo para ajustar defaults; Médio para comunicação.
- Proposta: alinhar defaults da SDK (256KB, batch 50) e manter override em config; planejar rollout e avisos de breaking em CHANGELOG.

## 7) Versionamento de esquema + `event_id`/idempotência
- Contexto: Guidelines pedem `X-Event-Schema-Version` e deduplicação.
- Risco: Médio — migração futura mais custosa; duplicidades.
- Esforço: Médio.
- Proposta: aceitar header na API e persistir; SDK incluir opcional `event_id` (ULID) e retries idempotentes; criar índices e strategy de dedupe.

## 8) PII — Criptografia e HMAC
- Contexto: Base64 no backend (demo); HMAC com segredo fixo.
- Risco: Alto (compliance) em produção.
- Esforço: Médio/Alto.
- Proposta: AES-GCM com chave em KMS/.env; HMAC-SHA256 via segredo rotacionável; docs de rotação.

## 9) Observabilidade e Rate Limiting
- Contexto: Falta tracing/metrics; rate limiting por tenant.
- Risco: Médio em produção (SLO/contensão).
- Esforço: Médio.
- Proposta: OpenTelemetry, métricas (Prometheus), limiter por `tenant_id`/`workspace_id`.

---

## Prioridade sugerida
1. (1) Auth sendBeacon — Alta urgência / Baixa-Média dificuldade.
2. (2) Header proibido — Alta urgência / Baixa dificuldade.
3. (3) README export — Média urgência / Baixa dificuldade.
4. (4) SSR flag Provider + (5) getSessionId — Média urgência / Baixa dificuldade.
5. (6) Limites contrato — Média urgência / Baixa dificuldade (planejar rollout).
6. (7) Esquema + idempotência — Média prioridade / Média dificuldade.
7. (8) PII forte — Alta prioridade estratégica / Média-Alta dificuldade.
8. (9) Observabilidade + rate limit — Média prioridade / Média dificuldade.

## Notas de rollout
- Comunicar mudanças de cabeçalho e limites no CHANGELOG e docs de integração.
- Feature flag para `sendBeacon` até a API aceitar `auth` com segurança.
- Testar em navegadores principais (Chrome, Safari, Firefox, Edge).

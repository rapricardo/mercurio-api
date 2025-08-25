Alinhamento com .kiro/specs

- Database Setup
    - OK: Migrações em apps/api/prisma/migrations com timestamp (20250824000000_init), IDs BIGINT e prefixos
externos no client (a_, s_), isolamento multi-tenant, índices por padrões de consulta, tabelas de funil.
    - Observação: PK de event é composta [id, tenantId, timestamp] (bom para particionamento), diferente do
design exemplar (PK simples). Compatível com objetivo de performance/particionamento.
- Event Ingestion API
    - OK: Estrutura modular (guard, DTOs, enrichment, processor), endpoints POST /v1/events/
{track,batch,identify}, validação com class-validator, enriquecimento de device/geo básico, gestão de sessão
(timeout 30min), persistência via Prisma, logs estruturados.
    - Pendente/Parcial: rate limiting por tenant; observabilidade (tracing/metrics); versionamento de esquema via
header; testes de integração; caching (chaves/sessões).
- JavaScript SDK
    - OK: NetworkClient, RequestOptimizer, StorageManager com fallback, fila IndexedDB, retry/backoff,
utilitários e muitos testes unitários.
    - Falta crítica: arquivo core/sdk.ts (classe MercurioSDKImpl) ausente; src/index.ts exporta de ./core/sdk e
instancia global — vai quebrar build/uso. Itens 7.x–10.x e integrações React/Vue ainda não implementados.

Conformidade com Guidelines

- Tracking (docs/guidelines/tracking.md)
    - Diverge: limites implementados (1MB payload, batch=1000) vs. guideline (≤256KB, batch ≤50); janela de
timestamp na API (±5 min) vs. guideline (±48h); sem event_id para deduplicação; sem validações de tamanho de
props/string.
    - Alinha: snake_case em payload (event_name, anonymous_id, etc.), contexto page/utm.
- Git & PR
    - Docs adotam Conventional Commits/PR checklist. Não avaliei histórico, mas config está consistente.
- Estilo/Qualidade
    - Prettier/ESLint configurados no root; código majoritariamente em conformidade (import order,
no-unused-imports). Pequenas variações de formato serão corrigidas por npm run format.
- Segurança/Privacidade
    - Pendente: criptografia de PII “real” (atual é base64 no serviço e HMAC hardcoded); guideline sugere
criptografia at-rest + fingerprints HMAC com segredo gerenciado.
    - API Key: spec de exemplo cita bcrypt; implementação usa SHA-256 de ak_... (ok funcionalmente, mas diferente
do design). Considere KDF lento (bcrypt/argon2) e rotação de chaves.

Riscos e Impactos

- SDK inutilizável como pacote (ausência de core/sdk.ts), quebrando exemplos do README da SDK e adoção do
cliente.
- Incompatibilidade com limites do contrato (payload/batch/timestamp) pode gerar rejeições quando alinharmos com
guideline depois.
- PII: base64 não atende LGPD; segredo HMAC fixo no código é risco.

Recomendações Prioritárias

    - Implementar packages/javascript-sdk/src/core/sdk.ts (MercurioSDKImpl) com init(), track(), identify(), page
auto-track e merge com NetworkClient, EventQueue, IdentityManager, SessionManager. Corrigir index.ts export.
    - Adicionar testes de integração no pacote SDK (Task 15.1).
2. Contrato/Validações
    - Ajustar limites para guideline: MAX payload 256KB; batch ≤50; janela de timestamp ±48h. Aplicar validações
5. Testes
    - API: configurar Jest (ou e2e com pact/supertest) e cobrir fluxos track/batch/identify, multi-tenant, erros/
limites. Já existe database.test.ts e test-utils úteis.
6. Performance/Caching
    - Cache de validação de API key (TTL curto) e sessão ativa.
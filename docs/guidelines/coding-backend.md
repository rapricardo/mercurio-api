# Coding Backend — Node/NestJS/TypeScript

Status: Draft
Última atualização: 2025-08-23

## Stack
- Node 20+, NestJS, TypeScript `strict: true`, Fastify.
- Validação ingestão: JSON Schema (AJV). Demais DTOs: class-validator.
- Logs: Pino (JSON). Observabilidade: OpenTelemetry.
- ORM: Prisma. DB: Postgres 15+.

## Estrutura de Pastas
- `apps/api/src/modules/{modulo}/` com `controller`, `service`, `repo`, `dto`.
- `packages/shared/` para tipos comuns (ex.: contratos de eventos, erros).

## Padrões de Código
- TS strict, `eslint` + `prettier` padronizados.
- Funções puras onde possível; side effects centralizados.
- Não lançar erros genéricos; use classes específicas e filtros de exceção.

## Erros e Logs
- Níveis: info (fluxo esperado), warn (anomalias de entrada), error (falhas).
- Contexto mínimo: `request_id`, `tenant_id`, `workspace_id`, `endpoint`.
- Nunca logar PII; mascarar valores sensíveis.

## Segurança
- Validar headers de autenticação e janelas de tempo (anti‑replay).
- Limitar tamanho de payload e lotes; aplicar rate limiting.
- Sanitize de inputs; negar campos desconhecidos quando estrito.

## Banco de Dados
- Prisma com `previewFeatures` mínimas. SQL cru apenas para hotspots.
- Transações por caso de uso; consistência primeiro.
- Índices conforme `docs/architecture/data-model.md`.

## Testes
- Unit: Jest/Vitest com cobertura de services e validadores.
- Integração: supertest no controller, DB em container.
- Contrato: validar payloads com schemas em testes.

## Configuração
- Variáveis `MERCURIO_*`. Sem defaults inseguros em prod.
- Fail‑fast se variáveis obrigatórias ausentes.

## Revisão e Qualidade
- CI com lint, typecheck, testes, migrações dry‑run, schemas.
- PRs devem incluir rationale e impacto em segurança/privacidade quando aplicável.

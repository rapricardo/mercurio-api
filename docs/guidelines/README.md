# Guidelines — Padrões e Boas Práticas

Objetivo: concentrar práticas e recomendações transversais (código, API, tracking, privacidade e documentação) para manter consistência e qualidade ao longo do projeto.

## Regras de Utilização
- Status: cada documento deve iniciar com Status (Draft|Aceito|Depreciado) e Última atualização (AAAA-MM-DD).
- Owners: indique responsável e revisor sugerido.
- Nomeação: arquivos em kebab-case; exemplos e campos JSON em snake_case; IDs com prefixos (`tn_`, `ws_`, `ld_`, `a_`).
- Estrutura mínima: Objetivo, Escopo, Regras, Exemplos, Referências.
- Mudanças: toda alteração relevante deve incluir exemplos atualizados e breve rationale no PR.

## Índice
- API Style: versionamento, erros, paginação, idempotência, rate limits — [api-style.md](./api-style.md)
- Tracking: convenções de eventos/props, UTM, consentimento, validação — [tracking.md](./tracking.md)
- Coding Backend: Nest/TS, camadas, validação, logs, testes — [coding-backend.md](./coding-backend.md)
- Coding Frontend: Next/TS, estado, acessibilidade, testes — [coding-frontend.md](./coding-frontend.md)
- DB Style: Postgres, nomes, índices, migrações — [db-style.md](./db-style.md)
- Docs Style: estrutura, nomenclatura, status, templates — [docs-style.md](./docs-style.md)
- Git & PR: branches, commits, PRs, releases — [git-style.md](./git-style.md)

## Antes de contribuir
- Leia o guia do repositório: [AGENTS.md](../../AGENTS.md) (estrutura, comandos, padrões e PRs).
- Garanta qualidade local: `npm run check` (lint + typecheck + format:check).
- API/DB: revise e nomeie migrações com cuidado (`apps/api` → Prisma). Consulte [database-migrations.md](./database-migrations.md).
- Rastreabilidade: siga [tracking.md](./tracking.md) e as regras de PII em [security-privacy.md](./security-privacy.md).

## Como contribuir
- Crie um novo arquivo nesta pasta para cada guideline temática.
- Use títulos claros, inclua exemplos e anti‑padrões.
- Referencie documentos relacionados (API, Security, Features) quando aplicável.

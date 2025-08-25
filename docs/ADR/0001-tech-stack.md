# ADR 0001 — Tech Stack (Proposta)

## Status
Aceito — 2025-08-23.

## Contexto
- V1 requer velocidade de desenvolvimento, bom ecossistema e operabilidade simples.
- Consultas iniciais de métricas podem ser atendidas por Postgres; manter espaço para evolução.

## Decisão
- Backend: Node.js (NestJS, TypeScript). ORM: Prisma. DB: Postgres 15+.
- Frontend: React + Next.js, TypeScript. Lib para builder: React Flow.
- Autenticação ingestão: API key + HMAC. Painel: JWT (futuro próximo).
- Monorepo: `apps/api`, `apps/web`, `packages/shared`, `docs`.

## Consequências
- Desenvolvimento rápido e comunidade ampla.
- Prisma facilita migrações e tipagem; cuidado com hotspots de performance.
- Caminho de evolução claro para ClickHouse (eventos) caso volume cresça.

## Alternativas consideradas
- Go + SQLC (pró/contra: performance vs. cadência inicial).
- Rails (pró/contra: produtividade alta vs. preferência por TS full-stack).

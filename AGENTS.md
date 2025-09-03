# Repository Guidelines

## Project Structure & Module Organization
- `src/`: NestJS code. Domains: `analytics/`, `events/`, `tenants/`, `workspaces/`, `common/`, `monitoring/`. App bootstrap in `app.module.ts`; health at `health.controller.ts`; Prisma in `prisma.service.ts`.
- `prisma/`: `schema.prisma`, `migrations/`, `seed.ts`, `seeds/`.
- `test/`: `e2e/`, `integration/`, `load/`; Postman collections in `test/postman/`.
- Supporting: `docs/`, `scripts/`, deployment files (`Dockerfile`, `docker-compose.prod.yml`, `Makefile`).

## Build, Test, and Development Commands
- `npm install`: Install dependencies (Node >= 18).
- `npm run dev` | `npm run start:dev`: Start Nest in watch mode.
- `npm run build`: Compile to `dist/`; run with `npm start`.
- Prisma: `npm run prisma:generate`, `npm run prisma:migrate` (dev), `npm run prisma:deploy` (prod), `npm run db:seed`.
- Tests: `npm test`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, coverage via `npm run test:cov`.
- Docker/prod (Makefile): `make build`, `make start`, `make status`, `make migrate`, logs with `make logs`.

## Coding Style & Naming Conventions
- TypeScript with ESLint + Prettier. Format/lint: `npm run format`, `npm run lint`.
- 2-space indent, single quotes, semicolons, no unused vars.
- Filenames follow NestJS: `*.module.ts`, `*.controller.ts`, `*.service.ts`; DTOs in `dto/`, types in `types/`.
- Naming: Classes `PascalCase`; variables/functions `camelCase`; env vars `SCREAMING_SNAKE_CASE`.

## Testing Guidelines
- Framework: Jest (`ts-jest`). Unit tests end with `*.test.ts` under `src/`; additional suites under `test/`.
- Coverage: 80% min (branches, functions, lines, statements). Run `npm run test:cov`.
- E2E in `test/e2e/`; load tests in `test/load/`. Use helpers `src/test-setup.ts` and `src/test-utils.ts`.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat: ...`, `fix: ...`). Keep messages imperative and scoped.
- PRs: describe motivation and changes, link issues, note schema/migration changes, update docs (`README.md`, `INSTALL.md`, `DEPLOY.md`) and Postman collections, and pass lint + tests.

## Security & Configuration Tips
- Do not commit secrets. Copy `.env.example` → `.env`; see `.env.production.example` for deploy vars (`DATABASE_URL`, keys, salts`).
- Handle PII per Prisma schema: encrypt values and store fingerprints; avoid logging raw PII.
- For production, prefer `npm run deploy` or `make deploy`; verify health at `/health` and metrics at `/monitoring/metrics`.


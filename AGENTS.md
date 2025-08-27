# Repository Guidelines

## Project Structure & Module Organization
- `src/`: NestJS code. Key areas: `analytics/`, `events/`, `tenants/`, `workspaces/`, `common/`, `monitoring/`, `app.module.ts`, `health.controller.ts`, `prisma.service.ts`.
- `prisma/`: `schema.prisma`, `migrations/`, `seed.ts`, `seeds/`.
- `test/`: `e2e/`, `integration/`, `load/`, Postman collections in `test/postman/`.
- `docs/`, `scripts/`, deployment files (`Dockerfile`, `docker-compose.prod.yml`, `Makefile`).

## Build, Test, and Development Commands
- Install: `npm install` (Node >= 18).
- Dev server: `npm run dev` or `npm run start:dev` (watch mode).
- Build: `npm run build` → outputs to `dist/`; run with `npm start`.
- Prisma: `npm run prisma:generate`, `npm run prisma:migrate` (dev), `npm run prisma:deploy` (prod), `npm run db:seed`.
- Tests: `npm test`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, coverage with `npm run test:cov`.
- Docker/prod (via Makefile): `make build`, `make start`, `make status`, `make migrate`, logs with `make logs`.

## Coding Style & Naming Conventions
- TypeScript with ESLint + Prettier. Format/lint with: `npm run format`, `npm run lint`.
- Indentation 2 spaces; single quotes; semicolons; no unused vars.
- Filenames follow NestJS patterns: `*.module.ts`, `*.controller.ts`, `*.service.ts`; DTOs in `dto/`, types in `types/` when present. Use `PascalCase` for classes, `camelCase` for variables/functions, `SCREAMING_SNAKE_CASE` for env constants.

## Testing Guidelines
- Framework: Jest (`ts-jest`). Unit tests end with `*.test.ts` under `src/`; additional suites under `test/`.
- Coverage: global threshold 80% (branches, functions, lines, statements). Generate report: `npm run test:cov`.
- E2E tests live in `test/e2e/`; load tests in `test/load/`. Use helpers in `src/test-setup.ts` and `src/test-utils.ts`.

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat: ...`, `fix: ...`). Keep messages imperative and scoped.
- PRs must: describe motivation and changes, link issues, note schema changes/migrations, update docs (`README.md`, `INSTALL.md`, `DEPLOY.md`) and Postman files if APIs change, and pass lint + tests.

## Security & Configuration Tips
- Do not commit secrets. Copy `.env.example` → `.env`; see `.env.production.example` for deploy variables (`DATABASE_URL`, keys, salts).
- Handle PII per Prisma schema: store encrypted values and fingerprints; avoid logging raw PII.
- For production, prefer `npm run deploy` or `make deploy`; verify health at `/health` and metrics at `/monitoring/metrics`.


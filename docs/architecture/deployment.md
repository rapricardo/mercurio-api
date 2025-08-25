# DEPLOYMENT — Ambientes e Operações

## Ambientes
- Dev: local + container; seeds mínimos.
- Staging: espelha prod (menor escala), feature flags.
- Prod: HA conforme demanda.

## Pipeline CI/CD
- Checks: lint, testes, migrações dry-run, validação de JSON Schemas.
- Deploy: infra como código (futuro), migrações antes de iniciar novas versões.

## Configuração (variáveis)
- `MERCURIO_DB_URL`, `MERCURIO_JWT_SECRET` (futuro), `MERCURIO_HMAC_SECRETS`, `MERCURIO_RATE_LIMITS`.

## Migrações e dados
- Ferramenta de migração (Prisma/Knex/sqlc+goose, a definir).
- Backups automáticos e testes de restore periódicos.

## Segurança operacional
- Gestão de segredos (Vault/SM), rotação de chaves, revogação de API keys.
- Políticas de acesso por ambiente.

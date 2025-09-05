# Operational DB — Prisma, Supabase e PgBouncer

Status: Draft
Última atualização: 2025-09-05

## Objetivo
Padronizar configuração de banco em produção (Supabase) e evitar erros de prepared statements ao usar PgBouncer.

## Configuração de DATABASE_URL
- Pooler (recomendado em produção):
  - Host: `*.pooler.supabase.com`
  - Porta: `6543`
  - Params: `?pgbouncer=true&connection_limit=1`
  - Exemplo:
    `postgresql://postgres:****@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
- Conexão direta (sem pooler):
  - Host: `db.<project-ref>.supabase.co`
  - Porta: `5432`
  - Sem `pgbouncer=true`.

## Sintomas e Mitigação
- Erro `42P05 prepared statement "sN" already exists`:
  - Causa: uso do pooler sem `pgbouncer=true` (prepared statements habilitados).
  - Ação: ajustar `DATABASE_URL` com `pgbouncer=true&connection_limit=1` e reiniciar app.
  - Código: aplicar retry com reset de conexão (já implementado nos serviços críticos).

## Checklist de Deploy
- [ ] `SUPABASE_DATABASE_URL` aponta para pooler (6543) com `pgbouncer=true&connection_limit=1`.
- [ ] `npx prisma migrate deploy` executado no ambiente.
- [ ] Health OK (`/health`) e sem logs de 42P05 nas primeiras requisições.
- [ ] Métricas/Logs mostram conexões estáveis.

## Dicas Operacionais
- Limitar paralelismo de conexões em workers (p.ex. `DB_CONNECTION_LIMIT`).
- Evitar SQL com prepared statements manuais quando no pooler.
- Monitorar erros de driver/Prisma e reinicializações.


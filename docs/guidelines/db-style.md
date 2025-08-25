# DB Style — Postgres

Status: Updated
Última atualização: 2025-08-23

> **Note**: This document provides a quick reference for database style guidelines. For comprehensive documentation including detailed examples and procedures, see:
> - [Database Migration Guidelines](./database-migrations.md)
> - [Database ID Strategy](./database-ids.md) 
> - [Migration Examples](./migration-examples.md)

## Identificadores e Tipos
- **PKs**: BIGSERIAL para IDs internos; prefixos externos (`tn_`, `ws_`, `ak_`, `ld_`, `a_`, ...)
- **Timestamps**: `timestamptz` para `created_at`/`updated_at`; `ingested_at` para eventos
- **Multi-tenant**: Colunas obrigatórias `tenant_id`, `workspace_id` (BIGINT) em todas as tabelas de domínio

## Nomenclatura
- **Tabelas/colunas**: snake_case; nomes descritivos (`funnel_step_match`)
- **Índices**: `idx_<tabela>_<colunas>`; únicos: `uniq_<tabela>_<colunas>`
- **Foreign Keys**: `fk_<tabela>_<referencia>`
- **Migrações**: `YYYYMMDD_HHMMSS_descricao_da_mudanca`

## Constraints e Validação
- **NOT NULL** por padrão; defaults apropriados
- **Check constraints** para validação de dados (status, formatos)
- **Foreign keys** com RESTRICT por padrão; CASCADE apenas quando necessário
- **Unique constraints** para prevenir duplicatas

## Índices e Performance
- **Multi-tenant**: Todos os índices começam com `(tenant_id, workspace_id, ...)`
- **Eventos**: Índice principal `(tenant_id, workspace_id, timestamp DESC)`
- **Partial indexes** para registros ativos/filtrados
- **CONCURRENTLY** para criação de índices em produção

## JSONB e Dados Flexíveis
- **Estruturado**: Use JSONB para `props`, `utm`, `device`, `geo`
- **Indexação**: GIN indexes para busca em JSONB quando necessário
- **Validação**: Defina estrutura esperada na aplicação

## Soft Delete e Auditoria
- **Soft delete**: `deleted_at`/`archived_at` quando apropriado
- **Histórico**: Nunca delete eventos ou dados históricos
- **Auditoria**: Log mudanças administrativas (API keys, publicações)

## Migrações e Versionamento
- **Ferramenta**: Prisma Migrate para controle de versão
- **Estrutura**: Arquivos SQL com comentários explicativos
- **Rollback**: Procedures de rollback documentadas
- **Testes**: Validação pré e pós-migração
- **Dados**: Plano de migração para alterações destrutivas

## Segurança e PII
- **Criptografia**: PII criptografada at-rest (email_enc, phone_enc)
- **Fingerprints**: HMAC-SHA256 para matching seguro
- **Isolamento**: Row-level security via tenant_id/workspace_id

Para exemplos detalhados e procedures completas, consulte os documentos de guidelines específicos listados no início deste documento.

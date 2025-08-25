# Mercurio — Documentação V1

Mercurio é um SaaS de analytics de funil para gestores de tráfego e times de marketing. Esta documentação cobre escopo do produto, arquitetura, contrato de eventos, modelo de dados, APIs, segurança/privacidade, frontend, observabilidade e deploy.

## Como navegar
- Guia do repositório (contribuição): [AGENTS.md](../AGENTS.md)
- Product: visão, glossário e roadmap
  - [docs/product/README.md](./product/README.md)
  - [docs/product/glossary.md](./product/glossary.md)
  - [docs/product/roadmap.md](./product/roadmap.md)
- Architecture: arquitetura, dados, tenancy, deploy, observabilidade
  - [docs/architecture/README.md](./architecture/README.md)
  - [docs/architecture/data-model.md](./architecture/data-model.md)
  - [docs/architecture/tenancy.md](./architecture/tenancy.md)
  - [docs/architecture/deployment.md](./architecture/deployment.md)
  - [docs/architecture/observability.md](./architecture/observability.md)
- API: ingestão/consulta e autenticação
  - [docs/api/README.md](./api/README.md)
- Features: especificações por feature
  - [docs/features/README.md](./features/README.md)
  - Ex.: Ingestão de eventos: [features/ingestion/events](./features/ingestion/events/README.md)
  - Identidade: [features/identity](./features/identity/README.md)
  - Builder de funis: [features/funnels/builder](./features/funnels/builder/README.md)
- Guidelines: padrões e boas práticas
  - [docs/guidelines/README.md](./guidelines/README.md)
  - Segurança e privacidade (LGPD): [guidelines/security-privacy.md](./guidelines/security-privacy.md)
  - Backend (Nest/Node/TS): [guidelines/coding-backend.md](./guidelines/coding-backend.md)
  - Frontend (React/Next): [guidelines/coding-frontend.md](./guidelines/coding-frontend.md)
  - Git & PR: [guidelines/git-style.md](./guidelines/git-style.md)
  - Tracking (eventos): [guidelines/tracking.md](./guidelines/tracking.md)
  - Banco de dados (estilo): [guidelines/db-style.md](./guidelines/db-style.md)
  - IDs e prefixos: [guidelines/database-ids.md](./guidelines/database-ids.md)
  - Migrações: [guidelines/database-migrations.md](./guidelines/database-migrations.md)
  - Estilo de docs: [guidelines/docs-style.md](./guidelines/docs-style.md)
  - ADRs (decisões): [docs/ADR/0001-tech-stack.md](./ADR/0001-tech-stack.md)

## Leituras essenciais (antes de abrir PR)
- Siga o guia: [AGENTS.md](../AGENTS.md) e as Guidelines acima.
- Rode verificações locais: `npm run check` (lint + typecheck + format:check).
- Para API, valide migrações: `npm run -w @mercurio/api prisma:migrate` e revise o SQL.

## Escopo V1 (resumo)
- Ingestão de eventos via padrão GTM único (com versionamento do esquema).
- Identificação de visitante anônimo, posterior unificação quando email/telefone forem conhecidos.
- Criação e publicação de funis com assistente visual (nós: página, evento, decisão, início, conversão).
- Métricas por etapa (entradas, conversões, drop-off, tempo entre etapas) com janela configurável.

## Princípios
- Privacidade primeiro: minimizar PII, consentimento explícito, pseudonimização.
- Multitenant desde o início (isolamento lógico por `tenant_id`/`workspace_id`).
- Contratos claros e versionados (eventos e APIs).
- Observabilidade e qualidade de dados como features de primeira classe.

## Status
- V1 — Em especificação. Esqueletos criados, detalhes em evolução.

# Features — Especificações por Feature

Objetivo: documentar cada feature do Mercurio com contexto, regras, contratos e critérios de aceite. Cada feature vive em um diretório próprio e segue o template.

## Estrutura
- Diretórios: `docs/features/{area}/{feature-name}/README.md` (kebab-case)
  - Ex.: `features/ingestion/events/`, `features/identity/merge/`, `features/funnels/builder/`.
- Arquivo principal: `README.md`.
- Arquivos auxiliares: diagramas, exemplos de payloads, queries, etc.

## Regras de Utilização
- Status no topo: Draft|Em Desenvolvimento|Aceito|Depreciado.
- Metadados: Owner, Última atualização, Dependências.
- Template: use o [template de feature](./_template/README.md).
- Versionamento: mudanças incompatíveis devem criar nova versão ou seção “Breaking Changes”.

## Conteúdo mínimo por feature
- Contexto e objetivos (Goals / Non‑Goals)
- Personas / User stories
- Fluxos e UX (links para Figma quando houver)
- Regras de negócio
- Contratos (API/eventos) e validações
- Dados e índices afetados
- Métricas de sucesso
- Privacidade/LGPD e segurança
- Riscos, dependências e rollout/flags
- Critérios de aceite

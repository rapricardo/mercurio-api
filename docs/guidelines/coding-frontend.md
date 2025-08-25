# Coding Frontend — React/Next.js

Status: Draft
Última atualização: 2025-08-23

## Stack
- Next.js (TS), React 18+, React Query para dados, Zod para validação leve no cliente.
- Builder de funil: React Flow.
- Estilos: Tailwind CSS (ou CSS Modules se preferir simplicidade).

## Padrões de Código
- TS `strict: true`; ESLint + Prettier; A11y (`eslint-plugin-jsx-a11y`).
- Componentes em PascalCase; arquivos de página em kebab-case.
- Evitar estado global; preferir React Query + estado local. Context apenas para cross‑cutting pequeno.

## Dados
- BFF fino (rotas API do Next quando necessário) para compor dados da UI.
- Erros padronizados conforme `api-style`. Sempre tratar loading/empty/error states.

## Acessibilidade e UX
- Navegação por teclado no builder; labels e aria‑* apropriados.
- Estados vazios com orientação clara (ex.: como iniciar ingestão).

## Testes
- Unit: Vitest/RTL. E2E: Playwright opcional para fluxos críticos.

## Performance
- Suspense/streaming quando aplicável; memoização apenas com medição.
- Não renderizar listas enormes sem virtualização.

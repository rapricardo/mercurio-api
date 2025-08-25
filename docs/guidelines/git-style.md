# Git & PR — Convenções

Status: Draft
Última atualização: 2025-08-23

## Branches
- `feature/<area>-<resumo-kebab>`
- `fix/<resumo-kebab>`
- `docs/<resumo-kebab>`

## Commits
- Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`, `refactor: ...`, `perf: ...`, `test: ...`.
- Mensagens curtas na primeira linha; corpo com contexto quando necessário.

## Pull Requests
- Descrição com: objetivo, abordagem, impacto em segurança/privacidade, screenshots/logs (quando UI), passos de teste.
- Checklist: lint OK, testes OK, docs atualizadas (se necessário), migrações validadas.
- Revisor: pelo menos 1 aprovação para merge.

## Releases
- Tags semânticas (semver) para pacotes quando aplicável.
- Changelog gerado a partir de Conventional Commits.

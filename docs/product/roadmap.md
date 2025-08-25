# ROADMAP — V1 → V2

## V1 (MVP funcional)
- Contrato de eventos `v1` e validação.
- Ingestão com HMAC e API key.
- Modelo de identidade (anonymous→lead) e `identify`.
- Builder de funil e publicação (snapshot).
- Métricas por etapa com janela configurável.
- Observabilidade básica e LGPD mínima.

## V1.1
- Cache de métricas e otimizações de consulta.
- Melhorias de UX no builder (atalhos, undo/redo simples).
- Exportações (CSV/Parquet) e webhooks de conversão.

## V2 (escala e multi-tenant avançado)
- Armazenamento colunar para eventos (ex.: ClickHouse).
- RBAC e isolamento por schema/DB quando necessário.
- Atribuição ampliada e segmentações avançadas.

# OBSERVABILITY — Logs, Métricas e Qualidade de Dados

## Logs
- Estruturados (JSON), sem PII, com `tenant_id`/`workspace_id` quando aplicável.
- Níveis: info para eventos de sistema; warn para quedas de qualidade; error para falhas.

## Métricas técnicas
- Ingestão: taxa de eventos/min, latência p50/p95, taxa de rejeição, motivos.
- Pipeline: lag de processamento, filas (se houver), erros por etapa.
- API Consulta: latência p50/p95, taxa de acertos de cache.

## Tracing
- Traços distribuídos para ingestão e consultas críticas (correlação por `event_id` quando presente).

## Qualidade de dados
- Monitores: queda abrupta de `page_view`, mudança de mix de `event_name`, drift de esquema.
- Amostragem de payloads inválidos com motivos para diagnóstico.

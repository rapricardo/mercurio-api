# FRONTEND — Builder de Funis e Dashboards

## Builder (V1)
- Tipos de nós: Início, Página, Evento, Decisão (filtros), Conversão.
- Ações: adicionar/remover nós, conectar arestas, reordenar, validar.
- Regras de match por etapa: 
  - Página: `url_match` (equals|contains|regex), `path`, `referrer`.
  - Evento: `event_name` e `prop_filters` (operadores básicos: equals, contains, gt, lt).
- Publicação: gera snapshot imutável (`funnel_publication`) e congela regras para cálculo.

## UX
- Validações: sem ciclos, único nó de Início, ao menos uma Conversão.
- Estados vazios: instruções para ingestão e exemplos de funis.
- Acessibilidade: navegação por teclado e labels claros.

## Dashboards
- Métricas por etapa: entradas, conversões, drop-off, taxa step→step.
- Tempos: p50/p95 entre etapas (quando aplicável).
- Filtros: intervalo de datas, workspace, UTM predominante, dispositivo.

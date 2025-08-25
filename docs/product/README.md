# PRODUCT — Mercurio V1

## Proposta de valor
Mercurio permite criar funis visuais e acompanhar, em tempo real, as métricas de progressão do visitante até a conversão, unificando identidade anônima e identificada, com ingestão padronizada via Google Tag Manager.

## Personas
- Gestor de Tráfego: cria funis por conta/campanha, monitora conversões e drop-offs.
- Analista de Marketing: compara hipóteses, ajusta janelas e filtros, valida qualidade de dados.
- Fundador/Head: acompanha KPIs agregados por funil e por workspace.

## Jornadas principais
- Configurar ingestão (API key, snippet GTM) e validar eventos recebidos.
- Construir funil: adicionar nós (Página, Evento, Decisão, Início, Conversão), conectar, validar e publicar.
- Acompanhar métricas: entradas por etapa, taxa step→step, drop-off, tempo entre etapas (p50/p95), janela configurável.

## Critérios de sucesso (V1)
- Ingestão estável com contrato versionado e validação de esquema.
- Visual builder simples e confiável; publicação gera snapshot imutável.
- Métricas por etapa com latência baixa (quase em tempo real) e resultados consistentes.
- Privacidade respeitada (LGPD), PII segura e opt-out suportado.

## Escopo V1 — IN
- Padrão único de GTM (com `schema_version`).
- Anonymous ID por cookie 1st-party; unificação quando email/telefone chegam.
- Builder de funil com nós básicos e regras simples (match por URL/evento/props).
- Relatórios de funil publicados (snapshot) com janela por funil.

## Escopo V1 — OUT
- A/B de funis, multi-variante.
- Modelos de atribuição avançados (data-driven).
- Segmentação comportamental complexa em UI.
- RBAC granular e billing.

# GLOSSARY — Mercurio

- Evento: registro atômico de uma ação ocorrida em um timestamp (ex.: page_view, add_to_cart, purchase).
- Visitante: entidade anônima identificada por `anonymous_id`.
- Lead: entidade identificada (email/telefone) com `lead_id`, unificada a visitantes.
- Sessão: janela de interação contínua identificada por `session_id`.
- Funil: definição de etapas e suas regras de match para medir progressão.
- Etapa: nó do funil (Página, Evento, Decisão, Início, Conversão).
- Publicação: snapshot imutável de um funil para cálculo de métricas.
- Tenant: conta principal (ex.: agência). Isola dados entre clientes.
- Workspace: subconta/projeto dentro do tenant (ex.: anunciante, site, loja).
- PII: dados pessoalmente identificáveis (email, telefone). Sujeitos à LGPD.
- Props: propriedades dinâmicas específicas do evento (JSON), versionadas por esquema.
- UTM: parâmetros de atribuição (utm_source, utm_medium, utm_campaign, ...).

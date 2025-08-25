# TENANCY — Estratégia Multi-tenant

## Modelo
- Tenant (conta): unidade principal de isolamento.
- Workspace: subconta/projeto dentro do tenant. API keys por workspace.

## Isolamento (V1)
- Isolamento lógico por colunas `tenant_id` e `workspace_id` em todas as tabelas.
- Autorização derivada da API key e/ou JWT (futuro) para restringir acesso.

## Evolução
- Opção de isolamento por schema/DB por tenant se volume justificar.
- Sharding/particionamento por `tenant_id` + `event_date`.

## Chaves e roteamento
- API key vincula a um `workspace_id` (e implicitamente ao `tenant_id`).
- Todos os eventos e consultas devem incluir `tenant_id` e `workspace_id` (ou serem inferidos via credencial).

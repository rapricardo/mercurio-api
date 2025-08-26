# Multi-Tenant Isolation Validation Guide

Este guia detalha como validar o isolamento multi-tenant na API Mercurio para garantir que dados entre tenants permaneçam completamente isolados.

## 🎯 Objetivo

Garantir que:
- Tenant A não pode acessar dados do Tenant B
- API keys de um workspace não funcionam em outro workspace
- Queries retornam apenas dados do tenant/workspace correto
- Autorização funciona corretamente em todos os níveis

## 🔧 Setup Necessário

### 1. Provisionar Dois Tenants de Teste

```bash
# Provisionar primeiro tenant
npm run provision:tenant -- --name "Tenant Alpha" --workspace "Alpha Workspace"

# Provisionar segundo tenant  
npm run provision:tenant -- --name "Tenant Beta" --workspace "Beta Workspace"
```

### 2. Guardar Credenciais

Após provisionar, guarde as seguintes informações:

**Tenant Alpha:**
- Tenant ID: `tn_alpha_xxx`
- Workspace ID: `ws_alpha_xxx`
- API Key: `ak_alpha_xxx`

**Tenant Beta:**
- Tenant ID: `tn_beta_xxx` 
- Workspace ID: `ws_beta_xxx`
- API Key: `ak_beta_xxx`

## 🧪 Cenários de Teste

### 1. Teste de Isolamento de Tenants

#### Cenário 1.1: Lista de Tenants com JWT
- **Objetivo**: Validar que usuário do Tenant Alpha não vê Tenant Beta
- **Método**: `GET /v1/tenants`
- **Auth**: JWT token do usuário vinculado ao Tenant Alpha
- **Expectativa**: Lista deve conter apenas Tenant Alpha

#### Cenário 1.2: Acesso Direto a Tenant de Outro Usuário
- **Objetivo**: Validar que usuário Alpha não acessa detalhes do Tenant Beta
- **Método**: `GET /v1/tenants/{tenant_beta_id}`
- **Auth**: JWT token do usuário vinculado ao Tenant Alpha
- **Expectativa**: `403 Forbidden` ou `404 Not Found`

### 2. Teste de Isolamento de Workspaces

#### Cenário 2.1: Lista de Workspaces Cross-Tenant
- **Objetivo**: Validar que não é possível listar workspaces de outro tenant
- **Método**: `GET /v1/tenants/{tenant_beta_id}/workspaces`
- **Auth**: JWT token do usuário vinculado ao Tenant Alpha
- **Expectativa**: `403 Forbidden`

#### Cenário 2.2: Acesso a Workspace de Outro Tenant
- **Objetivo**: Validar que não é possível acessar workspace específico de outro tenant
- **Método**: `GET /v1/tenants/{tenant_beta_id}/workspaces/{workspace_beta_id}`
- **Auth**: JWT token do usuário vinculado ao Tenant Alpha
- **Expectativa**: `403 Forbidden`

### 3. Teste de Isolamento de API Keys

#### Cenário 3.1: API Key Cross-Workspace (Event Ingestion)
- **Objetivo**: Validar que API key do Alpha não funciona para dados do Beta
- **Método**: `POST /v1/events/track`
- **Auth**: API key do Alpha
- **Data**: Event com dados que seriam direcionados ao Beta
- **Expectativa**: Event deve ser salvo no Alpha, nunca no Beta

#### Cenário 3.2: Analytics Cross-Tenant
- **Objetivo**: Validar que API key Alpha não retorna dados do Beta
- **Método**: `GET /v1/analytics/visitors`
- **Auth**: API key do Alpha
- **Expectativa**: Dados apenas do Alpha

### 4. Teste de Isolamento de Dados de Events

#### Cenário 4.1: Event Ingestion com API Keys Diferentes
```bash
# Inserir evento com API key Alpha
curl -X POST "http://localhost:3000/v1/events/track" \
  -H "X-API-Key: ak_alpha_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "test_isolation_alpha",
    "anonymousId": "a_alpha_test",
    "props": {"tenant": "alpha"}
  }'

# Inserir evento com API key Beta
curl -X POST "http://localhost:3000/v1/events/track" \
  -H "X-API-Key: ak_beta_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "test_isolation_beta", 
    "anonymousId": "a_beta_test",
    "props": {"tenant": "beta"}
  }'
```

#### Cenário 4.2: Validar Isolamento nos Analytics
```bash
# Analytics Alpha - deve retornar apenas evento Alpha
curl -X GET "http://localhost:3000/v1/analytics/events?eventName=test_isolation_alpha" \
  -H "X-API-Key: ak_alpha_xxx"

# Analytics Beta - deve retornar apenas evento Beta
curl -X GET "http://localhost:3000/v1/analytics/events?eventName=test_isolation_beta" \
  -H "X-API-Key: ak_beta_xxx"

# Cross-check: Alpha não deve ver evento Beta
curl -X GET "http://localhost:3000/v1/analytics/events?eventName=test_isolation_beta" \
  -H "X-API-Key: ak_alpha_xxx"
# Expectativa: 0 resultados
```

### 5. Teste de Isolamento de Funnels

#### Cenário 5.1: Funnels Cross-Tenant
- **Objetivo**: Validar que funnels de um tenant não aparecem em outro
- **Método**: `GET /v1/funnels`
- **Auth**: API key Alpha vs Beta
- **Expectativa**: Cada API key deve retornar apenas seus próprios funnels

#### Cenário 5.2: Acesso Direto a Funnel de Outro Tenant
- **Objetivo**: Validar que não é possível acessar funnel específico de outro tenant
- **Método**: `GET /v1/funnels/{funnel_beta_id}`
- **Auth**: API key Alpha
- **Expectativa**: `403 Forbidden` ou `404 Not Found`

## 🔍 Checklist de Validação

### ✅ Checklist Básico

- [ ] **Tenant Isolation**: Usuário Alpha não vê/acessa dados do Tenant Beta
- [ ] **Workspace Isolation**: API key Alpha não acessa Workspace Beta
- [ ] **Event Isolation**: Events ficam no tenant/workspace correto
- [ ] **Analytics Isolation**: Métricas são isoladas por tenant/workspace
- [ ] **Funnel Isolation**: Funnels são isolados por tenant/workspace

### ✅ Checklist Avançado

- [ ] **Cross-Tenant API Calls**: Todas falham com 403/404
- [ ] **Data Leakage**: Nenhum dado vaza entre tenants
- [ ] **Auth Validation**: JWT tokens só funcionam no tenant correto
- [ ] **API Key Validation**: API keys só funcionam no workspace correto
- [ ] **Database Queries**: Todas incluem filtro de tenant_id/workspace_id

## 🚨 Casos de Teste Críticos

### 1. Test Case: Cross-Tenant Data Access

```bash
# Criar evento no Tenant Alpha
EVENT_ALPHA=$(curl -s -X POST "http://localhost:3000/v1/events/track" \
  -H "X-API-Key: {alpha_api_key}" \
  -H "Content-Type: application/json" \
  -d '{"eventName": "critical_test", "anonymousId": "a_critical"}')

# Tentar acessar analytics do evento usando API key Beta
RESULT=$(curl -s -X GET "http://localhost:3000/v1/analytics/events?eventName=critical_test" \
  -H "X-API-Key: {beta_api_key}")

# RESULTADO ESPERADO: 0 eventos encontrados
echo "Expected: 0 events, Got: $(echo $RESULT | jq '.data | length')"
```

### 2. Test Case: JWT Cross-Tenant Access

```javascript
// No Postman, teste este cenário:
pm.test("Cross-tenant access denied", function () {
    // Usar JWT do usuário Alpha para acessar Tenant Beta
    pm.request.url = "{{base_url}}/v1/tenants/{{tenant_beta_id}}";
    pm.request.headers.add({key: "Authorization", value: "Bearer {{jwt_alpha_token}}"});
    
    pm.sendRequest(pm.request, function (err, response) {
        pm.expect(response.code).to.be.oneOf([403, 404]);
    });
});
```

## 🔧 Ferramentas de Validação

### 1. Script de Validação Automatizada

Você pode usar o script de smoke test com dois conjuntos de credenciais:

```bash
# Teste com credenciais Alpha
./test/smoke-test.sh "ak_alpha_xxx" "jwt_alpha_token"

# Teste com credenciais Beta
./test/smoke-test.sh "ak_beta_xxx" "jwt_beta_token"
```

### 2. Postman Collection

Use a collection Postman criada com environment variables separados:

- **Environment Alpha**: Todas as variáveis do Tenant Alpha
- **Environment Beta**: Todas as variáveis do Tenant Beta

Execute a collection com cada environment e compare os resultados.

### 3. Database Validation Query

Execute esta query no PostgreSQL para validar isolamento:

```sql
-- Verificar se events estão isolados corretamente
SELECT 
    tenant_id,
    workspace_id,
    COUNT(*) as event_count
FROM event 
WHERE event_name LIKE 'test_isolation_%'
GROUP BY tenant_id, workspace_id;

-- Resultado esperado: eventos apenas no tenant/workspace correto
```

## ⚠️ Red Flags

Pare os testes imediatamente se encontrar:

1. **Data Leakage**: Qualquer dado aparecendo no tenant errado
2. **Cross-Auth Success**: API key/JWT funcionando em tenant incorreto  
3. **Missing Tenant Filter**: Query retornando dados de múltiplos tenants
4. **Authorization Bypass**: Endpoint permitindo acesso cross-tenant

## 📊 Relatório de Isolamento

Após executar todos os testes, documente:

### ✅ Resultados Esperados
- Todos os cross-tenant requests retornam 403/404
- Dados permanecem completamente isolados
- Analytics retornam apenas dados do tenant correto
- API keys funcionam apenas no workspace autorizado

### ❌ Problemas Encontrados
- [ ] Listar qualquer vazamento de dados
- [ ] Documentar endpoints com problemas de autorização
- [ ] Reportar queries sem filtro de tenant_id

## 🎯 Conclusão

O isolamento multi-tenant é **CRÍTICO** para a segurança da aplicação. Qualquer falha neste isolamento pode resultar em vazamento de dados entre clientes, o que é inaceitável.

Execute estes testes regularmente e sempre que houver mudanças na autorização ou queries de banco de dados.
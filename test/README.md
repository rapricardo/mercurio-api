# 🧪 Mercurio API - Comprehensive Testing Suite

Esta pasta contém todas as ferramentas necessárias para testar completamente a API Mercurio com seus 28 endpoints.

## 📁 Estrutura

```
test/
├── README.md                           # Este arquivo
├── smoke-test.sh                       # Script bash para validação rápida
├── multi-tenant-validation-guide.md    # Guia detalhado de validação multi-tenant
└── postman/
    ├── Mercurio_API_Complete.postman_collection.json
    └── Mercurio_API_Environment.postman_environment.json
```

## 🚀 Quick Start

### 1. Preparar Ambiente

```bash
# 1. Certificar que o servidor está rodando
pnpm dev  # Porta 3000

# 2. Ter tenant e API key disponível
npm run provision:tenant -- --name "Test Tenant" --workspace "Test Workspace"
# Guarde o API key retornado: ak_xxxxx
```

### 2. Smoke Test Rápido

```bash
# Teste básico (sem autenticação - apenas health checks)
./test/smoke-test.sh

# Teste completo com credenciais
./test/smoke-test.sh "sua_api_key_aqui" "seu_jwt_token_aqui"
```

### 3. Testes Detalhados no Postman

1. Importe a collection: `test/postman/Mercurio_API_Complete.postman_collection.json`
2. Importe o environment: `test/postman/Mercurio_API_Environment.postman_environment.json`
3. Configure as variáveis no environment (API key, JWT token)
4. Execute a collection completa

## 🎯 O Que é Testado

### 28 Endpoints Cobertos

| Módulo | Endpoints | Funcionalidade |
|--------|-----------|----------------|
| **Health & Monitoring** | 2 | Status da API e métricas |
| **CRUD Tenants** | 5 | Gerenciamento completo de tenants |
| **CRUD Workspaces** | 5 | Gerenciamento completo de workspaces |
| **Event Ingestion** | 3 | Ingestão de eventos individuais e em lote |
| **Analytics** | 5 | Análises de visitantes, sessões, eventos e UTM |
| **Funnel Analytics** | 8 | Funnels, conversões, atribuição e export |

### Cenários de Teste

**✅ Happy Path**: Dados válidos, autenticação correta
**✅ Validação**: Dados inválidos retornam 400
**✅ Autorização**: Sem auth retorna 401, auth incorreta retorna 403
**✅ Multi-tenant**: Isolamento completo entre tenants
**✅ Performance**: Response times < 2000ms

## 🔧 Ferramentas Disponíveis

### 1. 🚀 Smoke Test Script (`smoke-test.sh`)

**Uso:**
```bash
# Teste básico
./test/smoke-test.sh

# Teste completo
./test/smoke-test.sh "API_KEY" "JWT_TOKEN"

# Exemplo
./test/smoke-test.sh "ak_1234567890abcdef" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Features:**
- ✅ Testa todos os 28 endpoints automaticamente
- ✅ Validação de status codes
- ✅ Extração automática de IDs para testes dependentes
- ✅ Relatório final com estatísticas
- ✅ Cores no output para fácil identificação
- ✅ Exit codes apropriados para CI/CD

### 2. 📮 Postman Collection

**Files:**
- **Collection**: `postman/Mercurio_API_Complete.postman_collection.json`
- **Environment**: `postman/Mercurio_API_Environment.postman_environment.json`

**Features:**
- ✅ 28 endpoints organizados em 6 módulos
- ✅ Testes automatizados em JavaScript para cada endpoint
- ✅ Environment variables com auto-population
- ✅ Pre-request scripts para setup dinâmico
- ✅ Validação de schemas JSON
- ✅ Response time assertions

**Como usar:**
1. Abrir Postman
2. Import → Files → Selecionar ambos arquivos JSON
3. Selecionar o environment "Mercurio API - Local Development"
4. Configurar variáveis `api_key` e `jwt_token`
5. Executar collection completa ou endpoints individuais

### 3. 🔐 Multi-Tenant Validation Guide

**Arquivo**: `multi-tenant-validation-guide.md`

**O que cobre:**
- ✅ Validação de isolamento entre tenants
- ✅ Testes de cross-tenant access (devem falhar)
- ✅ Validação de API keys e JWT tokens
- ✅ Cenários críticos de segurança
- ✅ Database queries de validação
- ✅ Checklists detalhados

## 🔑 Configuração de Autenticação

### API Keys (Event Ingestion, Analytics, Funnels)

```bash
# Criar API key
npm run provision:tenant -- --name "Your Tenant" --workspace "Your Workspace"
# Output inclui: API Key: ak_xxxxx

# Usar em requests
curl -H "X-API-Key: ak_xxxxx" http://localhost:3000/v1/events/track
```

### JWT Tokens (CRUD Tenants/Workspaces)

```bash
# Obter via Supabase Auth ou seu sistema de auth
# Usar em requests
curl -H "Authorization: Bearer eyJxxx..." http://localhost:3000/v1/tenants
```

### Hybrid Auth (Alguns endpoints suportam ambos)

A API detecta automaticamente o tipo de auth:
1. Se `Authorization: Bearer` presente → JWT
2. Se `X-API-Key` presente → API Key  
3. JWT tem precedência sobre API Key

## 📊 Interpretando Resultados

### Smoke Test Script

**✅ Sucesso:**
```bash
🎉 ALL TESTS PASSED!
✅ API is functioning correctly
Total Tests: 28
Passed: 28
Failed: 0
```

**❌ Falhas:**
```bash
❌ SOME TESTS FAILED!
⚠️  Please check the API configuration and logs
Total Tests: 28
Passed: 25
Failed: 3
```

### Postman Collection

- **Verde**: Todos os testes passaram
- **Vermelho**: Testes falharam - verificar detalhes no log
- **Response Time**: Deve ser < 2000ms
- **Status Codes**: Devem ser os esperados (200, 201, 400, 401, 403, 404)

## 🐛 Troubleshooting

### Problemas Comuns

**1. "Connection refused"**
```bash
# Verificar se API está rodando
curl http://localhost:3000/health
# Se falhar, iniciar com: pnpm dev
```

**2. "401 Unauthorized"**
```bash
# Verificar API key
echo "Sua API key: $API_KEY"
# Deve começar com 'ak_'
```

**3. "403 Forbidden"** 
```bash
# API key pode estar correta mas para workspace diferente
# Verificar se tenant_id/workspace_id estão corretos
```

**4. "Empty response"**
```bash
# Banco de dados pode estar vazio
npm run db:seed
# Ou criar dados de teste manualmente
```

### Debug Mode

**Smoke Test com debug:**
```bash
# Adicionar set -x no início do script para debug completo
sed -i '3i set -x' test/smoke-test.sh
./test/smoke-test.sh "API_KEY" "JWT_TOKEN"
```

**Postman debug:**
- Abrir Console (View → Show Postman Console)
- Ver logs detalhados de cada request

## 🚦 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/api-tests.yml
name: API Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Start API
        run: pnpm dev &
      - name: Wait for API
        run: sleep 10
      - name: Run smoke tests
        run: ./test/smoke-test.sh "${{ secrets.TEST_API_KEY }}" "${{ secrets.TEST_JWT_TOKEN }}"
```

### Exit Codes

- `0`: Todos os testes passaram
- `1`: Alguns testes falharam
- `2`: Erro de configuração/setup

## 📈 Métricas e Performance

### Benchmarks Esperados

| Endpoint Type | Response Time | Throughput |
|---------------|---------------|------------|
| Health checks | < 50ms | > 1000 req/s |
| CRUD operations | < 200ms | > 500 req/s |
| Event ingestion | < 100ms | > 1000 req/s |
| Analytics queries | < 500ms | > 200 req/s |
| Complex analytics | < 1000ms | > 100 req/s |

### Load Testing

```bash
# Instalar artillery para load testing
npm install -g artillery

# Teste básico de carga
artillery quick --count 100 --num 10 http://localhost:3000/health
```

## 🔄 Atualizações

### Adicionando Novos Testes

**1. No Smoke Test:**
- Adicionar função `test_new_feature()` 
- Chamar na função `main()`
- Incrementar contador de testes

**2. No Postman:**
- Adicionar novo item à collection
- Configurar testes JavaScript
- Usar environment variables existentes

### Mantendo Atualizado

- **API changes**: Atualizar payloads de teste
- **New endpoints**: Adicionar aos 3 tools
- **Auth changes**: Atualizar headers e tokens
- **Schema changes**: Validar responses no Postman

---

## 🎯 Próximos Passos

Após executar os testes:

1. **✅ Validar Resultados**: Todos os 28 endpoints funcionando
2. **✅ Documentar Issues**: Reportar qualquer falha encontrada  
3. **✅ Performance Check**: Verificar se response times estão aceitáveis
4. **✅ Security Validation**: Confirmar isolamento multi-tenant
5. **✅ Deploy Confidence**: API pronta para produção

**Suporte**: Se encontrar problemas, verificar logs da API com `pnpm dev` e consultar documentação em `docs/`.
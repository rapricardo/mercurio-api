# 🚀 Mercurio API - Setup Portainer

Este guia explica como configurar o Mercurio API no Portainer integrado ao seu setup existente com Traefik, N8N e Evolution API.

## 📋 Pré-requisitos

- ✅ Portainer funcionando
- ✅ Traefik com rede `apollo_prod_public_network`
- ✅ Supabase project configurado
- ✅ Stack N8N/Evolution rodando (opcional)

## 🔧 Setup Rápido

### 1. Gerar Chaves de Segurança

```bash
cd portainer/
./generate-keys.sh
```

Isso criará um arquivo `.env` com todas as chaves necessárias.

### 2. Configurar Supabase

Edite o arquivo `.env` gerado e preencha:

```bash
# Encontre estas informações no dashboard do Supabase
SUPABASE_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?schema=public
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

### 3. Configurar Prisma no Supabase

Execute as migrações no banco Supabase:

```bash
# No seu ambiente local (com as vars do Supabase configuradas)
npx prisma migrate deploy
npx prisma db seed
```

### 4. Deploy no Portainer

1. **Acesse seu Portainer**
2. **Stacks** → **Add stack**
3. **Nome**: `mercurio-api`
4. **Web editor**: Cole o conteúdo de `docker-compose.yml`
5. **Environment variables**: Adicione todas as variáveis do arquivo `.env`
6. **Deploy the stack**

## 🌐 Acesso

Após o deploy:
- **API**: https://mercurio-api.ricardotocha.com.br
- **Health Check**: https://mercurio-api.ricardotocha.com.br/health
- **Métricas**: https://mercurio-api.ricardotocha.com.br/monitoring/metrics

## 🔍 Verificação

### Health Check
```bash
curl https://mercurio-api.ricardotocha.com.br/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-08-27T...",
  "uptime": 123.45,
  "version": "1.0.0",
  "database": "connected",
  "cache": "connected"
}
```

### Test API Key
```bash
# Use uma API key válida do banco
curl -H "Authorization: Bearer ak_lqrK95yu3zxQnA-xSoTGxg" \
     https://mercurio-api.ricardotocha.com.br/v1/analytics/overview
```

## 🔄 Integração com N8N

O Mercurio API estará acessível internamente para o N8N via:
- **URL interna**: `http://mercurio-api:3000`
- **URL externa**: `https://mercurio-api.ricardotocha.com.br`

### Exemplo de Webhook N8N:
```javascript
// Node HTTP Request no N8N
{
  "method": "POST",
  "url": "http://mercurio-api:3000/v1/events/track",
  "headers": {
    "Authorization": "Bearer {{$node.Function.json.api_key}}",
    "Content-Type": "application/json"
  },
  "body": {
    "event_name": "conversion",
    "anonymous_id": "a_{{$json.user_id}}",
    "timestamp": "{{$now}}",
    "properties": {
      "value": "{{$json.amount}}",
      "currency": "BRL"
    }
  }
}
```

## 🔧 Configurações Avançadas

### Redis Externo
Se quiser usar o Redis do stack automation:

```yaml
# No docker-compose.yml, remova o serviço redis_mercurio
# E altere as envs para:
REDIS_HOST: "redis_automation"
REDIS_PASSWORD: "${AUTOMATION_REDIS_PASSWORD}"
REDIS_URL: "redis://:${AUTOMATION_REDIS_PASSWORD}@redis_automation:6379"
```

Adicione `automation_internal_network` nas networks do mercurio-api.

### Logs Centralizados
Para integrar logs com sua stack:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "3"
    labels: "service=mercurio-api"
```

## 🚨 Troubleshooting

### Container não inicia
```bash
# Verifique logs
docker logs mercurio-api

# Variáveis mais comuns que causam erro:
# - SUPABASE_DATABASE_URL incorreta
# - Chaves de criptografia inválidas
# - CORS_ORIGIN não incluindo domínios necessários
```

### Erro de conexão com Supabase
```bash
# Teste conexão diretamente
docker exec -it mercurio-api sh
curl -I "$SUPABASE_URL/rest/v1/"
```

### Rate Limiting muito baixo
```bash
# Aumente nos environment variables:
RATE_LIMIT_MAX_REQUESTS=5000
RATE_LIMIT_WINDOW_MS=60000
```

### CORS bloqueando requests
```bash
# Adicione todos os domínios necessários:
CORS_ORIGIN=https://n8n.ricardotocha.com.br,https://evolution.ricardotocha.com.br,https://apollo.ricardotocha.com.br,https://seuapp.com.br
```

## 📊 Monitoramento

### Métricas Prometheus
Acesse: https://mercurio-api.ricardotocha.com.br/monitoring/metrics/prometheus

### Performance
```bash
curl https://mercurio-api.ricardotocha.com.br/monitoring/performance
```

### Reset de métricas (se necessário)
```bash
curl https://mercurio-api.ricardotocha.com.br/monitoring/reset
```

## 🔄 Atualizações

Quando houver nova versão da imagem:
1. **Stacks** → `mercurio-api`
2. **Editor** → **Pull and redeploy**
3. Aguarde health check ficar verde

## 📞 Suporte

Se encontrar problemas:
1. Verifique logs do container no Portainer
2. Teste health check da API
3. Verifique conectividade com Supabase
4. Confirme se todas as environment variables estão configuradas
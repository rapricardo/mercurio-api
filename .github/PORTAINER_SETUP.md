# 🚀 Portainer Setup Guide

Este guia mostra como configurar a Mercurio API no Portainer usando a imagem do GitHub Container Registry.

## 📦 Imagem Docker

```bash
ghcr.io/tocha/mercurio-api:latest
```

## 🏗️ Configuração do Stack

### 1. Criar Stack no Portainer

1. Acesse seu Portainer
2. Vá em **Stacks** → **Add stack**
3. Nome: `mercurio-api`
4. Cole o docker-compose abaixo:

```yaml
version: '3.8'

services:
  mercurio-api:
    image: ghcr.io/tocha/mercurio-api:latest
    container_name: mercurio-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # Obrigatórias
      - DATABASE_URL=${DATABASE_URL}
      - ENCRYPTION_KEK_SECRET=${ENCRYPTION_KEK_SECRET}
      - EMAIL_DEK_SECRET=${EMAIL_DEK_SECRET}
      - PHONE_DEK_SECRET=${PHONE_DEK_SECRET}
      - EMAIL_FINGERPRINT_SECRET=${EMAIL_FINGERPRINT_SECRET}
      - PHONE_FINGERPRINT_SECRET=${PHONE_FINGERPRINT_SECRET}
      
      # Opcionais
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=info
      - REDIS_ENABLED=false
      - CORS_ENABLED=true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - mercurio-network

networks:
  mercurio-network:
    driver: bridge
```

### 2. Configurar Environment Variables

No Portainer, na seção **Environment variables**, adicione:

```bash
# PostgreSQL Connection
DATABASE_URL=postgresql://username:password@hostname:port/database

# Encryption Keys (gere com: openssl rand -base64 32)
ENCRYPTION_KEK_SECRET=your-base64-encoded-32-byte-key
EMAIL_DEK_SECRET=your-base64-encoded-email-key  
PHONE_DEK_SECRET=your-base64-encoded-phone-key

# Fingerprint Secrets (gere com: openssl rand -hex 32)
EMAIL_FINGERPRINT_SECRET=your-hex-encoded-email-fingerprint
PHONE_FINGERPRINT_SECRET=your-hex-encoded-phone-fingerprint
```

### 3. Deploy Stack

1. Clique em **Deploy the stack**
2. Aguarde o download da imagem e inicialização
3. Verifique os logs em **Containers** → `mercurio-api`

## ✅ Verificação

Após o deploy, teste a API:

```bash
curl http://your-server:3000/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-08-27T...",
  "uptime": 123.45,
  "version": "1.0.0",
  "database": "connected",
  "cache": "disabled"
}
```

## 🔄 Atualização da Imagem

Quando uma nova versão for lançada:

1. Vá em **Stacks** → `mercurio-api`
2. Clique em **Editor**
3. Altere a tag da imagem (se necessário)
4. Clique em **Update the stack**
5. ✅ **Pull and redeploy**

## 🔧 Configurações Avançadas

### Com PostgreSQL e Redis no Stack

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: mercurio-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=mercurio
      - POSTGRES_USER=mercurio
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - mercurio-network

  redis:
    image: redis:7-alpine
    container_name: mercurio-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - mercurio-network

  mercurio-api:
    image: ghcr.io/tocha/mercurio-api:latest
    container_name: mercurio-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://mercurio:${POSTGRES_PASSWORD}@postgres:5432/mercurio
      - REDIS_ENABLED=true
      - REDIS_URL=redis://redis:6379
      # ... outras variáveis
    depends_on:
      - postgres
      - redis
    networks:
      - mercurio-network

volumes:
  postgres_data:
  redis_data:

networks:
  mercurio-network:
    driver: bridge
```

## 🚨 Troubleshooting

### Container não inicia
- Verifique as variáveis de ambiente obrigatórias
- Verifique os logs: **Containers** → `mercurio-api` → **Logs**

### Erro de conexão com banco
- Verifique se o `DATABASE_URL` está correto
- Teste conectividade: `docker exec -it mercurio-api sh`

### Health check falhando
- Verifique se a porta 3000 está livre
- Verifique se o banco está acessível

## 📞 Suporte

Para problemas específicos, verifique:
1. **Logs do container** no Portainer
2. **Status do health check**
3. **Conectividade de rede**
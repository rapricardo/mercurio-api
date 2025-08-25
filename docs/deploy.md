⏺ 🏗️ ARQUITETURA RECOMENDADA PARA PRODUÇÃO

  CONFIGURAÇÃO IDEAL:

  VPS com Portainer
  ├── Network: mercurio-network (internal)
  ├── PostgreSQL Container
  ├── Mercurio API Container (internal only)
  ├── N8N Container (já existe)
  └── Nginx/Traefik (para SSL se necessário)

  📋 PLANO DE DEPLOYMENT

  1. DOCKERFILE DE PRODUÇÃO

  Write(/tmp/mercurio-api-standalone/Dockerfile)
  ⎿  Wrote 53 lines to ../../../tmp/mercurio-api-standalone/Dockerfile
     # Multi-stage build for production
     FROM node:18-alpine AS builder
     WORKDIR /app
     # Copy package files
     COPY package*.json ./
     COPY tsconfig.json ./
     # Install dependencies
     … +43 lines (ctrl+r to expand)

⏺ 2. DOCKER-COMPOSE PARA PRODUÇÃO

  Write(/tmp/mercurio-api-standalone/docker-compose.prod.yml)
  ⎿  Wrote 105 lines to ../../../tmp/mercurio-api-standalone/docker-compose.prod.yml
     version: '3.8'
     services:
       # PostgreSQL Database
       mercurio-postgres:
         image: postgres:15-alpine
         container_name: mercurio-postgres
         restart: unless-stopped
         environment:
           POSTGRES_DB: mercurio
     … +95 lines (ctrl+r to expand)

⏺ 3. VARIÁVEIS DE AMBIENTE SEGURAS

  Write(/tmp/mercurio-api-standalone/.env.production.example)
  ⎿  Wrote 27 lines to ../../../tmp/mercurio-api-standalone/.env.production.example 
     # =============================================================================
     # MERCURIO API - PRODUCTION ENVIRONMENT VARIABLES
     # =============================================================================
     # IMPORTANTE: Renomeie este arquivo para .env.production e gere novos secrets!
     # Database Configuration
     POSTGRES_PASSWORD=your_super_secure_postgres_password_here_change_this
     # Encryption Configuration - GERE NOVOS SECRETS PARA PRODUÇÃO!
     # Use: openssl rand -base64 32
     … +17 lines (ctrl+r to expand)

⏺ 4. SCRIPT DE DEPLOY

  Write(/tmp/mercurio-api-standalone/deploy.sh)
  ⎿  Wrote 54 lines to ../../../tmp/mercurio-api-standalone/deploy.sh               
     #!/bin/bash
     # =============================================================================
     # MERCURIO API - PRODUCTION DEPLOYMENT SCRIPT
     # =============================================================================
     set -e
     echo "🚀 Starting Mercurio API deployment..."
     … +44 lines (ctrl+r to expand)

⏺ 5. CONFIGURAÇÃO DO N8N

  Write(/tmp/mercurio-api-standalone/n8n-config.md)
  ⎿  Wrote 106 lines to ../../../tmp/mercurio-api-standalone/n8n-config.md
     # N8N Configuration for Mercurio API
     ## Network Configuration
     Para conectar o N8N ao Mercurio API na mesma rede Docker:
     ### 1. Conectar N8N à rede Mercurio
     ```bash
     # Se N8N já estiver rodando, conecte à rede
     docker network connect mercurio-network n8n-container-name
     … +96 lines (ctrl+r to expand)

⏺ 6. MAKEFILE PARA FACILITAR OPERAÇÕES

  Write(/tmp/mercurio-api-standalone/Makefile)
  ⎿  Wrote 72 lines to ../../../tmp/mercurio-api-standalone/Makefile            
     # Mercurio API - Production Makefile
     # Default environment
     ENV ?= production
     # Docker compose files
     COMPOSE_FILE = docker-compose.prod.yml
     .PHONY: help build start stop restart logs status clean seed backup restore
     … +62 lines (ctrl+r to expand)

  Update Todos
  ⎿  ☒ 1. Preparar Dockerfile e docker-compose para produção
     ☒ 2. Configurar variáveis de ambiente de produção
     ☒ 3. Setup PostgreSQL em container
     ☒ 4. Configurar rede Docker interna
     ☒ 5. Setup SSL/TLS para API
     ☒ 6. Configurar logs e monitoramento
     ☒ 7. Backup e migração de dados
     ☒ 8. Criar scripts de deploy e operação

⏺ 🎯 PLANO DE DEPLOYMENT COMPLETO

  ARQUITETURA RECOMENDADA:

  VPS com Portainer
  ├── mercurio-network (rede interna)
  │   ├── mercurio-postgres:5432
  │   ├── mercurio-api:3000 (não exposta)
  │   └── n8n (conectado à mesma rede)
  └── Logs & Backups em volumes

  🚀 PASSOS PARA DEPLOY:

  1. PREPARAÇÃO DOS SECRETS

  # Gerar novos secrets seguros
  openssl rand -base64 32  # Para cada secret

  2. UPLOAD DOS ARQUIVOS

  Copie para sua VPS:
  - Dockerfile
  - docker-compose.prod.yml
  - .env.production (com seus secrets)
  - Makefile
  - deploy.sh

  3. DEPLOY SIMPLES

  # Na VPS
  chmod +x deploy.sh
  ./deploy.sh

  # OU usando Makefile
  make deploy

  4. CONFIGURAR N8N

  # Conectar N8N à rede Mercurio
  docker network connect mercurio-network your_n8n_container

  5. URLs INTERNAS NO N8N:

  - Track: http://mercurio-api:3000/v1/events/track
  - Identify: http://mercurio-api:3000/v1/events/identify
  - Health: http://mercurio-api:3000/health

  ✅ VANTAGENS DESSA ARQUITETURA:

  - ✅ Segurança: API não exposta na internet
  - ✅ Performance: Rede interna é mais rápida
  - ✅ Simplicidade: Sem necessidade de SSL interno
  - ✅ Backup: Scripts automáticos de backup
  - ✅ Monitoramento: Health checks configurados
  - ✅ Escalabilidade: Fácil de adicionar Redis depois

  🔧 OPERAÇÕES COMUNS:

  make status     # Ver status dos serviços
  make logs       # Ver logs em tempo real  
  make backup     # Backup do banco
  make health     # Verificar saúde da API
  make seed       # Criar API keys de teste

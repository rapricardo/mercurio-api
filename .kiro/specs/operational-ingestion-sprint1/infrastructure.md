# Infrastructure — Sprint 1 Ingestão Operacional

## 🎯 Overview

Este documento especifica a **infraestrutura local e de staging** necessária para suportar o desenvolvimento e operação do sistema de ingestão, incluindo **Docker Compose**, **environment configuration** e **health checks**.

---

## 🐳 Docker Compose Specification

### File Structure
```
/Users/tocha/Dev/gtm-master/
├── docker-compose.yml           # ← Primary compose file
├── docker-compose.override.yml  # ← Local development overrides  
├── .env.docker                 # ← Docker-specific variables
└── apps/api/
    ├── Dockerfile              # ← API container definition
    └── .env.example            # ← Updated with all variables
```

### 1. Main Docker Compose

**File**: `/Users/tocha/Dev/gtm-master/docker-compose.yml`

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: mercurio-postgres
    environment:
      POSTGRES_DB: mercurio
      POSTGRES_USER: mercurio
      POSTGRES_PASSWORD: mercurio_dev_password
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./apps/api/prisma/migrations:/docker-entrypoint-initdb.d/migrations:ro
    ports:
      - "5432:5432"
    networks:
      - mercurio-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mercurio -d mercurio"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
    restart: unless-stopped

  # Redis (for future rate limiting)
  redis:
    image: redis:7-alpine
    container_name: mercurio-redis
    ports:
      - "6379:6379"
    networks:
      - mercurio-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  # Mercurio API
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
      target: development
    container_name: mercurio-api
    environment:
      # Database
      DATABASE_URL: "postgresql://mercurio:mercurio_dev_password@postgres:5432/mercurio?schema=public"
      # Redis (optional for Sprint 1)
      REDIS_URL: "redis://redis:6379"
      # Application
      NODE_ENV: development
      PORT: 3000
      # Ingestion settings
      MERCURIO_INGEST_REPLAY_WINDOW: 300
      # Health check
      HEALTH_CHECK_TIMEOUT: 5000
    ports:
      - "3000:3000"
    networks:
      - mercurio-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    volumes:
      # Development hot-reload
      - ./apps/api/src:/app/src
      - ./apps/api/prisma:/app/prisma
      # Exclude node_modules
      - /app/node_modules

networks:
  mercurio-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

### 2. Development Override

**File**: `/Users/tocha/Dev/gtm-master/docker-compose.override.yml`

```yaml
version: '3.8'

# Override for local development
services:
  api:
    build:
      target: development
    environment:
      # Development-specific settings
      DEBUG: "mercurio:*"
      LOG_LEVEL: debug
    volumes:
      # Additional development volumes
      - ./apps/api/src:/app/src:cached
      - ./apps/api/prisma:/app/prisma:cached
    command: ["npm", "run", "dev"]

  postgres:
    # Development database exposed
    ports:
      - "5432:5432"
    environment:
      # Less strict settings for development
      POSTGRES_LOG_STATEMENT: all
      POSTGRES_LOG_MIN_MESSAGES: info
```

### 3. API Dockerfile

**File**: `/Users/tocha/Dev/gtm-master/apps/api/Dockerfile`

```dockerfile
# Multi-stage Dockerfile for Mercurio API
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Generate Prisma client
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 3000
CMD ["npm", "start"]
```

---

## ⚙️ Environment Configuration

### 1. Enhanced .env.example

**File**: `/Users/tocha/Dev/gtm-master/apps/api/.env.example`

```bash
# =============================================================================
# MERCURIO API - ENVIRONMENT CONFIGURATION
# =============================================================================
# Copy this file to .env and adjust values for your environment

# -----------------------------------------------------------------------------
# DATABASE CONFIGURATION
# -----------------------------------------------------------------------------
# PostgreSQL connection string
# Format: postgresql://[user[:password]@][host][:port]/database[?options]
DATABASE_URL="postgresql://tocha@localhost:5432/mercurio?schema=public"

# Connection pool settings (optional)
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# -----------------------------------------------------------------------------
# REDIS CONFIGURATION (Optional - Future Rate Limiting)
# -----------------------------------------------------------------------------
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# -----------------------------------------------------------------------------
# APPLICATION SETTINGS
# -----------------------------------------------------------------------------
# Runtime environment
NODE_ENV=development

# Server port
PORT=3000

# Application secrets
API_SECRET_KEY="your-secret-key-here-change-in-production"

# -----------------------------------------------------------------------------
# INGESTION SETTINGS  
# -----------------------------------------------------------------------------
# Anti-replay window for server-side GTM (seconds)
MERCURIO_INGEST_REPLAY_WINDOW=300

# Payload limits
MAX_PAYLOAD_SIZE_KB=256
MAX_BATCH_SIZE=50

# Rate limiting (requests per minute per tenant)
RATE_LIMIT_PER_TENANT=1000

# -----------------------------------------------------------------------------
# LOGGING & MONITORING
# -----------------------------------------------------------------------------
# Log level: error, warn, info, debug
LOG_LEVEL=info

# Structured logging format
LOG_FORMAT=json

# Health check settings
HEALTH_CHECK_TIMEOUT=5000

# -----------------------------------------------------------------------------
# SECURITY
# -----------------------------------------------------------------------------
# CORS origins (comma-separated)
CORS_ORIGINS="http://localhost:3000,http://localhost:3001"

# API Key configuration
API_KEY_HEADER_NAME="Authorization"
API_KEY_QUERY_PARAM="auth"

# -----------------------------------------------------------------------------
# DEVELOPMENT SETTINGS
# -----------------------------------------------------------------------------
# Enable debug mode
DEBUG="mercurio:*"

# Prisma debug
PRISMA_DEBUG=false

# -----------------------------------------------------------------------------
# SEEDING / PROVISIONING
# -----------------------------------------------------------------------------
# Default values for seeding
SEED_TENANT_NAME="Demo Tenant"
SEED_WORKSPACE_NAME="Demo Workspace"

# Sample data creation
CREATE_SAMPLE_DATA=true

# -----------------------------------------------------------------------------
# DOCKER ENVIRONMENT VARIABLES
# -----------------------------------------------------------------------------
# Used when running in Docker containers
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mercurio
POSTGRES_USER=mercurio
POSTGRES_PASSWORD=mercurio_dev_password

REDIS_HOST=localhost
REDIS_PORT=6379
```

### 2. Docker Environment File

**File**: `/Users/tocha/Dev/gtm-master/.env.docker`

```bash
# Docker Compose Environment Variables
# These override .env values when running via docker-compose

# Database (using container names)
DATABASE_URL=postgresql://mercurio:mercurio_dev_password@postgres:5432/mercurio?schema=public

# Redis (using container names)  
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=development
PORT=3000

# Development settings
DEBUG=mercurio:*
LOG_LEVEL=debug
```

---

## 🏥 Health Check Implementation

### 1. Enhanced Health Controller

**File**: `/Users/tocha/Dev/gtm-master/apps/api/src/health.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';

interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  services: {
    database: ServiceHealth;
    redis?: ServiceHealth;
  };
  system: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      usage: string;
    };
    pid: number;
  };
}

interface ServiceHealth {
  status: 'ok' | 'error';
  responseTime: number;
  error?: string;
}

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get('health')
  async getHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    // Check database health
    const dbHealth = await this.checkDatabase();
    
    // Check Redis health (optional)
    const redisHealth = await this.checkRedis();
    
    // System information
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed;
    
    const health: HealthStatus = {
      status: dbHealth.status === 'ok' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: dbHealth,
        ...(redisHealth && { redis: redisHealth })
      },
      system: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(usedMemory / 1024 / 1024),
          total: Math.round(totalMemory / 1024 / 1024), 
          usage: `${Math.round((usedMemory / totalMemory) * 100)}%`
        },
        pid: process.pid
      }
    };

    return health;
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      await this.prisma.$queryRaw`SELECT 1 as health_check`;
      
      return {
        status: 'ok',
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth | null> {
    // Skip Redis check if not configured
    if (!process.env.REDIS_URL) {
      return null;
    }

    const startTime = Date.now();
    
    try {
      // TODO: Implement Redis health check when Redis client is added
      return {
        status: 'ok',
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  @Get('ping')
  ping() {
    return { pong: true, timestamp: new Date().toISOString() };
  }
}
```

---

## 🛠️ Makefile for Operations

**File**: `/Users/tocha/Dev/gtm-master/Makefile`

```makefile
# Mercurio Development & Operations Makefile
# Usage: make <target>

# Variables
DOCKER_COMPOSE = docker-compose
API_SERVICE = api
DB_SERVICE = postgres
REDIS_SERVICE = redis

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

.DEFAULT_GOAL := help

## Development Commands

.PHONY: help
help: ## Show this help message
	@echo "$(GREEN)Mercurio Development Commands$(NC)"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

.PHONY: up
up: ## Start all services (detached)
	@echo "$(GREEN)🚀 Starting Mercurio services...$(NC)"
	$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)✅ Services started. Check status with: make status$(NC)"

.PHONY: down
down: ## Stop all services  
	@echo "$(RED)🛑 Stopping Mercurio services...$(NC)"
	$(DOCKER_COMPOSE) down

.PHONY: restart
restart: down up ## Restart all services

.PHONY: status
status: ## Show service status
	@echo "$(GREEN)📊 Service Status:$(NC)"
	$(DOCKER_COMPOSE) ps

.PHONY: logs
logs: ## Show logs for all services
	$(DOCKER_COMPOSE) logs -f --tail=50

.PHONY: logs-api
logs-api: ## Show API logs only
	$(DOCKER_COMPOSE) logs -f --tail=50 $(API_SERVICE)

.PHONY: logs-db  
logs-db: ## Show database logs only
	$(DOCKER_COMPOSE) logs -f --tail=50 $(DB_SERVICE)

## Database Commands

.PHONY: db-up
db-up: ## Start only database
	@echo "$(GREEN)🗄️  Starting database...$(NC)"
	$(DOCKER_COMPOSE) up -d $(DB_SERVICE)

.PHONY: db-migrate
db-migrate: ## Run database migrations
	@echo "$(GREEN)🔄 Running database migrations...$(NC)"
	$(DOCKER_COMPOSE) exec $(API_SERVICE) npm run prisma:migrate

.PHONY: db-seed
db-seed: ## Seed database with demo data
	@echo "$(GREEN)🌱 Seeding database...$(NC)"
	$(DOCKER_COMPOSE) exec $(API_SERVICE) npm run db:seed

.PHONY: db-studio
db-studio: ## Open Prisma Studio
	@echo "$(GREEN)🎨 Opening Prisma Studio...$(NC)"
	$(DOCKER_COMPOSE) exec $(API_SERVICE) npm run prisma:studio

.PHONY: db-reset
db-reset: ## Reset database (WARNING: destroys data)
	@echo "$(RED)⚠️  Resetting database (this will destroy all data)...$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(DOCKER_COMPOSE) exec $(API_SERVICE) npx prisma migrate reset --force; \
	else \
		echo "Cancelled."; \
	fi

## Provisioning Commands

.PHONY: provision
provision: ## Provision new tenant (interactive)
	@echo "$(GREEN)🏢 Provisioning new tenant...$(NC)"
	@read -p "Tenant name: " tenant_name; \
	read -p "Workspace name [Default Workspace]: " workspace_name; \
	workspace_name=$${workspace_name:-"Default Workspace"}; \
	$(DOCKER_COMPOSE) exec $(API_SERVICE) npm run provision -- --name "$$tenant_name" --workspace "$$workspace_name"

## Health & Monitoring

.PHONY: health
health: ## Check service health
	@echo "$(GREEN)🏥 Checking service health...$(NC)"
	@curl -s http://localhost:3000/health | jq '.' || echo "$(RED)❌ Health check failed$(NC)"

.PHONY: ping
ping: ## Ping API service
	@curl -s http://localhost:3000/ping | jq '.' || echo "$(RED)❌ Ping failed$(NC)"

## Development

.PHONY: build
build: ## Build all containers
	@echo "$(GREEN)🔨 Building containers...$(NC)"
	$(DOCKER_COMPOSE) build

.PHONY: shell-api
shell-api: ## Open shell in API container
	$(DOCKER_COMPOSE) exec $(API_SERVICE) sh

.PHONY: shell-db
shell-db: ## Open PostgreSQL shell
	$(DOCKER_COMPOSE) exec $(DB_SERVICE) psql -U mercurio -d mercurio

## Cleanup

.PHONY: clean
clean: ## Remove stopped containers and unused images
	@echo "$(YELLOW)🧹 Cleaning up Docker resources...$(NC)"
	docker container prune -f
	docker image prune -f

.PHONY: clean-volumes
clean-volumes: ## Remove all volumes (WARNING: destroys data)
	@echo "$(RED)⚠️  This will destroy all database data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(DOCKER_COMPOSE) down -v; \
		docker volume prune -f; \
	else \
		echo "Cancelled."; \
	fi

## Quick Start

.PHONY: quickstart
quickstart: up db-migrate db-seed health ## Complete setup: up -> migrate -> seed -> health check
	@echo "$(GREEN)🎉 Mercurio is ready! API available at: http://localhost:3000$(NC)"
	@echo "$(GREEN)📊 Health check: http://localhost:3000/health$(NC)"
	@echo "$(GREEN)🎨 Prisma Studio: make db-studio$(NC)"
```

---

## 🚀 Quick Start Guide

### Initial Setup
```bash
# Clone and navigate
cd /Users/tocha/Dev/gtm-master

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp .env.docker.example .env.docker  # if exists

# Start everything
make quickstart

# Or step by step:
make up           # Start services
make db-migrate   # Run migrations  
make db-seed      # Create sample data
make health       # Verify health
```

### Daily Development
```bash
# Start development environment
make up

# View logs  
make logs-api

# Provision new tenant
make provision

# Check health
make health
```

### Cleanup
```bash
# Stop services
make down

# Clean up resources
make clean

# Nuclear option (destroys all data)
make clean-volumes
```

---

## ⚠️ Troubleshooting

### Common Issues

1. **Port 5432 already in use**
   ```bash
   # Check what's using the port
   lsof -i :5432
   # Stop local PostgreSQL if needed
   brew services stop postgresql
   ```

2. **Permission denied**
   ```bash
   # Fix Docker permissions
   sudo chown -R $USER:$USER .
   ```

3. **Database connection failed**
   ```bash
   # Check containers are healthy
   make status
   # Check logs
   make logs-db
   ```

4. **API not responding**
   ```bash
   # Check API logs
   make logs-api
   # Restart API only
   docker-compose restart api
   ```

---

## ✅ Acceptance Criteria

- [ ] `make up` starts PostgreSQL, Redis, and API successfully
- [ ] `/health` endpoint returns comprehensive health status  
- [ ] Database migrations run automatically
- [ ] Environment variables properly configured
- [ ] Health checks pass for all services
- [ ] Logs are structured and informative
- [ ] `make provision` creates new tenants successfully
- [ ] Docker containers restart on failure
- [ ] Makefile commands work correctly
- [ ] Documentation is complete and accurate
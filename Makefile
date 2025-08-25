# Mercurio API - Production Makefile
.DEFAULT_GOAL := help
.PHONY: help install build start stop restart logs status health clean test deploy backup

# Colors for output
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[1;33m
BLUE = \033[0;34m
NC = \033[0m # No Color

# Docker compose file
COMPOSE_FILE = docker-compose.prod.yml
PROJECT_NAME = mercurio-api

help: ## Show this help message
	@echo "$(BLUE)Mercurio API - Production Commands$(NC)"
	@echo "=================================="
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	@echo "$(YELLOW)📦 Installing dependencies...$(NC)"
	@npm install
	@echo "$(GREEN)✅ Dependencies installed$(NC)"

build: ## Build Docker images
	@echo "$(YELLOW)🏗️  Building Docker images...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) build --no-cache
	@echo "$(GREEN)✅ Images built successfully$(NC)"

start: ## Start all services
	@echo "$(YELLOW)🚀 Starting services...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) up -d
	@sleep 15
	@echo "$(GREEN)✅ Services started$(NC)"
	@make status

stop: ## Stop all services
	@echo "$(YELLOW)🛑 Stopping services...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)✅ Services stopped$(NC)"

restart: ## Restart all services
	@echo "$(YELLOW)🔄 Restarting services...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) restart
	@echo "$(GREEN)✅ Services restarted$(NC)"

logs: ## Follow logs for all services
	@docker-compose -f $(COMPOSE_FILE) logs -f

logs-api: ## Follow API logs only
	@docker-compose -f $(COMPOSE_FILE) logs -f api

logs-db: ## Follow database logs only
	@docker-compose -f $(COMPOSE_FILE) logs -f postgres

status: ## Check service status
	@echo "$(BLUE)📊 Service Status:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) ps

health: ## Check API health
	@echo "$(BLUE)🏥 Health Check:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec api curl -s http://localhost:3000/health | jq . || echo "$(RED)❌ Health check failed$(NC)"

migrate: ## Run database migrations
	@echo "$(YELLOW)📊 Running database migrations...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec api npm run prisma:deploy
	@echo "$(GREEN)✅ Migrations completed$(NC)"

seed: ## Seed database with initial data
	@echo "$(YELLOW)🌱 Seeding database...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec api npm run db:seed
	@echo "$(GREEN)✅ Database seeded$(NC)"

shell: ## Open shell in API container
	@docker-compose -f $(COMPOSE_FILE) exec api sh

shell-db: ## Open postgres shell
	@docker-compose -f $(COMPOSE_FILE) exec postgres psql -U mercurio_user -d mercurio

test: ## Run tests
	@echo "$(YELLOW)🧪 Running tests...$(NC)"
	@npm test
	@echo "$(GREEN)✅ Tests completed$(NC)"

test-load: ## Run load tests
	@echo "$(YELLOW)⚡ Running load tests...$(NC)"
	@npm run test:load
	@echo "$(GREEN)✅ Load tests completed$(NC)"

backup: ## Backup database
	@echo "$(YELLOW)💾 Creating database backup...$(NC)"
	@mkdir -p ./backups
	@docker-compose -f $(COMPOSE_FILE) exec postgres pg_dump -U mercurio_user -d mercurio > ./backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✅ Backup created in ./backups/$(NC)"

restore: ## Restore database from backup (Usage: make restore BACKUP=backup_file.sql)
ifndef BACKUP
	@echo "$(RED)❌ Please specify backup file: make restore BACKUP=backup_file.sql$(NC)"
else
	@echo "$(YELLOW)📥 Restoring database from $(BACKUP)...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec -T postgres psql -U mercurio_user -d mercurio < ./backups/$(BACKUP)
	@echo "$(GREEN)✅ Database restored$(NC)"
endif

clean: ## Remove containers and volumes (⚠️ DESTRUCTIVE)
	@echo "$(RED)⚠️  This will remove all containers and data. Are you sure? [y/N]$(NC)" 
	@read ans && [ $${ans:-N} = y ]
	@echo "$(YELLOW)🗑️  Cleaning up containers and volumes...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down -v --remove-orphans
	@docker system prune -f
	@echo "$(GREEN)✅ Cleanup completed$(NC)"

deploy: ## Full deployment (build, migrate, start)
	@echo "$(BLUE)🚀 Starting full deployment...$(NC)"
	@make build
	@make start
	@sleep 20
	@make migrate
	@make seed
	@make health
	@make status
	@echo "$(GREEN)🎉 Deployment completed successfully!$(NC)"

update: ## Update to latest image and restart
	@echo "$(YELLOW)📥 Pulling latest images...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) pull
	@make restart
	@sleep 15
	@make migrate
	@make health
	@echo "$(GREEN)✅ Update completed$(NC)"

metrics: ## Show performance metrics
	@echo "$(BLUE)📈 Performance Metrics:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec api curl -s http://localhost:3000/monitoring/metrics | head -20

monitoring: ## Open monitoring endpoints
	@echo "$(BLUE)📊 Monitoring URLs:$(NC)"
	@echo "Health: http://localhost:3000/health"
	@echo "Metrics: http://localhost:3000/monitoring/metrics"
	@echo "Prisma Studio: Run 'make shell' then 'npm run prisma:studio'"

# Development helpers
dev: ## Start development environment
	@echo "$(YELLOW)🔧 Starting development environment...$(NC)"
	@npm run dev

dev-db: ## Start only database for development
	@docker-compose -f $(COMPOSE_FILE) up -d postgres
	@echo "$(GREEN)✅ Development database started$(NC)"

# Docker management
images: ## List project images
	@docker images | grep mercurio

containers: ## List project containers
	@docker ps -a | grep mercurio

networks: ## List project networks
	@docker network ls | grep mercurio

volumes: ## List project volumes
	@docker volume ls | grep mercurio
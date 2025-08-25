# Installation Guide - Mercurio API

Complete installation instructions for development and production environments.

## 🎯 Overview

This guide covers installing Mercurio API in three scenarios:
1. **Development** - Local development with Node.js
2. **Production Docker** - Self-hosted with Docker Compose
3. **Production Portainer** - Managed deployment with Portainer

Choose the installation method that best fits your needs.

---

## 📋 Prerequisites

### All Environments
- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
- **PostgreSQL 13+** - Database server
- **Git** - Version control

### Docker Environments
- **Docker 20.10+** - Container runtime
- **Docker Compose 2.0+** - Multi-container orchestration

### Portainer Environment
- **Portainer CE/EE** - Container management web UI
- **VPS/Server** - With Docker and Portainer installed

---

## 💻 Development Installation

Perfect for local development and testing.

### Step 1: System Prerequisites

#### macOS (with Homebrew)
```bash
# Install Node.js
brew install node@18

# Install PostgreSQL
brew install postgresql@15
brew services start postgresql

# Install Git (if needed)
brew install git
```

#### Ubuntu/Debian
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install Git
sudo apt-get install -y git
```

#### Windows
1. **Download Node.js** from [nodejs.org](https://nodejs.org/)
2. **Install PostgreSQL** from [postgresql.org](https://www.postgresql.org/)
3. **Install Git** from [git-scm.com](https://git-scm.com/)

### Step 2: Database Setup
```bash
# Create database user (PostgreSQL)
sudo -u postgres createuser --interactive --pwprompt mercurio_user
# Enter password when prompted

# Create database
sudo -u postgres createdb -O mercurio_user mercurio

# Test connection
psql -h localhost -U mercurio_user -d mercurio -c "SELECT 1;"
```

### Step 3: Clone and Install
```bash
# Clone repository
git clone https://github.com/your-username/mercurio-api.git
cd mercurio-api

# Install dependencies
npm install

# Verify installation
npm run --version
node --version
```

### Step 4: Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit environment file
nano .env  # or use your preferred editor
```

Configure your `.env` file:
```bash
# Database
DATABASE_URL="postgresql://mercurio_user:your_password@localhost:5432/mercurio?schema=public"

# Encryption (use these for development only)
ENCRYPTION_KEK_SECRET="VGVzdEtla1NlY3JldEZvckRldmVsb3BtZW50T25seQ=="
EMAIL_DEK_SECRET="RW1haWxEYXRhRW5jcnlwdGlvbktleUZvckRldmVsb3BtZW50"
PHONE_DEK_SECRET="UGhvbmVEYXRhRW5jcnlwdGlvbktleUZvckRldmVsb3BtZW50"
EMAIL_FINGERPRINT_SECRET="RW1haWxGaW5nZXJwcmludFNlY3JldEZvckRldmVsb3BtZW50"
PHONE_FINGERPRINT_SECRET="UGhvbmVGaW5nZXJwcmludFNlY3JldEZvckRldmVsb3BtZW50"
ENCRYPTION_KEY_VERSION="1"

# Application
NODE_ENV="development"
PORT=3000
LOG_LEVEL="debug"
```

### Step 5: Database Migration
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed initial data
npm run db:seed

# Note the API key output for testing
```

### Step 6: Start Development Server
```bash
# Start in development mode
npm run dev

# Server starts at http://localhost:3000
```

### Step 7: Verify Installation
```bash
# Health check
curl http://localhost:3000/health

# Should return: {"status":"healthy","service":"mercurio-api",...}
```

---

## 🐳 Production Docker Installation

Ideal for self-hosted production deployments.

### Step 1: System Prerequisites

#### Ubuntu/Debian Server
```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

### Step 2: Clone Repository
```bash
# Clone on your server
git clone https://github.com/your-username/mercurio-api.git
cd mercurio-api
```

### Step 3: Production Environment
```bash
# Copy production environment template
cp .env.example .env.production

# Generate secure secrets
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env.production
echo "ENCRYPTION_KEK_SECRET=$(openssl rand -base64 32)" >> .env.production
echo "EMAIL_DEK_SECRET=$(openssl rand -base64 32)" >> .env.production
echo "PHONE_DEK_SECRET=$(openssl rand -base64 32)" >> .env.production
echo "EMAIL_FINGERPRINT_SECRET=$(openssl rand -base64 32)" >> .env.production
echo "PHONE_FINGERPRINT_SECRET=$(openssl rand -base64 32)" >> .env.production

# Edit final configuration
nano .env.production
```

### Step 4: Deploy with Docker Compose
```bash
# Deploy all services
make deploy

# Alternative manual commands:
# docker-compose -f docker-compose.prod.yml build
# docker-compose -f docker-compose.prod.yml up -d
# make migrate
# make seed
```

### Step 5: Verify Production Deployment
```bash
# Check service status
make status

# Run health check  
make health

# View logs
make logs-api
```

### Step 6: Post-Deployment Configuration
```bash
# Create production API keys
make shell
npm run provision:tenant

# Setup backups (optional)
make backup

# Configure reverse proxy (optional)
# nginx or Traefik configuration
```

---

## 🏗️ Production Portainer Installation

Best for managed deployments with web-based administration.

### Step 1: Portainer Prerequisites

Ensure you have:
- **VPS with Docker installed**
- **Portainer CE/EE running** 
- **SSH access** to the server
- **Domain name** (optional, for SSL)

### Step 2: Prepare Repository

#### Option A: Use GitHub Container Registry (Recommended)
```bash
# On your local machine
git clone https://github.com/your-username/mercurio-api.git
cd mercurio-api

# Push to your GitHub repository
git remote add origin https://github.com/your-username/mercurio-api.git
git push origin main

# GitHub Actions will automatically build and push the image
```

#### Option B: Manual Image Build
```bash
# On your server
git clone https://github.com/your-username/mercurio-api.git
cd mercurio-api
docker build -t mercurio-api:latest .
```

### Step 3: Configure Portainer Stack

1. **Access Portainer** web interface
2. **Navigate to Stacks** → **Add Stack**
3. **Name**: `mercurio-api`
4. **Build Method**: Web editor

### Step 4: Stack Configuration

Copy content from `portainer/docker-compose.yml` and update:
- Replace `YOUR_GITHUB_USERNAME` with your GitHub username
- Adjust network names for your environment

### Step 5: Environment Variables

In Portainer's Environment Variables section:
```bash
# Generate these secrets: openssl rand -base64 32
POSTGRES_PASSWORD=your_secure_password
ENCRYPTION_KEK_SECRET=your_generated_secret
EMAIL_DEK_SECRET=your_generated_secret  
PHONE_DEK_SECRET=your_generated_secret
EMAIL_FINGERPRINT_SECRET=your_generated_secret
PHONE_FINGERPRINT_SECRET=your_generated_secret
```

### Step 6: Deploy Stack

1. **Click "Deploy the stack"**
2. **Monitor deployment** in Portainer
3. **Wait for healthy status** (2-3 minutes)

### Step 7: Post-Deployment Setup

#### Initialize Database
```bash
# Access API container console in Portainer
npm run prisma:deploy
npm run db:seed
```

#### Connect to N8N (if applicable)
```bash
# Find your N8N container name
docker ps | grep n8n

# Connect networks
docker network connect mercurio-api_mercurio_network your-n8n-container
```

#### Verify Deployment
```bash
# Test from within the network
curl http://api:3000/health
```

---

## 🔧 Post-Installation Configuration

### Create API Keys

#### Development
```bash
npm run db:seed
# API key will be displayed in console
```

#### Production
```bash
# Using make commands
make shell
npm run provision:tenant

# Or via Portainer console
npm run provision:tenant
```

### Configure Monitoring

#### Health Checks
- **API**: `http://localhost:3000/health`
- **Metrics**: `http://localhost:3000/monitoring/metrics`
- **Database**: Automatic health checks in Docker

#### Logging
```bash
# View application logs
make logs-api

# View database logs  
make logs-db

# In Portainer: Container → Logs tab
```

### Security Hardening

#### Encryption Keys
```bash
# Rotate encryption keys periodically
openssl rand -base64 32  # Generate new secrets
# Update environment variables
# Restart services
```

#### Database Security
```bash
# Create read-only user (optional)
psql -h localhost -U mercurio_user -d mercurio
CREATE ROLE readonly LOGIN PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE mercurio TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
```

#### Network Security
- Configure firewall rules
- Use internal networks for container communication
- Set up SSL/TLS certificates

---

## 🔄 Maintenance

### Updates

#### Development
```bash
git pull origin main
npm install
npx prisma migrate dev
npm run dev
```

#### Production Docker
```bash
git pull origin main
make build
make restart
make migrate
```

#### Production Portainer
1. **GitHub push** triggers image build
2. **Pull latest image** in Portainer
3. **Recreate containers**
4. **Run migrations** via console

### Backups

#### Database Backups
```bash
# Manual backup
make backup

# Automated backup (add to crontab)
0 2 * * * cd /path/to/mercurio-api && make backup
```

#### Configuration Backups
- Export Portainer stack configurations
- Backup environment variable files
- Document custom network configurations

---

## 🚨 Troubleshooting

### Installation Issues

#### "Node.js version not supported"
```bash
# Install correct Node.js version
nvm install 18
nvm use 18

# Or update package.json engines if needed
```

#### "Database connection failed"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -h localhost -U mercurio_user -d mercurio

# Check DATABASE_URL format
echo $DATABASE_URL
```

#### "Port already in use"
```bash
# Find process using port
lsof -i :3000

# Kill process or change port in .env
PORT=3001
```

#### "Prisma client errors"  
```bash
# Regenerate Prisma client
rm -rf node_modules/.prisma
npx prisma generate

# Reset if needed
npx prisma migrate reset
```

### Docker Issues

#### "Cannot connect to Docker daemon"
```bash
# Start Docker service
sudo systemctl start docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### "Container exits immediately"
```bash
# Check logs
docker logs mercurio-api
make logs-api

# Check environment variables
docker exec mercurio-api env
```

#### "Service unhealthy"
```bash
# Check health endpoint
curl http://localhost:3000/health

# Increase health check timeout
# In docker-compose.yml: timeout: 30s
```

### Portainer Issues

#### "Stack deploy fails"
- Check environment variables are set
- Verify Docker image exists and is accessible
- Review stack logs in Portainer

#### "Container can't reach database"
- Verify networks are configured correctly
- Check service names in compose file
- Test connectivity between containers

---

## 📞 Support

### Documentation
- **README.md** - Overview and features
- **DEPLOY.md** - Production deployment guide
- **MIGRATION.md** - Migration from monorepo

### Community
- **GitHub Issues** - Bug reports and feature requests
- **Discussions** - General questions and help

### Professional Support
- **Email**: support@mercurio.com
- **Priority Support**: Available for enterprise customers

---

**Installation completed successfully!** 🎉

Your Mercurio API is now ready to handle analytics events.
# Deployment Guide: Mercurio API 🚀

Complete guide for deploying Mercurio API to production using Docker, Portainer, and GitHub Actions.

## 🎯 Deployment Options

### Option 1: Portainer + GitHub Container Registry (Recommended)
- ✅ **Automated**: GitHub Actions build images
- ✅ **User-friendly**: Portainer web interface  
- ✅ **Scalable**: Easy to manage multiple environments
- ✅ **Secure**: Private container registry

### Option 2: Docker Compose (Simple)
- ✅ **Quick setup**: Single command deployment
- ✅ **Local development**: Easy testing
- ⚠️ **Manual updates**: Requires SSH access

### Option 3: Kubernetes (Advanced)
- ✅ **Enterprise-grade**: Auto-scaling, self-healing
- ⚠️ **Complex**: Requires K8s knowledge

## 🏗️ Architecture Overview

```
Internet → Nginx/Cloudflare → Portainer Stack
                               ├── mercurio-api:3000
                               ├── postgres:5432  
                               ├── redis:6379 (optional)
                               └── n8n (existing)
```

## 🚀 Quick Deployment (Portainer)

### Prerequisites
- VPS with Docker and Portainer installed
- GitHub account with Container Registry access
- Domain name (optional)

### Step 1: Setup GitHub Container Registry

1. **Enable GitHub Packages** in your repository
2. **Create Personal Access Token**:
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Create token with `write:packages` permission
3. **Login to GHCR** on your VPS:
   ```bash
   echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
   ```

### Step 2: Configure GitHub Actions

The repository includes pre-configured workflows:
- `.github/workflows/build-backend.yml` - Builds API image on every push

Push to main branch triggers automatic image build:
```bash
git push origin main
# → Builds ghcr.io/username/mercurio-api:latest
```

### Step 3: Deploy with Portainer

1. **Access Portainer** web interface
2. **Create New Stack** named "mercurio-api"
3. **Paste Docker Compose** (see below)
4. **Set Environment Variables** (see configuration section)
5. **Deploy Stack**

### Step 4: Portainer Stack Configuration

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: mercurio
      POSTGRES_USER: mercurio_user  
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - mercurio_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mercurio_user -d mercurio"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Mercurio API
  api:
    image: ghcr.io/YOUR_USERNAME/mercurio-api:latest
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://mercurio_user:${POSTGRES_PASSWORD}@postgres:5432/mercurio?schema=public
      
      # Encryption (generate new secrets!)
      ENCRYPTION_KEK_SECRET: ${ENCRYPTION_KEK_SECRET}
      EMAIL_DEK_SECRET: ${EMAIL_DEK_SECRET}
      PHONE_DEK_SECRET: ${PHONE_DEK_SECRET}
      EMAIL_FINGERPRINT_SECRET: ${EMAIL_FINGERPRINT_SECRET}
      PHONE_FINGERPRINT_SECRET: ${PHONE_FINGERPRINT_SECRET}
      ENCRYPTION_KEY_VERSION: "1"
      
      # Optional Redis
      REDIS_ENABLED: "false"
      
      LOG_LEVEL: info
    volumes:
      - ./logs:/app/logs
    networks:
      - mercurio_network
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Redis (Optional - for rate limiting)  
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 128mb
    volumes:
      - redis_data:/data
    networks:
      - mercurio_network
    profiles:
      - redis

volumes:
  postgres_data:
  redis_data:

networks:
  mercurio_network:
    internal: true  # Internal network - not exposed to internet
```

### Step 5: Environment Variables in Portainer

In Portainer stack configuration, add these environment variables:

```bash
# Database
POSTGRES_PASSWORD=your_super_secure_password_here

# Encryption Keys (generate with: openssl rand -base64 32)
ENCRYPTION_KEK_SECRET=NEW_32_BYTE_BASE64_ENCODED_SECRET
EMAIL_DEK_SECRET=NEW_32_BYTE_BASE64_ENCODED_SECRET
PHONE_DEK_SECRET=NEW_32_BYTE_BASE64_ENCODED_SECRET
EMAIL_FINGERPRINT_SECRET=NEW_32_BYTE_BASE64_ENCODED_SECRET
PHONE_FINGERPRINT_SECRET=NEW_32_BYTE_BASE64_ENCODED_SECRET
```

## 🔐 Security Configuration

### Generate Production Secrets
```bash
# Generate secure encryption keys
openssl rand -base64 32  # Use for each encryption secret

# Generate strong database password
openssl rand -base64 24
```

### Network Security
- ✅ **Internal Network**: API not directly exposed to internet
- ✅ **N8N Integration**: Connect N8N to same Docker network
- ✅ **Database Security**: PostgreSQL only accessible within network

### Connect N8N to API
```bash
# Connect existing N8N container to Mercurio network
docker network connect mercurio-api_mercurio_network your-n8n-container

# N8N can now use internal URL: http://api:3000
```

## 📊 Post-Deployment Setup

### 1. Database Migration
```bash
# Run database migrations
docker exec mercurio-api-api-1 npm run prisma:deploy

# Seed initial data (creates API keys)
docker exec mercurio-api-api-1 npm run db:seed
```

### 2. Create Production API Keys
```bash
# Access API container
docker exec -it mercurio-api-api-1 bash

# Run provision script  
npm run provision:tenant

# Copy the API key for production use
```

### 3. Health Check Verification
```bash
# Check API health
curl http://localhost:3000/health

# Check from N8N network
docker exec your-n8n-container curl http://api:3000/health
```

## 🔄 Updates and Maintenance

### Updating API Version
1. **Push code to GitHub** → Triggers automatic build
2. **Pull new image** in Portainer:
   ```bash
   docker pull ghcr.io/username/mercurio-api:latest
   ```
3. **Restart stack** in Portainer web interface
4. **Run migrations** if needed:
   ```bash
   docker exec mercurio-api-api-1 npm run prisma:deploy
   ```

### Database Backups
```bash
# Create backup
docker exec mercurio-api-postgres-1 pg_dump -U mercurio_user mercurio > backup_$(date +%Y%m%d).sql

# Restore backup  
docker exec -i mercurio-api-postgres-1 psql -U mercurio_user -d mercurio < backup_20250825.sql
```

### Log Management
```bash
# View API logs
docker logs mercurio-api-api-1 -f

# View structured logs
docker exec mercurio-api-api-1 tail -f logs/application.log | jq
```

## 📈 Monitoring and Alerts

### Health Monitoring
```bash
# API Health
curl http://localhost:3000/health

# Database Health
docker exec mercurio-api-postgres-1 pg_isready -U mercurio_user
```

### Performance Metrics
```bash
# Get metrics (if enabled)
curl http://localhost:3000/monitoring/metrics

# Database performance
docker exec mercurio-api-postgres-1 psql -U mercurio_user -d mercurio -c "SELECT * FROM pg_stat_activity;"
```

### Alerts (Optional)
Set up monitoring alerts for:
- API health check failures
- High error rates
- Database connection issues
- High memory/CPU usage

## 🧪 Testing Production Deployment

### Smoke Tests
```bash
# Test event ingestion
curl -X POST http://api:3000/v1/events/track \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{"event_name": "test", "anonymous_id": "a_test"}'

# Test identification  
curl -X POST http://api:3000/v1/events/identify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{"anonymous_id": "a_test", "traits": {"email": "test@example.com"}}'
```

### Load Testing (Optional)
```bash
# Run load tests against production
docker exec mercurio-api-api-1 npm run test:load
```

## 🚨 Troubleshooting

### Common Issues

#### API Container Won't Start
```bash
# Check logs
docker logs mercurio-api-api-1

# Check environment variables
docker exec mercurio-api-api-1 env | grep -E "(DATABASE_URL|ENCRYPTION)"
```

#### Database Connection Failed
```bash
# Test database connection
docker exec mercurio-api-postgres-1 psql -U mercurio_user -d mercurio -c "SELECT 1;"

# Check network connectivity
docker exec mercurio-api-api-1 ping postgres
```

#### N8N Can't Reach API
```bash
# Check network connection
docker network ls
docker network inspect mercurio-api_mercurio_network

# Test from N8N container
docker exec your-n8n-container curl http://api:3000/health
```

## 📞 Support

### Emergency Contacts
- **Production Issues**: [Your emergency contact]
- **GitHub Issues**: [Repository issues URL]
- **Documentation**: This deployment guide

### Rollback Procedure
```bash
# Rollback to previous image version
docker pull ghcr.io/username/mercurio-api:previous-tag
# Update image tag in Portainer
# Restart stack
```

---

**Deployment completed successfully!** 🎉

Your Mercurio API is now running in production and ready to handle analytics events!
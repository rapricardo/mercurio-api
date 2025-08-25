# Portainer Setup Guide for Mercurio API

Step-by-step guide to deploy Mercurio API using Portainer.

## 📋 Prerequisites

- [x] Portainer installed on your VPS
- [x] Docker and Docker Compose available
- [x] N8N already running (optional, for integration)
- [x] GitHub Container Registry access configured

## 🚀 Deployment Steps

### Step 1: Access Portainer Web Interface

1. Open your Portainer web interface (usually `https://your-vps-ip:9000`)
2. Login with your admin credentials
3. Select your Docker environment

### Step 2: Create New Stack

1. **Navigate to "Stacks"** in the left sidebar
2. **Click "Add Stack"**
3. **Name your stack**: `mercurio-api`
4. **Select "Web editor"** as the build method

### Step 3: Configure Stack

#### 3.1 Docker Compose Configuration

Copy the entire content from `portainer/docker-compose.yml` into the web editor.

**Important**: Update these values in the compose file:
- Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username
- Adjust network names to match your existing setup

#### 3.2 Environment Variables

Scroll down to the **"Environment variables"** section and add:

```bash
# Database
POSTGRES_PASSWORD=your_super_secure_postgres_password_here

# Encryption (generate with: openssl rand -base64 32)
ENCRYPTION_KEK_SECRET=NEW_SECURE_BASE64_SECRET_HERE
EMAIL_DEK_SECRET=NEW_SECURE_BASE64_SECRET_HERE
PHONE_DEK_SECRET=NEW_SECURE_BASE64_SECRET_HERE
EMAIL_FINGERPRINT_SECRET=NEW_SECURE_BASE64_SECRET_HERE
PHONE_FINGERPRINT_SECRET=NEW_SECURE_BASE64_SECRET_HERE
```

**CRITICAL**: Generate unique secrets for each variable using:
```bash
openssl rand -base64 32
```

### Step 4: Deploy Stack

1. **Click "Deploy the stack"**
2. **Wait for containers to start** (may take 2-3 minutes)
3. **Check container status** in Portainer

### Step 5: Post-Deployment Setup

#### 5.1 Run Database Migration

In Portainer, find the `mercurio-api-api-1` container and open a **Console**:

```bash
# Run database migrations
npm run prisma:deploy

# Seed initial data (creates test API keys)
npm run db:seed
```

#### 5.2 Verify Health

Test the API health check:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "mercurio-api",
  "version": "1.0.0"
}
```

### Step 6: N8N Integration (Optional)

If you have N8N running, connect it to the Mercurio network:

#### 6.1 Find N8N Container Name
```bash
docker ps | grep n8n
```

#### 6.2 Connect Networks
```bash
# Connect N8N to Mercurio network
docker network connect mercurio-api_mercurio_network your-n8n-container-name
```

#### 6.3 Test Connection from N8N
In N8N, you can now use these internal URLs:
- **API Endpoint**: `http://api:3000/v1/events/track`
- **Health Check**: `http://api:3000/health`

### Step 7: Create Production API Keys

1. **Open API container console** in Portainer
2. **Run provision script**:
   ```bash
   npm run provision:tenant
   ```
3. **Copy the generated API key** for production use

## 🔧 Stack Management

### Updating the API

1. **New image built automatically** via GitHub Actions when you push to main
2. **In Portainer**, go to Images and **pull latest**:
   - Image: `ghcr.io/username/mercurio-api:latest`
3. **Restart the stack** or **recreate containers**
4. **Run migrations** if database changes were made

### Viewing Logs

1. **In Portainer**, navigate to Containers
2. **Click on container name** (e.g., `mercurio-api-api-1`)
3. **Click "Logs"** tab
4. **Enable "Auto-refresh"** for real-time logs

### Database Access

1. **Find PostgreSQL container** in Portainer
2. **Open Console** with command: `/bin/bash`
3. **Access database**:
   ```bash
   psql -U mercurio_user -d mercurio
   ```

### Creating Backups

1. **Open PostgreSQL container console**
2. **Create backup**:
   ```bash
   pg_dump -U mercurio_user mercurio > /backups/backup_$(date +%Y%m%d).sql
   ```
3. **Backups are stored** in the `postgres_backups` volume

## 📊 Monitoring

### Health Checks

- **API Health**: Container health check runs every 30s
- **Database Health**: PostgreSQL health check runs every 30s
- **Overall Stack**: Monitor in Portainer dashboard

### Performance Metrics

Access these URLs from within the network:
- **Health**: `http://api:3000/health`
- **Metrics**: `http://api:3000/monitoring/metrics`

### Resource Usage

Monitor in Portainer:
- CPU usage
- Memory usage
- Network I/O
- Disk I/O

## 🚨 Troubleshooting

### API Container Won't Start

1. **Check logs** in Portainer
2. **Verify environment variables** are set correctly
3. **Check database connection**:
   ```bash
   # In API container console
   echo $DATABASE_URL
   ```

### Database Connection Issues

1. **Check PostgreSQL container** is healthy
2. **Verify network connectivity**:
   ```bash
   # In API container console
   ping postgres
   ```
3. **Check database credentials** in environment variables

### N8N Can't Reach API

1. **Verify networks are connected**:
   ```bash
   docker network inspect mercurio-api_mercurio_network
   ```
2. **Test from N8N container**:
   ```bash
   # In N8N console
   curl http://api:3000/health
   ```

### Performance Issues

1. **Check resource limits** in compose file
2. **Monitor memory usage** in Portainer
3. **Check database performance**:
   ```sql
   -- In PostgreSQL console
   SELECT * FROM pg_stat_activity;
   ```

## 🔒 Security Considerations

### Environment Variables
- ✅ **Never commit** real secrets to git
- ✅ **Generate unique secrets** for production
- ✅ **Rotate secrets** periodically

### Network Security
- ✅ **Internal network** - API not directly exposed
- ✅ **Database isolation** - Only accessible from API
- ✅ **N8N integration** - Secure internal communication

### Access Control
- ✅ **API key authentication** required for all endpoints
- ✅ **Rate limiting** active by default
- ✅ **PII encryption** for sensitive data

## 📞 Support

- **Portainer Issues**: Check Portainer logs and documentation
- **API Issues**: Check application logs in container
- **Database Issues**: Check PostgreSQL logs
- **GitHub Issues**: Report bugs in the repository

---

**Mercurio API successfully deployed with Portainer!** 🎉

Your analytics ingestion API is now ready to handle production traffic.
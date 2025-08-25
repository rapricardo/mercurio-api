# Quick Start Guide 🚀

Get the Mercurio API up and running in under 10 minutes.

## ⚡ Development Setup (Local)

### Prerequisites
```bash
node --version  # Should be 18+
npm --version   # Should be 8+
psql --version  # Should be 13+
```

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd mercurio-api
npm install
```

### 2. Setup Database
```bash
# Start PostgreSQL (if not running)
# macOS with Homebrew:
brew services start postgresql

# Create database
createdb mercurio

# Setup environment
cp .env.example .env
# Edit .env with your database URL
```

### 3. Initialize Database
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
# Server starts at http://localhost:3000
```

### 5. Test API
```bash
# Health check
curl http://localhost:3000/health

# Test event tracking (use API key from seed output)
curl -X POST http://localhost:3000/v1/events/track \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ak_YOUR_API_KEY_FROM_SEED" \
  -d '{"event_name":"test","anonymous_id":"a_test"}'
```

## 🐳 Production Setup (Docker)

### Quick Deploy with Docker Compose
```bash
# Copy production environment
cp .env.example .env.production
# Edit .env.production with production secrets

# Deploy
make deploy
# or
docker-compose -f docker-compose.prod.yml up -d
```

### Verify Production Deployment
```bash
# Check service status
make status

# Run health check
make health

# View logs
make logs-api
```

## 🔧 Configuration

### Environment Variables
```bash
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/mercurio"
ENCRYPTION_KEK_SECRET="base64-encoded-32-byte-key"
EMAIL_DEK_SECRET="base64-encoded-32-byte-key"
PHONE_DEK_SECRET="base64-encoded-32-byte-key"

# Optional  
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
REDIS_ENABLED=false
```

### Generate Production Secrets
```bash
# Generate secure encryption keys
openssl rand -base64 32  # Run for each secret

# Generate strong database password
openssl rand -base64 24
```

## 🧪 Testing

### Run All Tests
```bash
npm test                # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
npm run test:load       # Load tests
```

### Manual API Testing
```bash
# Get API key from seed output, then test:

# 1. Track an event
curl -X POST http://localhost:3000/v1/events/track \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "event_name": "page_view",
    "anonymous_id": "a_visitor_123",
    "page": {"url": "https://example.com"},
    "properties": {"test": true}
  }'

# 2. Identify a user  
curl -X POST http://localhost:3000/v1/events/identify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "anonymous_id": "a_visitor_123",
    "traits": {"email": "user@example.com"}
  }'

# 3. Batch events
curl -X POST http://localhost:3000/v1/events/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "events": [
      {"event_name": "page_view", "anonymous_id": "a_123"},
      {"event_name": "click", "anonymous_id": "a_123"}
    ]
  }'
```

## 📊 Database Inspection

### Using Prisma Studio
```bash
npm run prisma:studio
# Opens at http://localhost:5555
```

### Using SQL
```bash
# Connect to database
psql postgresql://user:password@localhost:5432/mercurio

# Check recent events
SELECT id, event_name, anonymous_id, timestamp 
FROM event 
ORDER BY timestamp DESC 
LIMIT 10;

# Check encrypted leads
SELECT id, email_fingerprint, phone_fingerprint 
FROM lead 
ORDER BY created_at DESC 
LIMIT 5;
```

## 🚨 Common Issues

### "Port 3000 already in use"
```bash
# Find process using port
lsof -i :3000

# Change port in .env
PORT=3001
```

### "Database connection failed"
```bash
# Check PostgreSQL is running
pg_isready

# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL
```

### "Prisma client not found"
```bash
# Regenerate Prisma client
npx prisma generate
```

### "Invalid API key"
```bash
# Check API key format (should start with ak_)
# Run seed again to get fresh API key
npm run db:seed
```

## 📈 Performance Tips

### Development
```bash
# Use ts-node-dev for faster restarts
npm run dev

# Skip type checking for faster compilation
npm run dev -- --transpile-only
```

### Production
```bash
# Build optimized version
npm run build

# Use production start
npm run start

# Monitor with PM2 (optional)
pm2 start dist/main.js --name mercurio-api
```

## 🔍 Monitoring

### Health Endpoints
```bash
curl http://localhost:3000/health
curl http://localhost:3000/monitoring/metrics
```

### Logs
```bash
# Development logs (console)
npm run dev

# Production logs (file)
tail -f logs/application.log
```

### Database Performance
```sql
-- Check active connections
SELECT * FROM pg_stat_activity WHERE datname = 'mercurio';

-- Check query performance  
SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

## 🔐 Security Checklist

### Development
- [ ] Use `.env` file (never commit)
- [ ] Generate unique API keys per workspace
- [ ] Use test encryption keys
- [ ] Enable request logging

### Production  
- [ ] Generate new encryption secrets
- [ ] Use strong database passwords
- [ ] Enable HTTPS/TLS
- [ ] Configure rate limiting
- [ ] Set up monitoring
- [ ] Regular security updates

## 📚 Next Steps

### For Development
1. **Explore API endpoints** in `src/events/controllers/`
2. **Add custom validation** in `src/events/dto/`
3. **Implement new features** following existing patterns
4. **Write tests** for new functionality

### For Production
1. **Deploy with Portainer** (see `portainer/PORTAINER_SETUP.md`)
2. **Configure monitoring** and alerts
3. **Set up backups** and disaster recovery
4. **Plan capacity** and scaling

### Integration
1. **Connect N8N** to internal API endpoint
2. **Configure client SDKs** to use your API
3. **Build dashboards** that consume the data
4. **Set up analytics** workflows

## 🆘 Getting Help

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check `README.md` and other guides
- **Logs**: Always check application logs first
- **Health Check**: Use `/health` endpoint to diagnose issues

---

**Ready to track some events!** 🎯
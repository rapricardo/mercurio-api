# Mercurio API 🚀

High-performance event ingestion API for analytics tracking with PII encryption, multi-tenant architecture, and real-time processing capabilities.

## 🎯 Overview

Mercurio API is a production-ready analytics ingestion service that handles:

- **Event Tracking**: Page views, user interactions, conversions
- **User Identification**: Link anonymous visitors to known users  
- **PII Encryption**: AES-256-GCM encryption for sensitive data
- **Multi-tenant**: Complete workspace isolation
- **High Performance**: Rate limiting, caching, and optimized queries
- **Production Ready**: Health checks, structured logging, metrics

## ✨ Features

### 🔐 Security & Privacy
- **PII Encryption**: Email/phone encrypted with AES-256-GCM
- **HMAC Fingerprints**: Privacy-preserving searchable hashes
- **API Key Authentication**: Secure tenant isolation
- **Rate Limiting**: Token bucket algorithm with configurable limits

### 📊 Analytics Features  
- **Event Ingestion**: Real-time event processing
- **User Identity**: Anonymous to known user linking
- **Session Tracking**: Automatic session management
- **UTM Parameters**: Complete campaign attribution
- **Device/Geo Enrichment**: Automatic context enrichment

### 🏗️ Architecture
- **Multi-tenant**: Complete workspace isolation
- **Scalable**: Horizontal scaling ready
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis support for rate limiting
- **Monitoring**: Health checks and metrics export

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- (Optional) Redis for rate limiting

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd mercurio-api

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database URL and secrets

# Setup database
npm run prisma:generate
npm run prisma:migrate
npm run db:seed

# Start development server
npm run dev
```

Server will start at `http://localhost:3000`

## 📋 API Endpoints

### Health Check
```bash
GET /health
```

### Track Events
```bash
POST /v1/events/track
Authorization: Bearer ak_your_api_key

{
  "event_name": "page_view",
  "anonymous_id": "a_visitor_123",
  "timestamp": "2025-08-25T15:30:00.000Z",
  "page": {
    "url": "https://example.com/page",
    "title": "Page Title"
  },
  "utm": {
    "source": "google",
    "medium": "cpc",
    "campaign": "summer_sale"
  },
  "properties": {
    "custom_data": "value"
  }
}
```

### Identify Users
```bash
POST /v1/events/identify
Authorization: Bearer ak_your_api_key

{
  "anonymous_id": "a_visitor_123",
  "user_id": "user_456",
  "traits": {
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Batch Events
```bash
POST /v1/events/batch
Authorization: Bearer ak_your_api_key

{
  "events": [
    { "event_name": "page_view", "anonymous_id": "a_123" },
    { "event_name": "button_click", "anonymous_id": "a_123" }
  ]
}
```

## 🐳 Docker Deployment

### Development
```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

### Production with Docker Compose
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec api npm run prisma:deploy

# Create API keys
docker-compose -f docker-compose.prod.yml exec api npm run db:seed
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection | Required |
| `ENCRYPTION_KEK_SECRET` | Master encryption key | Required |
| `EMAIL_DEK_SECRET` | Email encryption key | Required |
| `PHONE_DEK_SECRET` | Phone encryption key | Required |
| `REDIS_ENABLED` | Enable Redis rate limiting | `false` |
| `LOG_LEVEL` | Logging level | `info` |

### Generating Encryption Keys
```bash
# Generate secure secrets for production
openssl rand -base64 32  # For each encryption secret
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:cov

# Load testing
npm run test:load
```

## 📊 Database Schema

### Core Entities
- **Tenants**: Organization isolation
- **Workspaces**: Project isolation within tenants
- **API Keys**: Authentication and authorization
- **Visitors**: Anonymous user tracking
- **Leads**: Known user data (PII encrypted)
- **Events**: All tracked interactions
- **Sessions**: User session management

### Data Flow
```
Anonymous Visitor → Events → Identification → Lead Creation → Event Attribution
```

## 🔍 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Metrics (if enabled)
```bash
curl http://localhost:3000/monitoring/metrics
```

### Logs
Structured JSON logs with request correlation IDs:
```json
{
  "level": "info",
  "timestamp": "2025-08-25T15:30:00.000Z",
  "requestId": "req-123",
  "message": "Event processed successfully",
  "eventId": "456"
}
```

## 🚨 Security Considerations

### PII Encryption
- All email/phone data encrypted with AES-256-GCM
- Separate Data Encryption Keys (DEK) for each field type
- HMAC fingerprints enable privacy-preserving searches
- Key rotation supported via `ENCRYPTION_KEY_VERSION`

### Rate Limiting
- Token bucket algorithm per tenant
- Configurable limits: 1000 req/min (free), 10000 req/min (premium)
- Redis-backed for distributed rate limiting
- In-memory fallback if Redis unavailable

### API Security
- API key authentication with HMAC validation
- Scoped permissions (read, write, events:read, events:write)
- Request correlation IDs for tracing
- Input validation with class-validator

## 📚 Development

### Project Structure
```
src/
├── common/           # Shared modules
│   ├── auth/        # API key authentication
│   ├── guards/      # Rate limiting
│   └── services/    # Encryption, caching, metrics
├── events/          # Event ingestion
│   ├── controllers/ # REST endpoints
│   ├── services/    # Business logic
│   └── dto/         # Request/response schemas
└── monitoring/      # Health checks, metrics
```

### Contributing
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under UNLICENSED - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [API Documentation](docs/api/)
- **Issues**: [GitHub Issues](https://github.com/your-username/mercurio-api/issues)
- **Email**: support@mercurio.com

---

**Built with ❤️ by the Mercurio Team**
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

### Analytics Endpoints

**Overview Metrics**
```bash
GET /v1/analytics/overview?period=7d&timezone=UTC
Authorization: Bearer ak_your_api_key

# Response
{
  "period": {
    "start": "2025-08-19T00:00:00.000Z",
    "end": "2025-08-26T00:00:00.000Z", 
    "timezone": "UTC"
  },
  "metrics": {
    "total_events": 15420,
    "unique_visitors": 2841,
    "total_sessions": 3105,
    "conversion_rate": 4.2,
    "bounce_rate": 32.1,
    "avg_session_duration": 245.3
  },
  "comparisons": {
    "total_events": {
      "value": 15420,
      "change_pct": 12.4,
      "direction": "up"
    }
  }
}
```

**Time Series Data**
```bash
GET /v1/analytics/timeseries?period=7d&granularity=day&metrics=events,visitors
Authorization: Bearer ak_your_api_key

# Response
{
  "period": { "start": "...", "end": "..." },
  "data": [
    {
      "timestamp": "2025-08-19T00:00:00.000Z",
      "events": 2104,
      "visitors": 421
    },
    {
      "timestamp": "2025-08-20T00:00:00.000Z", 
      "events": 2340,
      "visitors": 485
    }
  ]
}
```

**Top Events**
```bash
GET /v1/analytics/events/top?period=7d&limit=10
Authorization: Bearer ak_your_api_key

# Response
{
  "total_events": 15420,
  "events": [
    {
      "rank": 1,
      "event_name": "page_view",
      "count": 8234,
      "percentage": 53.4,
      "unique_visitors": 1842,
      "trend": { "change_pct": 8.2, "direction": "up" }
    }
  ]
}
```

**User Analytics** 
```bash
GET /v1/analytics/users?period=7d&segment=all
Authorization: Bearer ak_your_api_key

# Response
{
  "summary": {
    "total_visitors": 2841,
    "identified_leads": 119,
    "identification_rate": 4.2,
    "returning_visitors": 634,
    "new_visitors": 2207
  },
  "activity_levels": [
    {
      "level": "high_activity",
      "description": "10+ events per session",
      "visitors": 142,
      "percentage": 5.0
    }
  ],
  "conversion_funnel": {
    "visitors": 2841,
    "sessions_created": 3105,
    "leads_identified": 119
  }
}
```

**Event Details (Paginated)**
```bash
GET /v1/analytics/events/details?period=24h&page=1&limit=50&sort_by=timestamp
Authorization: Bearer ak_your_api_key

# Response
{
  "pagination": {
    "page": 1,
    "limit": 50,
    "total_count": 1543,
    "total_pages": 31,
    "has_next_page": true
  },
  "events": [
    {
      "event_id": "evt_12345",
      "event_name": "page_view",
      "timestamp": "2025-08-26T10:30:00.000Z",
      "anonymous_id": "a_visitor_123",
      "session_id": "s_session_456",
      "page": { "url": "/dashboard", "title": "Dashboard" },
      "utm": { "source": "google" },
      "device": { "type": "desktop" },
      "geo": { "country": "US" }
    }
  ]
}
```

**Data Export**
```bash
# Request export
GET /v1/analytics/export?period=30d&dataset=events&format=csv
Authorization: Bearer ak_your_api_key

# Response
{
  "export_id": "exp_1724634000_abc123",
  "status": "processing",
  "created_at": "2025-08-26T10:30:00.000Z",
  "expires_at": "2025-08-27T10:30:00.000Z",
  "format": "csv"
}

# Check export status
GET /v1/analytics/exports/exp_1724634000_abc123
Authorization: Bearer ak_your_api_key

# Response
{
  "export_id": "exp_1724634000_abc123", 
  "status": "completed",
  "download_url": "/v1/analytics/exports/exp_1724634000_abc123/download",
  "created_at": "2025-08-26T10:30:00.000Z",
  "expires_at": "2025-08-27T10:30:00.000Z"
}
```

**Query Parameters:**
- `period`: `24h`, `7d`, `30d`, or `custom` (requires `start_date` & `end_date`)
- `timezone`: Any valid timezone (default: `UTC`)
- `granularity`: `hour`, `day`, `week` (for timeseries)
- `metrics`: Array of `events`, `visitors`, `sessions`, `conversions`
- `limit`: Number of results (max varies by endpoint)
- `page`: Page number for pagination
- `sort_by`: `timestamp`, `event_name` (for event details)
- `sort_order`: `asc`, `desc`

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

## 📚 Documentation

### **For Developers**
- **[Frontend Integration Guide](docs/frontend-integration-guide.md)** - Complete integration guide for frontend developers
- **[Complete API Reference](docs/api-endpoints-complete.md)** - All endpoints with examples and responses
- **[Features Documentation](docs/features/)** - Feature-by-feature specifications

### **Key Features**
- **[User Onboarding](docs/features/onboarding/)** - First-time user setup and workspace creation
- **[Event Tracking](docs/features/ingestion/)** - Real-time analytics event ingestion
- **[Identity Management](docs/features/identity/)** - User identification and linking
- **[Multi-tenant Architecture](docs/features/workspaces/)** - Workspace and tenant management

### **Development**

#### Project Structure
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

#### Contributing
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under UNLICENSED - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **[Complete Documentation](docs/)** - Technical documentation and feature specs
- **[Frontend Integration](docs/frontend-integration-guide.md)** - Integration guide for frontend teams
- **[API Reference](docs/api-endpoints-complete.md)** - Complete API documentation
- **Issues**: [GitHub Issues](https://github.com/your-username/mercurio-api/issues)

---

**Built with ❤️ by the Mercurio Team**
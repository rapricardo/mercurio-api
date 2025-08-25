# Event Ingestion API Documentation

## Overview

The Mercurio Event Ingestion API provides real-time event tracking capabilities with deduplication, tenant isolation, and comprehensive validation. This API is designed for high-volume event ingestion with operational reliability features.

## Base URL

```
# Development
http://localhost:3000

# Production
https://api.mercurio.com
```

## Authentication

All API endpoints require authentication via API key. The API key can be provided in multiple ways:

### 1. Authorization Header (Recommended)
```http
Authorization: Bearer ak_live_your_api_key_here
```

### 2. X-API-Key Header
```http
X-API-Key: ak_live_your_api_key_here
```

### 3. Query Parameter (Events endpoints only)
```http
POST /v1/events/track?auth=ak_live_your_api_key_here
```
*Note: Query parameter authentication is only supported for events endpoints to enable sendBeacon compatibility.*

## Headers

### Required Headers
- `Content-Type: application/json`
- `Authorization: Bearer {api_key}` (or alternative auth method)

### Optional Headers
- `X-Event-Schema-Version: 1.0.0` - Schema version for event validation
- `X-Request-ID: {request_id}` - Client-provided request correlation ID

## Limits and Constraints

| Limit | Value | Description |
|-------|-------|-------------|
| Max Payload Size | 256KB | Total request body size |
| Max Batch Size | 50 events | Maximum events per batch request |
| Timestamp Window | ±5 minutes | Events outside this window are rejected |
| Event ID Length | 1-100 chars | Client-provided deduplication ID |

## Endpoints

### 1. Track Event

Track a single user event with optional deduplication.

#### Endpoint
```http
POST /v1/events/track
```

#### Request Body
```json
{
  "event_name": "page_view",
  "anonymous_id": "a_123456",
  "timestamp": "2025-08-24T22:30:00.000Z",
  "event_id": "evt_page_view_1234567890",
  "page": {
    "url": "https://example.com/product/123",
    "title": "Product Page - Amazing Widget",
    "path": "/product/123",
    "referrer": "https://google.com"
  },
  "utm": {
    "source": "google",
    "medium": "cpc",
    "campaign": "summer_sale",
    "term": "widget",
    "content": "ad_variant_a"
  },
  "properties": {
    "product_id": "123",
    "product_name": "Amazing Widget",
    "price": 29.99,
    "category": "widgets"
  }
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_name` | string | ✅ | Name of the event (e.g., "page_view", "button_click") |
| `anonymous_id` | string | ✅ | Anonymous user identifier |
| `timestamp` | string | ✅ | ISO 8601 timestamp of when the event occurred |
| `event_id` | string | ❌ | Client-provided ID for deduplication (1-100 chars) |
| `page` | object | ❌ | Page context information |
| `page.url` | string | ❌ | Full URL where event occurred |
| `page.title` | string | ❌ | Page title |
| `page.path` | string | ❌ | URL path (auto-extracted if not provided) |
| `page.referrer` | string | ❌ | Referring page URL |
| `utm` | object | ❌ | UTM tracking parameters |
| `utm.source` | string | ❌ | Traffic source |
| `utm.medium` | string | ❌ | Traffic medium |
| `utm.campaign` | string | ❌ | Campaign identifier |
| `utm.term` | string | ❌ | Search term |
| `utm.content` | string | ❌ | Ad content identifier |
| `properties` | object | ❌ | Custom event properties |

#### Success Response (200 OK)
```json
{
  "accepted": true,
  "event_id": "1234567890",
  "is_duplicate": false
}
```

#### Duplicate Response (200 OK)
```json
{
  "accepted": true,
  "event_id": "1234567890",
  "is_duplicate": true
}
```

#### Example cURL
```bash
curl -X POST https://api.mercurio.com/v1/events/track \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ak_live_your_api_key_here" \
  -H "X-Event-Schema-Version: 1.0.0" \
  -d '{
    "event_name": "page_view",
    "anonymous_id": "a_123456",
    "timestamp": "2025-08-24T22:30:00.000Z",
    "event_id": "evt_unique_123",
    "page": {
      "url": "https://example.com/product/123",
      "title": "Product Page"
    },
    "properties": {
      "product_id": "123"
    }
  }'
```

---

### 2. Batch Events

Track multiple events in a single request for improved performance.

#### Endpoint
```http
POST /v1/events/batch
```

#### Request Body
```json
{
  "events": [
    {
      "event_name": "page_view",
      "anonymous_id": "a_123456",
      "timestamp": "2025-08-24T22:30:00.000Z",
      "event_id": "evt_page_view_1",
      "page": {
        "url": "https://example.com/home",
        "title": "Home Page"
      }
    },
    {
      "event_name": "button_click",
      "anonymous_id": "a_123456",
      "timestamp": "2025-08-24T22:30:30.000Z",
      "event_id": "evt_button_click_1",
      "properties": {
        "button_text": "Get Started",
        "location": "hero_section"
      }
    }
  ]
}
```

#### Success Response (200 OK)
```json
{
  "accepted": 2,
  "rejected": 0,
  "total": 2,
  "results": [
    {
      "accepted": true,
      "event_id": "1234567890",
      "is_duplicate": false
    },
    {
      "accepted": true,
      "event_id": "1234567891",
      "is_duplicate": false
    }
  ]
}
```

#### Partial Success Response (200 OK)
```json
{
  "accepted": 1,
  "rejected": 1,
  "total": 2,
  "results": [
    {
      "accepted": true,
      "event_id": "1234567890",
      "is_duplicate": false
    },
    {
      "accepted": false,
      "errors": [
        {
          "field": "timestamp",
          "message": "Event timestamp is too far in the past (max 5 minutes)",
          "value": "2025-08-24T21:00:00.000Z"
        }
      ]
    }
  ]
}
```

#### Example cURL
```bash
curl -X POST https://api.mercurio.com/v1/events/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ak_live_your_api_key_here" \
  -d '{
    "events": [
      {
        "event_name": "page_view",
        "anonymous_id": "a_123456",
        "timestamp": "2025-08-24T22:30:00.000Z"
      },
      {
        "event_name": "button_click",
        "anonymous_id": "a_123456",
        "timestamp": "2025-08-24T22:30:30.000Z"
      }
    ]
  }'
```

---

### 3. Identify User

Link an anonymous user to known identity information.

#### Endpoint
```http
POST /v1/events/identify
```

#### Request Body
```json
{
  "anonymous_id": "a_123456",
  "user_id": "user_789",
  "timestamp": "2025-08-24T22:30:00.000Z",
  "traits": {
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "premium",
    "company": "Acme Corp"
  }
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `anonymous_id` | string | ✅ | Anonymous user identifier to link |
| `user_id` | string | ❌* | Known user identifier |
| `timestamp` | string | ❌ | ISO 8601 timestamp (defaults to server time) |
| `traits` | object | ❌* | User traits and attributes |
| `traits.email` | string | ❌ | User email address (validated format) |

*Note: Either `user_id` or `traits` must be provided.*

#### Success Response (200 OK)
```json
{
  "accepted": true,
  "lead_id": "9876543210"
}
```

#### Example cURL
```bash
curl -X POST https://api.mercurio.com/v1/events/identify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ak_live_your_api_key_here" \
  -d '{
    "anonymous_id": "a_123456",
    "traits": {
      "email": "user@example.com",
      "name": "John Doe"
    }
  }'
```

---

### 4. Health Check

Check API and dependency health status.

#### Endpoint
```http
GET /health
```

#### Success Response (200 OK)
```json
{
  "status": "healthy",
  "service": "mercurio-api",
  "version": "1.0.0",
  "timestamp": "2025-08-24T22:30:00.000Z",
  "uptime": 3600,
  "responseTimeMs": 15,
  "checks": {
    "database": {
      "name": "database",
      "status": "healthy",
      "responseTimeMs": 12
    },
    "memory": {
      "name": "memory", 
      "status": "healthy",
      "responseTimeMs": 1
    }
  },
  "metadata": {
    "nodeVersion": "v18.17.0",
    "environment": "production",
    "pid": 1234
  }
}
```

#### Degraded Response (200 OK)
```json
{
  "status": "degraded",
  "service": "mercurio-api",
  "version": "1.0.0",
  "timestamp": "2025-08-24T22:30:00.000Z",
  "uptime": 3600,
  "responseTimeMs": 150,
  "checks": {
    "database": {
      "name": "database",
      "status": "degraded",
      "responseTimeMs": 1200
    },
    "memory": {
      "name": "memory",
      "status": "healthy", 
      "responseTimeMs": 1
    }
  }
}
```

#### Unhealthy Response (503 Service Unavailable)
```json
{
  "status": "unhealthy",
  "service": "mercurio-api", 
  "version": "1.0.0",
  "timestamp": "2025-08-24T22:30:00.000Z",
  "uptime": 3600,
  "responseTimeMs": 5000,
  "checks": {
    "database": {
      "name": "database",
      "status": "unhealthy",
      "responseTimeMs": 5000,
      "error": "Connection timeout"
    },
    "memory": {
      "name": "memory",
      "status": "healthy",
      "responseTimeMs": 1
    }
  }
}
```

## Error Responses

### Error Response Format
```json
{
  "error": {
    "code": "error_code",
    "message": "Human readable error description", 
    "details": {
      "field": "additional_context"
    }
  }
}
```

### Common Error Codes

#### Authentication Errors

**401 Unauthorized - Missing API Key**
```json
{
  "error": {
    "code": "unauthorized",
    "message": "Missing API key. Provide via Authorization header (Bearer <key>), x-api-key header, or auth query parameter for events endpoints."
  }
}
```

**401 Unauthorized - Invalid API Key**
```json
{
  "error": {
    "code": "unauthorized", 
    "message": "Invalid or revoked API key"
  }
}
```

**403 Forbidden - Insufficient Scope**
```json
{
  "error": {
    "code": "insufficient_scope",
    "message": "API key requires one of the following scopes: write, events:write",
    "details": {
      "requiredScopes": ["write", "events:write"],
      "availableScopes": ["read"]
    }
  }
}
```

#### Validation Errors

**400 Bad Request - Payload Too Large**
```json
{
  "error": {
    "code": "payload_too_large",
    "message": "Request payload exceeds maximum size of 262144 bytes",
    "details": {
      "payloadSize": 300000,
      "maxSize": 262144
    }
  }
}
```

**400 Bad Request - Batch Too Large**
```json
{
  "error": {
    "code": "batch_too_large", 
    "message": "Batch contains 100 events, maximum allowed is 50",
    "details": {
      "batchSize": 100,
      "maxBatchSize": 50
    }
  }
}
```

**400 Bad Request - Invalid Timestamp**
```json
{
  "error": {
    "code": "invalid_timestamp",
    "message": "Event timestamp is too far in the past (max 5 minutes)",
    "details": {
      "timestamp": "2025-08-24T21:00:00.000Z"
    }
  }
}
```

**400 Bad Request - Invalid Email** 
```json
{
  "error": {
    "code": "invalid_email",
    "message": "Invalid email format in traits",
    "details": {
      "email": "not-an-email"
    }
  }
}
```

**400 Bad Request - Missing Identification**
```json
{
  "error": {
    "code": "missing_identification",
    "message": "Either user_id or traits must be provided for identification"
  }
}
```

**400 Bad Request - Processing Failed**
```json
{
  "error": {
    "code": "processing_failed",
    "message": "Failed to process event",
    "details": {
      "errors": [
        {
          "field": "anonymous_id",
          "message": "Invalid anonymous_id format",
          "value": "invalid-id"
        }
      ]
    }
  }
}
```

#### Rate Limiting Errors

**429 Too Many Requests**
```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "API rate limit exceeded",
    "details": {
      "limit": 1000,
      "window": 3600,
      "retry_after": 300
    }
  }
}
```

#### Server Errors

**500 Internal Server Error**
```json
{
  "error": {
    "code": "internal_server_error",
    "message": "An unexpected error occurred"
  }
}
```

**503 Service Unavailable**
```json
{
  "error": {
    "code": "service_unavailable", 
    "message": "Service temporarily unavailable"
  }
}
```

## Features

### Deduplication

Events can be deduplicated using the optional `event_id` field. If the same `event_id` is sent multiple times for the same tenant, only the first occurrence will be processed. Subsequent requests will return a successful response with `is_duplicate: true`.

**Benefits:**
- Prevents double-counting due to retries
- Ensures idempotent API behavior
- Maintains data integrity

**Example:**
```bash
# First request
curl -X POST https://api.mercurio.com/v1/events/track \
  -H "Authorization: Bearer ak_live_key" \
  -d '{"event_name": "purchase", "anonymous_id": "a_123", "event_id": "purchase_123", "timestamp": "2025-08-24T22:30:00Z"}'

# Response: {"accepted": true, "event_id": "1001", "is_duplicate": false}

# Duplicate request (same event_id)
curl -X POST https://api.mercurio.com/v1/events/track \
  -H "Authorization: Bearer ak_live_key" \
  -d '{"event_name": "purchase", "anonymous_id": "a_123", "event_id": "purchase_123", "timestamp": "2025-08-24T22:30:00Z"}'

# Response: {"accepted": true, "event_id": "1001", "is_duplicate": true}
```

### Schema Versioning

Use the `X-Event-Schema-Version` header to specify the schema version for event validation. If not provided, defaults to version `1.0`.

```http
X-Event-Schema-Version: 1.2.0
```

Invalid schema versions will fall back to the default with a warning logged.

### Request Correlation

Each request receives a unique correlation ID for tracing. You can:
- Provide your own via `X-Request-ID` header
- Use the server-generated ID from the `X-Request-ID` response header

This ID appears in all server logs for request tracing.

### sendBeacon Compatibility

For browser `sendBeacon` API compatibility, events endpoints support authentication via query parameter:

```javascript
// JavaScript sendBeacon example
navigator.sendBeacon(
  'https://api.mercurio.com/v1/events/track?auth=ak_live_your_key',
  JSON.stringify({
    event_name: 'page_unload',
    anonymous_id: 'a_123456',
    timestamp: new Date().toISOString()
  })
);
```

## Best Practices

### 1. Use Deduplication
Always provide `event_id` for critical events to prevent duplicates:
```json
{
  "event_name": "purchase_completed",
  "event_id": "purchase_" + orderId + "_" + timestamp,
  "anonymous_id": "a_123456"
}
```

### 2. Batch When Possible
Use batch endpoints for multiple events to reduce network overhead:
```json
{
  "events": [
    {"event_name": "page_view", "anonymous_id": "a_123"},
    {"event_name": "button_click", "anonymous_id": "a_123"}
  ]
}
```

### 3. Handle Errors Gracefully
Check response status and implement retry logic:
```javascript
const response = await fetch('/v1/events/track', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  },
  body: JSON.stringify(eventData)
});

if (response.ok) {
  const result = await response.json();
  console.log('Event tracked:', result.event_id);
} else {
  const error = await response.json();
  console.error('Tracking failed:', error.error.message);
}
```

### 4. Use Appropriate Timestamps
Send events with accurate timestamps within the 5-minute window:
```json
{
  "event_name": "button_click",
  "timestamp": new Date().toISOString(), // Current time
  "anonymous_id": "a_123456"
}
```

### 5. Structure Properties Consistently
Use consistent naming and types for event properties:
```json
{
  "properties": {
    "product_id": "12345",        // string
    "price": 29.99,              // number  
    "quantity": 2,               // number
    "category": "electronics",    // string
    "is_sale": true              // boolean
  }
}
```

## Integration Examples

### JavaScript/Browser
```javascript
class MercurioTracker {
  constructor(apiKey, baseUrl = 'https://api.mercurio.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.anonymousId = this.getOrCreateAnonymousId();
  }

  async track(eventName, properties = {}) {
    const eventData = {
      event_name: eventName,
      anonymous_id: this.anonymousId,
      timestamp: new Date().toISOString(),
      event_id: `${eventName}_${Date.now()}_${Math.random().toString(36)}`,
      page: {
        url: window.location.href,
        title: document.title,
        path: window.location.pathname,
        referrer: document.referrer
      },
      properties
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/events/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Event-Schema-Version': '1.0.0'
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('Event tracked:', result);
      return result;
    } catch (error) {
      console.error('Failed to track event:', error);
      throw error;
    }
  }

  getOrCreateAnonymousId() {
    let id = localStorage.getItem('mercurio_anonymous_id');
    if (!id) {
      id = 'a_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('mercurio_anonymous_id', id);
    }
    return id;
  }
}

// Usage
const tracker = new MercurioTracker('ak_live_your_api_key_here');
tracker.track('page_view');
tracker.track('button_click', { button_text: 'Get Started' });
```

### Node.js/Server
```javascript
const axios = require('axios');

class MercurioServerTracker {
  constructor(apiKey, baseUrl = 'https://api.mercurio.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Event-Schema-Version': '1.0.0'
      },
      timeout: 5000
    });
  }

  async track(eventName, anonymousId, properties = {}) {
    const eventData = {
      event_name: eventName,
      anonymous_id: anonymousId,
      timestamp: new Date().toISOString(),
      event_id: `${eventName}_${anonymousId}_${Date.now()}`,
      properties
    };

    try {
      const response = await this.client.post('/v1/events/track', eventData);
      return response.data;
    } catch (error) {
      console.error('Failed to track event:', error.response?.data || error.message);
      throw error;
    }
  }

  async identify(anonymousId, userId, traits = {}) {
    const identifyData = {
      anonymous_id: anonymousId,
      user_id: userId,
      timestamp: new Date().toISOString(),
      traits
    };

    try {
      const response = await this.client.post('/v1/events/identify', identifyData);
      return response.data;
    } catch (error) {
      console.error('Failed to identify user:', error.response?.data || error.message);
      throw error;
    }
  }

  async batchTrack(events) {
    const batchData = {
      events: events.map(event => ({
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
        event_id: event.event_id || `${event.event_name}_${event.anonymous_id}_${Date.now()}`
      }))
    };

    try {
      const response = await this.client.post('/v1/events/batch', batchData);
      return response.data;
    } catch (error) {
      console.error('Failed to track batch events:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Usage
const tracker = new MercurioServerTracker('ak_live_your_api_key_here');

// Track single event
await tracker.track('purchase_completed', 'a_123456', {
  order_id: 'order_789',
  total: 99.99
});

// Identify user
await tracker.identify('a_123456', 'user_789', {
  email: 'user@example.com',
  name: 'John Doe'
});

// Batch track events
await tracker.batchTrack([
  { event_name: 'page_view', anonymous_id: 'a_123456' },
  { event_name: 'button_click', anonymous_id: 'a_123456', properties: { button: 'cta' } }
]);
```

## Support

For API support and questions:
- Documentation: https://docs.mercurio.com
- Issues: https://github.com/mercurio/api/issues
- Email: support@mercurio.com

## Changelog

### Version 1.0.0 (Sprint 1)
- Initial release with track, batch, and identify endpoints
- Event deduplication with `event_id`
- Schema versioning support
- Comprehensive health checks
- Rate limiting and payload validation
- sendBeacon compatibility
- Structured error responses
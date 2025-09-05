# Mercurio API - Complete Endpoints Reference

Comprehensive documentation of all available API endpoints with examples and responses.

## 🔐 Authentication

All endpoints require authentication via:
- **JWT Token**: `Authorization: Bearer <jwt_token>` (User operations)
- **API Key**: `Authorization: Bearer <api_key>` (Event tracking)

---

## 🏥 Health & Monitoring

### **GET /health**
Basic health check endpoint.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-09-04T21:00:00.000Z"
}
```

### **GET /monitoring/metrics**
Get application metrics.

```http
GET /monitoring/metrics
```

**Response:**
```json
{
  "requests_total": 1250,
  "requests_per_minute": 45,
  "response_time_avg": 120,
  "database_connections": 5,
  "memory_usage": "256MB"
}
```

### **GET /monitoring/metrics/prometheus**
Get metrics in Prometheus format.

```http
GET /monitoring/metrics/prometheus
```

**Response:** Prometheus-formatted metrics

---

## 🔐 Authentication & User Management

### **GET /v1/auth/users/me**
Get current authenticated user information.

**Auth:** JWT Token required

```http
GET /v1/auth/users/me
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "authType": "supabase_jwt",
  "user": {
    "id": "fd897a33-23c3-44ef-87a0-2184107f0157",
    "email": "user@example.com",
    "role": "admin"
  },
  "currentWorkspace": {
    "tenantId": "123",
    "workspaceId": "456"
  },
  "workspaceAccess": [
    {
      "tenantId": "123",
      "workspaceId": "456",
      "role": "admin"
    }
  ],
  "scopes": ["read", "write", "admin"]
}
```

### **GET /v1/auth/users/me/status** ⭐ NEW
Get user onboarding status and workspace information.

**Auth:** JWT Token required

```http
GET /v1/auth/users/me/status
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "needsOnboarding": false,
  "hasWorkspaces": true,
  "workspaceCount": 2,
  "authStatus": "authenticated",
  "primaryWorkspace": {
    "tenantId": "123",
    "workspaceId": "456",
    "tenantName": "Heat",
    "workspaceName": "RSMKT",
    "role": "admin",
    "grantedAt": "2025-09-04T21:00:00.000Z"
  },
  "user": {
    "id": "fd897a33-23c3-44ef-87a0-2184107f0157",
    "email": "user@example.com",
    "name": "John Doe",
    "lastLoginAt": "2025-09-04T21:00:00.000Z"
  }
}
```

### **GET /v1/auth/users/me/workspaces**
Get all workspaces accessible by the current user.

**Auth:** JWT Token required

```http
GET /v1/auth/users/me/workspaces
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "workspaces": [
    {
      "tenantId": "123",
      "workspaceId": "456",
      "tenantName": "Heat",
      "workspaceName": "RSMKT",
      "role": "admin",
      "grantedAt": "2025-09-04T21:00:00.000Z"
    },
    {
      "tenantId": "124",
      "workspaceId": "457", 
      "tenantName": "CoolCorp",
      "workspaceName": "Marketing",
      "role": "editor",
      "grantedAt": "2025-09-03T15:30:00.000Z"
    }
  ],
  "total": 2
}
```

### **GET /v1/auth/users/workspace/:workspaceId/users**
Get all users in a specific workspace (Admin only).

**Auth:** JWT Token required (Admin role)

```http
GET /v1/auth/users/workspace/456/users?limit=50&offset=0
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "users": [
    {
      "id": "fd897a33-23c3-44ef-87a0-2184107f0157",
      "email": "admin@example.com",
      "name": "John Doe",
      "role": "admin",
      "grantedAt": "2025-09-04T21:00:00.000Z",
      "lastLoginAt": "2025-09-04T21:00:00.000Z"
    },
    {
      "id": "user-id-2",
      "email": "editor@example.com",
      "name": "Jane Smith",
      "role": "editor",
      "grantedAt": "2025-09-03T15:30:00.000Z"
    }
  ],
  "total": 2
}
```

### **POST /v1/auth/users/workspace/:workspaceId/users**
Grant workspace access to a user (Admin only).

**Auth:** JWT Token required (Admin role)

```http
POST /v1/auth/users/workspace/456/users
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "userId": "user-id-to-grant",
  "role": "editor"
}
```

**Response:**
```json
{
  "message": "Workspace access granted successfully",
  "userId": "user-id-to-grant",
  "workspaceId": "456",
  "role": "editor"
}
```

---

## 🚀 Onboarding

### **GET /v1/onboarding/eligibility** ⭐ NEW
Check if user is eligible for onboarding.

**Auth:** JWT Token required

```http
GET /v1/onboarding/eligibility
Authorization: Bearer <jwt_token>
```

**Response (Eligible):**
```json
{
  "eligible": true,
  "reason": "User has no workspace access and can proceed with onboarding",
  "nextAction": "onboard",
  "context": {
    "existingWorkspaceCount": 0
  }
}
```

**Response (Not Eligible):**
```json
{
  "eligible": false,
  "reason": "User already has workspace access",
  "nextAction": "dashboard",
  "context": {
    "canCreateAdditionalWorkspace": true
  }
}
```

### **POST /v1/onboarding**
Create tenant and workspace for new user.

**Auth:** JWT Token required

```http
POST /v1/onboarding
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "tenantName": "Heat",
  "workspaceName": "RSMKT"
}
```

**Response:**
```json
{
  "tenant": {
    "id": "123",
    "name": "Heat",
    "status": "active",
    "createdAt": "2025-09-04T21:00:00.000Z"
  },
  "workspace": {
    "id": "456",
    "tenantId": "123",
    "name": "RSMKT",
    "createdAt": "2025-09-04T21:00:00.000Z"
  },
  "userAccess": {
    "tenantId": "123",
    "workspaceId": "456",
    "role": "admin",
    "grantedAt": "2025-09-04T21:00:00.000Z"
  },
  "message": "Successfully created tenant \"Heat\" with workspace \"RSMKT\" and granted admin access"
}
```

**Error Response (409 - Already Has Access):**
```json
{
  "statusCode": 409,
  "message": "You already have access to a workspace and don't need to complete onboarding again. Please go to your dashboard to access your existing workspace(s). If you need to create additional workspaces, please contact support.",
  "error": "Conflict"
}
```

---

## 📊 Event Ingestion

### **POST /v1/events/track**
Track a single event.

**Auth:** API Key required

```http
POST /v1/events/track
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "eventName": "page_view",
  "anonymousId": "a_abc123def456",
  "sessionId": "s_session123",
  "timestamp": "2025-09-04T21:00:00.000Z",
  "page": {
    "url": "https://example.com/dashboard",
    "title": "Dashboard - My App",
    "referrer": "https://google.com"
  },
  "utm": {
    "source": "google",
    "medium": "cpc",
    "campaign": "summer_sale"
  },
  "device": {
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "screen": "1920x1080",
    "viewport": "1440x900"
  },
  "geo": {
    "country": "BR",
    "city": "São Paulo"
  },
  "props": {
    "button_text": "Get Started",
    "experiment_variant": "A"
  }
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "evt_abc123",
  "message": "Event tracked successfully"
}
```

### **POST /v1/events/batch**
Track multiple events in a single request.

**Auth:** API Key required

```http
POST /v1/events/batch
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "events": [
    {
      "eventName": "page_view",
      "anonymousId": "a_abc123def456",
      "timestamp": "2025-09-04T21:00:00.000Z",
      "page": {
        "url": "https://example.com/home",
        "title": "Home"
      }
    },
    {
      "eventName": "button_click",
      "anonymousId": "a_abc123def456",
      "timestamp": "2025-09-04T21:01:00.000Z",
      "props": {
        "button_text": "Sign Up"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "processed": 2,
  "failed": 0,
  "message": "Batch processed successfully"
}
```

### **POST /v1/events/identify**
Identify an anonymous user with their traits.

**Auth:** API Key required

```http
POST /v1/events/identify
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "anonymousId": "a_abc123def456",
  "traits": {
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+5511999999999",
    "plan": "premium"
  },
  "timestamp": "2025-09-04T21:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "leadId": "ld_xyz789",
  "message": "User identified successfully"
}
```

---

## 📈 Analytics

### **GET /v1/analytics/overview**
Get analytics overview for a date range.

**Auth:** JWT Token required

```http
GET /v1/analytics/overview?startDate=2025-09-01&endDate=2025-09-04&workspaceId=456
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "totalEvents": 12450,
  "uniqueUsers": 3240,
  "sessions": 4680,
  "avgSessionDuration": 185,
  "topEvents": [
    {
      "name": "page_view",
      "count": 5240
    },
    {
      "name": "button_click", 
      "count": 2890
    }
  ],
  "growth": {
    "events": 12.5,
    "users": 8.3,
    "sessions": 15.2
  }
}
```

### **GET /v1/analytics/timeseries**
Get time series data for events.

**Auth:** JWT Token required

```http
GET /v1/analytics/timeseries?startDate=2025-09-01&endDate=2025-09-04&interval=day&workspaceId=456
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "timeline": [
    {
      "date": "2025-09-01",
      "events": 3120,
      "users": 890,
      "sessions": 1240
    },
    {
      "date": "2025-09-02",
      "events": 3450,
      "users": 920,
      "sessions": 1320
    }
  ],
  "total": {
    "events": 12450,
    "users": 3240,
    "sessions": 4680
  }
}
```

### **GET /v1/analytics/events/top**
Get top events by volume.

**Auth:** JWT Token required

```http
GET /v1/analytics/events/top?startDate=2025-09-01&endDate=2025-09-04&limit=10&workspaceId=456
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "events": [
    {
      "name": "page_view",
      "count": 5240,
      "uniqueUsers": 2140,
      "percentage": 42.1
    },
    {
      "name": "button_click",
      "count": 2890,
      "uniqueUsers": 1450,
      "percentage": 23.2
    }
  ],
  "total": 12450
}
```

### **GET /v1/analytics/users**
Get user analytics data.

**Auth:** JWT Token required

```http
GET /v1/analytics/users?startDate=2025-09-01&endDate=2025-09-04&workspaceId=456
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "totalUsers": 3240,
  "newUsers": 1240,
  "returningUsers": 2000,
  "usersByDate": [
    {
      "date": "2025-09-01",
      "total": 890,
      "new": 320,
      "returning": 570
    }
  ]
}
```

---

## 🎯 Funnel Analytics

### **GET /v1/analytics/funnels**
Get all funnels for workspace.

**Auth:** JWT Token required

```http
GET /v1/analytics/funnels?workspaceId=456
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "funnels": [
    {
      "id": "789",
      "name": "Sign Up Funnel",
      "description": "Track user registration process",
      "status": "published",
      "createdAt": "2025-09-01T10:00:00.000Z",
      "stepCount": 4
    }
  ],
  "total": 1
}
```

### **POST /v1/analytics/funnels**
Create a new funnel.

**Auth:** JWT Token required

```http
POST /v1/analytics/funnels
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Purchase Funnel",
  "description": "Track the purchase conversion process",
  "steps": [
    {
      "type": "start",
      "label": "Landing Page",
      "matches": [
        {
          "kind": "page",
          "rules": {
            "url_contains": "/landing"
          }
        }
      ]
    },
    {
      "type": "page", 
      "label": "Product Page",
      "matches": [
        {
          "kind": "page",
          "rules": {
            "url_contains": "/product"
          }
        }
      ]
    },
    {
      "type": "conversion",
      "label": "Purchase Complete",
      "matches": [
        {
          "kind": "event",
          "rules": {
            "event_name": "purchase_complete"
          }
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "funnel": {
    "id": "790",
    "name": "Purchase Funnel",
    "description": "Track the purchase conversion process",
    "status": "draft",
    "createdAt": "2025-09-04T21:00:00.000Z",
    "version": 1,
    "steps": [
      {
        "id": "step_1",
        "type": "start",
        "label": "Landing Page",
        "orderIndex": 0
      }
    ]
  },
  "message": "Funnel created successfully"
}
```

### **GET /v1/analytics/funnels/:id/conversion**
Get funnel conversion data.

**Auth:** JWT Token required

```http
GET /v1/analytics/funnels/789/conversion?startDate=2025-09-01&endDate=2025-09-04
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "funnelId": "789",
  "dateRange": {
    "startDate": "2025-09-01",
    "endDate": "2025-09-04"
  },
  "totalUsers": 2450,
  "steps": [
    {
      "stepId": "step_1",
      "label": "Landing Page",
      "users": 2450,
      "dropoff": 0,
      "conversionRate": 100
    },
    {
      "stepId": "step_2", 
      "label": "Sign Up Form",
      "users": 1680,
      "dropoff": 770,
      "conversionRate": 68.6
    },
    {
      "stepId": "step_3",
      "label": "Email Verification", 
      "users": 1240,
      "dropoff": 440,
      "conversionRate": 73.8
    }
  ],
  "overallConversionRate": 50.6
}
```

---

## 🏢 Tenant Management

### **GET /v1/tenants**
Get all tenants (Admin operations).

**Auth:** JWT Token required (Admin)

```http
GET /v1/tenants
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "tenants": [
    {
      "id": "123",
      "name": "Heat",
      "status": "active",
      "createdAt": "2025-09-01T10:00:00.000Z",
      "workspaceCount": 2
    }
  ],
  "total": 1
}
```

### **GET /v1/tenants/:tenantId**
Get specific tenant details.

**Auth:** JWT Token required

```http
GET /v1/tenants/123
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "123",
  "name": "Heat",
  "status": "active", 
  "createdAt": "2025-09-01T10:00:00.000Z",
  "workspaces": [
    {
      "id": "456",
      "name": "RSMKT",
      "createdAt": "2025-09-01T10:00:00.000Z"
    }
  ]
}
```

---

## 💼 Workspace Management

### **GET /v1/tenants/:tenantId/workspaces**
Get all workspaces for a tenant.

**Auth:** JWT Token required

```http
GET /v1/tenants/123/workspaces
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "workspaces": [
    {
      "id": "456",
      "tenantId": "123",
      "name": "RSMKT",
      "createdAt": "2025-09-01T10:00:00.000Z",
      "userCount": 3,
      "apiKeyCount": 2
    }
  ],
  "total": 1
}
```

### **GET /v1/tenants/:tenantId/workspaces/:workspaceId**
Get specific workspace details.

**Auth:** JWT Token required

```http
GET /v1/tenants/123/workspaces/456
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "456",
  "tenantId": "123",
  "name": "RSMKT",
  "createdAt": "2025-09-01T10:00:00.000Z",
  "users": [
    {
      "id": "user_1",
      "email": "admin@example.com",
      "role": "admin"
    }
  ],
  "apiKeys": [
    {
      "id": "key_1",
      "name": "Production Key",
      "scopes": ["track_events", "identify_users"],
      "lastUsedAt": "2025-09-04T20:30:00.000Z"
    }
  ]
}
```

---

## 🔧 Error Responses

### **Standard Error Format**
```json
{
  "statusCode": 400,
  "message": "Detailed error message",
  "error": "Bad Request",
  "timestamp": "2025-09-04T21:00:00.000Z",
  "path": "/v1/analytics/overview"
}
```

### **Common HTTP Status Codes**

- **200** - Success
- **201** - Created
- **400** - Bad Request (Invalid parameters)
- **401** - Unauthorized (Invalid/missing auth)
- **403** - Forbidden (Insufficient permissions)
- **404** - Not Found (Resource doesn't exist)
- **409** - Conflict (Duplicate resource)
- **422** - Unprocessable Entity (Validation failed)
- **429** - Too Many Requests (Rate limited)
- **500** - Internal Server Error

### **Validation Errors**
```json
{
  "statusCode": 422,
  "message": [
    "tenantName must be a string",
    "workspaceName should not be empty"
  ],
  "error": "Unprocessable Entity"
}
```

---

## 🔄 Rate Limiting

All endpoints are subject to rate limiting:

- **Default**: 100 requests per minute per IP
- **Event Tracking**: 1000 requests per minute per API key
- **Headers**: Rate limit info included in responses

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1693872000
```

---

## 📝 Notes

### **Data Types**
- All IDs are returned as strings (converted from BigInt)
- Timestamps are in ISO 8601 format
- Numbers use standard JSON number format

### **Pagination** 
Most list endpoints support:
- `limit` - Number of items (default: 50, max: 100)
- `offset` - Skip items (default: 0)

### **Workspace Context**
Multi-tenant operations automatically filter by user's workspace access. The `workspaceId` parameter is often optional as the system uses the user's current workspace context.

### **Testing**
All endpoints can be tested with tools like:
- Postman
- cURL
- HTTPie
- Frontend fetch/axios calls
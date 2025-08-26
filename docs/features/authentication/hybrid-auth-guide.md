# 🔐 Hybrid Authentication System - Complete Guide

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Updated**: 2025-08-26

## 🎯 Overview

The **Hybrid Authentication System** enables both **API Key authentication** (for integrations like N8N) and **Supabase JWT authentication** (for frontend applications) on the same endpoints. This provides maximum flexibility while maintaining security and backward compatibility.

### 🚀 Key Features

- **🔄 Automatic Detection**: Detects authentication type by token format
- **🔒 Security**: Same security level for both authentication methods
- **↩️ Backward Compatible**: Existing API Key workflows continue unchanged
- **👥 User Management**: Complete user and workspace access management
- **⚡ Performance**: Intelligent caching for both auth types
- **📊 Multi-tenant**: Full tenant/workspace isolation for both methods

---

## 🎛️ Authentication Methods

### 1. 🔑 API Key Authentication (Existing)

**Use Case**: Integrations, webhooks, server-to-server communication

**Format**: `ak_xxxxxxxxxxxxxxxxxxxxxxxx`

**Header**: 
```http
Authorization: ak_your_api_key_here
# OR
Authorization: Bearer ak_your_api_key_here
```

**Scope**: API Keys are bound to a specific tenant/workspace with defined scopes

### 2. 🎫 Supabase JWT Authentication (New)

**Use Case**: Frontend applications, user-facing dashboards

**Format**: Long JWT token from Supabase

**Header**:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Scope**: JWTs provide access based on user's workspace roles and permissions

---

## 📋 Supported Endpoints

All the following endpoints now support **both** authentication methods:

### 🔄 Funnel Management
- `POST /v1/analytics/funnels` - Create funnel
- `GET /v1/analytics/funnels` - List funnels
- `GET /v1/analytics/funnels/:id` - Get funnel details
- `PATCH /v1/analytics/funnels/:id` - Update funnel
- `DELETE /v1/analytics/funnels/:id` - Archive funnel
- `POST /v1/analytics/funnels/:id/publish` - Publish funnel

### 👤 User Management (JWT Only)
- `GET /v1/auth/users/me` - Current user info
- `GET /v1/auth/users/me/workspaces` - User's workspaces
- `GET /v1/auth/users/workspace/:id/users` - Workspace users
- `POST /v1/auth/users/workspace/:id/users` - Grant access
- `PATCH /v1/auth/users/workspace/:id/users/:userId` - Update role
- `DELETE /v1/auth/users/workspace/:id/users/:userId` - Revoke access

### 📊 Analytics & Events (Existing)
- All `/v1/events/*` endpoints
- All `/v1/analytics/*` endpoints
- `/monitoring/*` endpoints

---

## 🔧 Frontend Implementation

### Setup with Supabase

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// Get authentication token
const { data: { session }, error } = await supabase.auth.getSession()

if (session?.access_token) {
  // Use token for API calls
  const response = await fetch('/v1/analytics/funnels', {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  })
}
```

### MercurioClient for Frontend

```typescript
class MercurioClient {
  private baseUrl: string
  private supabase: SupabaseClient

  constructor(baseUrl: string, supabase: SupabaseClient) {
    this.baseUrl = baseUrl
    this.supabase = supabase
  }

  private async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await this.supabase.auth.getSession()
    return session?.access_token || null
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = await this.getAuthToken()
    
    if (!token) {
      throw new Error('No authentication token available')
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Funnel operations
  async createFunnel(funnel: CreateFunnelRequest) {
    return this.request('/v1/analytics/funnels', {
      method: 'POST',
      body: JSON.stringify(funnel)
    })
  }

  async listFunnels(params: ListFunnelsParams = {}) {
    const query = new URLSearchParams(params).toString()
    return this.request(`/v1/analytics/funnels?${query}`)
  }

  async getFunnel(id: string) {
    return this.request(`/v1/analytics/funnels/${id}`)
  }

  async updateFunnel(id: string, updates: UpdateFunnelRequest) {
    return this.request(`/v1/analytics/funnels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
  }

  async archiveFunnel(id: string) {
    return this.request(`/v1/analytics/funnels/${id}`, {
      method: 'DELETE'
    })
  }

  async publishFunnel(id: string, options: PublishFunnelRequest = {}) {
    return this.request(`/v1/analytics/funnels/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(options)
    })
  }

  // User management
  async getCurrentUser() {
    return this.request('/v1/auth/users/me')
  }

  async getUserWorkspaces() {
    return this.request('/v1/auth/users/me/workspaces')
  }

  async getWorkspaceUsers(workspaceId: string) {
    return this.request(`/v1/auth/users/workspace/${workspaceId}/users`)
  }

  async grantWorkspaceAccess(workspaceId: string, userId: string, role: string) {
    return this.request(`/v1/auth/users/workspace/${workspaceId}/users`, {
      method: 'POST',
      body: JSON.stringify({ userId, role })
    })
  }

  async updateUserRole(workspaceId: string, userId: string, role: string) {
    return this.request(`/v1/auth/users/workspace/${workspaceId}/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    })
  }

  async revokeWorkspaceAccess(workspaceId: string, userId: string) {
    return this.request(`/v1/auth/users/workspace/${workspaceId}/users/${userId}`, {
      method: 'DELETE'
    })
  }
}

// Usage
const client = new MercurioClient('http://localhost:3000', supabase)

// Create a funnel
const funnel = await client.createFunnel({
  name: "My Frontend Funnel",
  description: "Created from React app",
  time_window_days: 7,
  steps: [
    {
      order: 0,
      type: "start",
      label: "Landing Page",
      matching_rules: [
        {
          kind: "page",
          rules: { url_match: "/landing*" }
        }
      ]
    },
    {
      order: 1,
      type: "conversion",
      label: "Sign Up",
      matching_rules: [
        {
          kind: "event",
          rules: { event_name: "user_registered" }
        }
      ]
    }
  ]
})
```

---

## 👤 User Management System

### User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **viewer** | Read-only access to analytics and funnels |
| **editor** | Create, edit, and publish funnels |  
| **admin** | Full access + user management |

### Role Hierarchy

```
admin > editor > viewer
```

- **admin** can do everything **editor** + **viewer** can do
- **editor** can do everything **viewer** can do
- Roles are workspace-specific (same user can have different roles in different workspaces)

### User Database Schema

```sql
-- User profile (synced with Supabase)
CREATE TABLE "user_profile" (
    "id" TEXT NOT NULL PRIMARY KEY,          -- Supabase UUID
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3)
);

-- Workspace access control
CREATE TABLE "user_workspace_access" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,                 -- Supabase UUID
    "tenant_id" BIGINT NOT NULL,
    "workspace_id" BIGINT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',   -- admin, editor, viewer
    "granted_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,                       -- Supabase UUID of granter
    "revoked_at" TIMESTAMP(3),
    UNIQUE("user_id", "tenant_id", "workspace_id")
);
```

---

## 📋 User Management Endpoints

### 1. Get Current User Info

```http
GET /v1/auth/users/me
Authorization: Bearer <supabase_jwt>
```

**Response**:
```json
{
  "authType": "supabase_jwt",
  "user": {
    "id": "uuid-string",
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
  "scopes": ["*", "read", "write", "events:read", "events:write", "analytics:read", "analytics:write"]
}
```

### 2. Get User's Workspaces

```http
GET /v1/auth/users/me/workspaces
Authorization: Bearer <supabase_jwt>
```

**Response**:
```json
{
  "workspaces": [
    {
      "tenantId": "123",
      "workspaceId": "456",
      "tenantName": "Acme Corp",
      "workspaceName": "Production",
      "role": "admin",
      "grantedAt": "2025-08-26T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 3. List Workspace Users (Admin Only)

```http
GET /v1/auth/users/workspace/456/users
Authorization: Bearer <supabase_jwt>
```

**Query Parameters**:
- `limit`: Items per page (default: 50)
- `offset`: Offset for pagination (default: 0)

**Response**:
```json
{
  "users": [
    {
      "id": "uuid-string",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "editor",
      "grantedAt": "2025-08-26T10:00:00.000Z",
      "lastLoginAt": "2025-08-26T15:30:00.000Z"
    }
  ],
  "total": 5
}
```

### 4. Grant Workspace Access (Admin Only)

```http
POST /v1/auth/users/workspace/456/users
Authorization: Bearer <supabase_jwt>
Content-Type: application/json

{
  "userId": "target-user-uuid",
  "role": "editor"
}
```

**Response**:
```json
{
  "message": "Workspace access granted successfully",
  "userId": "target-user-uuid",
  "workspaceId": "456",
  "role": "editor"
}
```

### 5. Update User Role (Admin Only)

```http
PATCH /v1/auth/users/workspace/456/users/target-user-uuid
Authorization: Bearer <supabase_jwt>
Content-Type: application/json

{
  "role": "admin"
}
```

**Response**:
```json
{
  "message": "User role updated successfully",
  "userId": "target-user-uuid",
  "workspaceId": "456",
  "role": "admin"
}
```

### 6. Revoke Workspace Access (Admin Only)

```http
DELETE /v1/auth/users/workspace/456/users/target-user-uuid
Authorization: Bearer <supabase_jwt>
```

**Response**:
```json
{
  "message": "Workspace access revoked successfully",
  "userId": "target-user-uuid",
  "workspaceId": "456"
}
```

---

## ⚙️ Configuration

### Environment Variables

```env
# Supabase Configuration (Required for JWT auth)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
SUPABASE_JWT_SECRET="your_jwt_secret_here"

# Cache Configuration (Optional)
SUPABASE_JWT_CACHE_TTL="300000"           # 5 minutes
USER_MAPPING_CACHE_TTL="300000"           # 5 minutes
```

### Graceful Degradation

The system works seamlessly without Supabase configuration:

- **With Supabase**: Full hybrid authentication (API Keys + JWT)
- **Without Supabase**: API Key authentication only (existing behavior)

**Warning logs when Supabase is not configured**:
```
[WARN] Supabase configuration missing - Supabase authentication disabled
[WARN] To enable Supabase auth, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

---

## 🔍 Error Handling

### Common Error Responses

#### 401 - Unauthorized

```json
{
  "message": "Invalid API key",
  "error": "Unauthorized", 
  "statusCode": 401
}
```

**Possible causes**:
- Invalid or expired API key
- Invalid or expired JWT token
- Missing authorization header
- JWT validation failed

#### 403 - Forbidden

```json
{
  "message": "Insufficient workspace access",
  "error": "Forbidden",
  "statusCode": 403
}
```

**Possible causes**:
- User doesn't have access to requested workspace
- User role insufficient for operation (e.g., viewer trying to edit)
- Trying to access another tenant's resources

#### 404 - User Not Found

```json
{
  "message": "User has no workspace access",
  "error": "Unauthorized",
  "statusCode": 401
}
```

**Possible causes**:
- Valid JWT but user not in user_profile table
- User has no workspace access records
- All user's workspace access has been revoked

---

## 🎯 Usage Examples

### Creating a Funnel (Frontend with JWT)

```typescript
// After user logs in with Supabase
const { data: { session } } = await supabase.auth.getSession()

const response = await fetch('/v1/analytics/funnels', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "Landing Page Conversion",
    description: "Track landing page to signup conversion",
    time_window_days: 3,
    steps: [
      {
        order: 0,
        type: "start",
        label: "Landing Page View", 
        matching_rules: [
          {
            kind: "page",
            rules: { url_match: "/landing" }
          }
        ]
      },
      {
        order: 1,
        type: "conversion",
        label: "Sign Up Complete",
        matching_rules: [
          {
            kind: "event", 
            rules: { event_name: "signup_completed" }
          }
        ]
      }
    ]
  })
})

const funnel = await response.json()
console.log('Created funnel:', funnel.id)
```

### Creating a Funnel (Integration with API Key)

```bash
curl -X POST "http://localhost:3000/v1/analytics/funnels" \
  -H "Authorization: ak_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "N8N Integration Funnel",
    "description": "Automated funnel via N8N workflow",
    "time_window_days": 7,
    "steps": [
      {
        "order": 0,
        "type": "start",
        "label": "Webhook Received",
        "matching_rules": [
          {
            "kind": "event",
            "rules": { "event_name": "webhook_received" }
          }
        ]
      },
      {
        "order": 1, 
        "type": "conversion",
        "label": "Action Completed",
        "matching_rules": [
          {
            "kind": "event",
            "rules": { "event_name": "action_completed" }
          }
        ]
      }
    ]
  }'
```

### Managing User Access (Admin Operations)

```typescript
// Grant editor access to a user
await fetch('/v1/auth/users/workspace/456/users', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminJwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'new-user-uuid',
    role: 'editor'
  })
})

// List all workspace users
const users = await fetch('/v1/auth/users/workspace/456/users', {
  headers: {
    'Authorization': `Bearer ${adminJwt}`
  }
}).then(r => r.json())

// Promote user to admin
await fetch('/v1/auth/users/workspace/456/users/user-uuid', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${adminJwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    role: 'admin'
  })
})
```

---

## 🔒 Security Considerations

### JWT Token Validation

- **Signature Verification**: All JWT tokens verified against Supabase JWT secret
- **Expiration Checking**: Expired tokens automatically rejected
- **Issuer Validation**: Only tokens from configured Supabase instance accepted
- **Caching**: Valid tokens cached to reduce validation overhead

### API Key Security

- **Hash-based Storage**: API keys stored as SHA-256 hashes
- **Scope Validation**: Each key limited to specific operations
- **Revocation**: Keys can be revoked instantly
- **Last Used Tracking**: Audit trail of key usage

### Multi-tenant Isolation

- **Database Level**: All queries include tenant/workspace filters
- **Application Level**: Guards enforce tenant context
- **Cache Level**: Cache keys include tenant context
- **Audit Level**: All operations logged with tenant info

### User Access Control

- **Role-based**: Hierarchical role system (admin > editor > viewer)
- **Workspace-scoped**: Permissions are workspace-specific
- **Audit Trail**: All access changes logged
- **Self-service Prevention**: Admins cannot revoke their own access

---

## 📈 Performance & Monitoring

### Caching Strategy

- **JWT Validation**: Cached for token lifetime or 5 minutes (whichever is shorter)
- **User Mappings**: Cached for 5 minutes, invalidated on access changes
- **API Keys**: Cached for 5 minutes with LRU eviction

### Monitoring Metrics

Monitor these key metrics for authentication performance:

```bash
# Authentication success rates
authentication.api_key.success_rate
authentication.jwt.success_rate

# Cache performance
authentication.cache.hit_rate
authentication.cache.miss_rate

# Response times
authentication.validation_latency.p50
authentication.validation_latency.p95

# Error rates
authentication.unauthorized_attempts
authentication.forbidden_attempts
```

### Health Checks

```bash
# Test API Key auth
curl -H "Authorization: ak_test" http://localhost:3000/v1/analytics/funnels

# Test JWT auth (with valid token)
curl -H "Authorization: Bearer $JWT_TOKEN" http://localhost:3000/v1/auth/users/me
```

---

## 🚀 Migration Guide

### For Existing API Integrations

**No changes required!** All existing API Key workflows continue to work exactly as before.

### For New Frontend Development

1. **Setup Supabase**: Configure environment variables
2. **User Onboarding**: Create user profiles and workspace access
3. **Token Management**: Handle JWT token refresh in your frontend
4. **Error Handling**: Implement proper error handling for auth failures

### Migration Checklist

- [ ] Configure Supabase environment variables
- [ ] Run database migrations for user tables
- [ ] Create initial admin user in `user_profile`
- [ ] Grant workspace access to admin user
- [ ] Test JWT authentication flow
- [ ] Update frontend to use JWT tokens
- [ ] Monitor authentication metrics

---

## 🎉 Conclusion

The **Hybrid Authentication System** provides a seamless bridge between:

- **Backend integrations** using API Keys
- **Frontend applications** using Supabase JWT

**Key Benefits**:

✅ **Zero Breaking Changes**: Existing API Key workflows unchanged  
✅ **Modern Frontend Support**: Full JWT authentication for user-facing apps  
✅ **Complete User Management**: Role-based access control with admin tools  
✅ **High Performance**: Intelligent caching reduces authentication overhead  
✅ **Production Ready**: Comprehensive error handling and monitoring  

Your API now supports both integration and user-facing use cases with a single, unified authentication system! 🔐

---

**🔐 Hybrid Authentication System v1.0.0**  
*Secure, Flexible, Production-Ready Authentication*
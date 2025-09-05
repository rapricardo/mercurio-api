# Frontend Integration Guide - Mercurio API

Complete guide for frontend developers to integrate with Mercurio Analytics API.

## 🚀 Quick Start

### **Base URL**
```
Production: https://mercurio-api.ricardotocha.com.br
Development: http://localhost:3000
```

### **Authentication**
All API calls require either:
- **JWT Token** (for user-based operations): `Authorization: Bearer <jwt_token>`
- **API Key** (for event tracking): `Authorization: Bearer <api_key>`

## 🔐 Authentication Flow

### **1. User Login & Onboarding**
```typescript
// 1. After Supabase authentication, check user status
const checkUserStatus = async (jwt: string) => {
  const response = await fetch('/v1/auth/users/me/status', {
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  return await response.json();
};

// 2. Smart redirection based on status
const handlePostLogin = async (jwt: string) => {
  const status = await checkUserStatus(jwt);
  
  if (status.needsOnboarding) {
    router.push('/onboarding');
  } else {
    router.push('/dashboard');
  }
};

// 3. Onboarding submission
const submitOnboarding = async (data: { tenantName: string; workspaceName: string }) => {
  const response = await fetch('/v1/onboarding', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (response.ok) {
    router.push('/dashboard');
  }
};
```

### **2. Get User Workspaces**
```typescript
const getUserWorkspaces = async (jwt: string) => {
  const response = await fetch('/v1/auth/users/me/workspaces', {
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  
  const data = await response.json();
  return data.workspaces; // Array of user workspaces
};
```

## 📊 Event Tracking Integration

### **1. Initialize Tracking**
```typescript
interface MercurioConfig {
  apiKey: string;
  apiUrl?: string;
  debug?: boolean;
}

class MercurioAnalytics {
  private apiKey: string;
  private apiUrl: string;
  private anonymousId: string;
  private sessionId: string;

  constructor(config: MercurioConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'https://mercurio-api.ricardotocha.com.br';
    this.anonymousId = this.generateAnonymousId();
    this.sessionId = this.generateSessionId();
  }

  private generateAnonymousId(): string {
    // Get from localStorage or generate new
    let id = localStorage.getItem('mercurio_anonymous_id');
    if (!id) {
      id = 'a_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('mercurio_anonymous_id', id);
    }
    return id;
  }

  private generateSessionId(): string {
    return 's_' + Math.random().toString(36).substring(2, 15);
  }
}
```

### **2. Track Events**
```typescript
// Single event tracking
const trackEvent = async (eventData: {
  eventName: string;
  properties?: Record<string, any>;
  page?: {
    url: string;
    title: string;
    referrer?: string;
  };
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}) => {
  const payload = {
    eventName: eventData.eventName,
    anonymousId: mercurio.anonymousId,
    sessionId: mercurio.sessionId,
    timestamp: new Date().toISOString(),
    page: eventData.page || {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer
    },
    utm: eventData.utm,
    device: {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    },
    props: eventData.properties
  };

  await fetch('/v1/events/track', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
};

// Usage examples
trackEvent({
  eventName: 'page_view',
  page: {
    url: '/dashboard',
    title: 'Analytics Dashboard'
  }
});

trackEvent({
  eventName: 'button_click',
  properties: {
    button_text: 'Create Funnel',
    section: 'analytics'
  }
});
```

### **3. User Identification**
```typescript
const identifyUser = async (userInfo: {
  email: string;
  name?: string;
  phone?: string;
}) => {
  await fetch('/v1/events/identify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      anonymousId: mercurio.anonymousId,
      traits: userInfo,
      timestamp: new Date().toISOString()
    })
  });
};
```

### **4. Batch Event Tracking**
```typescript
const trackBatchEvents = async (events: Array<EventData>) => {
  await fetch('/v1/events/batch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ events })
  });
};
```

## 📈 Analytics Dashboard Integration

### **1. Get Analytics Overview**
```typescript
const getAnalyticsOverview = async (jwt: string, params: {
  startDate: string;
  endDate: string;
  workspaceId: string;
}) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`/v1/analytics/overview?${query}`, {
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  return await response.json();
};
```

### **2. Get Time Series Data**
```typescript
const getTimeSeriesData = async (jwt: string, params: {
  startDate: string;
  endDate: string;
  workspaceId: string;
  interval?: 'hour' | 'day' | 'week' | 'month';
  events?: string[];
}) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`/v1/analytics/timeseries?${query}`, {
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  return await response.json();
};
```

### **3. Get Top Events**
```typescript
const getTopEvents = async (jwt: string, params: {
  startDate: string;
  endDate: string;
  workspaceId: string;
  limit?: number;
}) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`/v1/analytics/events/top?${query}`, {
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  return await response.json();
};
```

## 🎯 Funnel Analytics

### **1. Create Funnel**
```typescript
const createFunnel = async (jwt: string, funnelData: {
  name: string;
  description?: string;
  steps: Array<{
    type: 'start' | 'page' | 'event' | 'conversion';
    label: string;
    matches: Array<{
      kind: 'page' | 'event';
      rules: Record<string, any>;
    }>;
  }>;
}) => {
  const response = await fetch('/v1/analytics/funnels', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(funnelData)
  });
  return await response.json();
};
```

### **2. Get Funnel Conversion Data**
```typescript
const getFunnelConversion = async (jwt: string, funnelId: string, params: {
  startDate: string;
  endDate: string;
  breakdown?: 'day' | 'week' | 'month';
}) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`/v1/analytics/funnels/${funnelId}/conversion?${query}`, {
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  return await response.json();
};
```

## 🛠️ Workspace Management

### **1. Get Current User Info**
```typescript
const getCurrentUser = async (jwt: string) => {
  const response = await fetch('/v1/auth/users/me', {
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  return await response.json();
};
```

### **2. Switch Between Workspaces**
```typescript
// The API is multi-tenant aware, use workspace context in requests
const switchWorkspace = (workspaceId: string) => {
  // Store current workspace in state/context
  setCurrentWorkspace(workspaceId);
  
  // All subsequent API calls will use this workspace context
  // The HybridAuthGuard handles workspace access validation
};
```

## 🏥 Health & Monitoring

### **1. Health Check**
```typescript
const checkApiHealth = async () => {
  const response = await fetch('/health');
  return await response.json();
};

// Response: { status: 'ok', timestamp: '2025-09-04T...' }
```

### **2. Get Metrics**
```typescript
const getApiMetrics = async () => {
  const response = await fetch('/monitoring/metrics');
  return await response.json();
};
```

## ⚠️ Error Handling

### **Global Error Handler**
```typescript
class ApiClient {
  private async handleResponse(response: Response) {
    if (!response.ok) {
      const error = await response.json();
      
      switch (response.status) {
        case 401:
          // Redirect to login
          this.redirectToLogin();
          break;
        case 403:
          // Show access denied message
          this.showAccessDenied();
          break;
        case 409:
          // Handle conflicts (e.g., duplicate onboarding)
          this.handleConflict(error.message);
          break;
        case 429:
          // Rate limit exceeded
          this.handleRateLimit();
          break;
        default:
          // Generic error
          this.showError(error.message);
      }
      
      throw new Error(error.message);
    }
    
    return await response.json();
  }
}
```

### **Common Error Scenarios**

#### **Onboarding Conflicts**
```typescript
// If user tries to onboard again
{
  "statusCode": 409,
  "message": "You already have access to a workspace and don't need to complete onboarding again. Please go to your dashboard to access your existing workspace(s).",
  "error": "Conflict"
}

// Frontend: Redirect to dashboard with info message
```

#### **Invalid Workspace Access**
```typescript
// If user tries to access workspace they don't have permission for
{
  "statusCode": 403,
  "message": "No access to requested workspace",
  "error": "Forbidden"
}

// Frontend: Show workspace selector or request access
```

## 🧪 Testing & Development

### **Environment Setup**
```typescript
const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    debug: true
  },
  production: {
    apiUrl: 'https://mercurio-api.ricardotocha.com.br',
    debug: false
  }
};

const mercurio = new MercurioAnalytics(config[process.env.NODE_ENV]);
```

### **Debug Mode**
```typescript
// Enable detailed logging in development
if (config.debug) {
  console.log('Tracking event:', eventData);
  console.log('API Response:', response);
}
```

## 📋 TypeScript Definitions

### **Core Types**
```typescript
interface UserStatus {
  needsOnboarding: boolean;
  hasWorkspaces: boolean;
  workspaceCount: number;
  authStatus: 'authenticated' | 'api_key';
  primaryWorkspace?: {
    tenantId: string;
    workspaceId: string;
    tenantName: string;
    workspaceName: string;
    role: string;
    grantedAt: string;
  };
  user?: {
    id: string;
    email: string;
    name?: string;
    lastLoginAt?: string;
  };
}

interface EventData {
  eventName: string;
  anonymousId: string;
  sessionId?: string;
  leadId?: string;
  timestamp: string;
  page?: {
    url: string;
    title: string;
    referrer?: string;
  };
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  device?: {
    userAgent?: string;
    screen?: string;
    viewport?: string;
  };
  geo?: {
    country?: string;
    city?: string;
  };
  props?: Record<string, any>;
}

interface AnalyticsOverview {
  totalEvents: number;
  uniqueUsers: number;
  sessions: number;
  avgSessionDuration: number;
  topEvents: Array<{ name: string; count: number }>;
  timeline: Array<{ date: string; events: number; users: number }>;
}
```

## 🔗 Related Documentation

- **[Onboarding Feature](./docs/features/onboarding/)** - Complete onboarding flow
- **[Authentication Guide](./docs/features/authentication/)** - Auth system details
- **[API Reference](./docs/api/)** - Complete API documentation
- **[Event Ingestion](./docs/features/ingestion/)** - Event tracking specs

## 🆘 Support & Troubleshooting

### **Common Issues**

1. **CORS Errors**: Ensure API URL is correctly configured
2. **401 Unauthorized**: Check JWT token validity and format
3. **403 Forbidden**: Verify workspace access permissions
4. **Rate Limiting**: Implement exponential backoff for retries

### **Debug Checklist**
- [ ] Correct API URL and endpoints
- [ ] Valid authentication tokens
- [ ] Proper request headers and content-type
- [ ] Network connectivity and CORS configuration
- [ ] Workspace permissions and access rights
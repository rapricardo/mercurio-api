# User Onboarding Feature

Complete guide for implementing user onboarding flow with Mercurio API.

## 📋 Overview

The onboarding process handles first-time user setup by creating:
- **Tenant** (Company/Organization) 
- **Workspace** (Project/Team space)
- **User Profile** (User details)
- **Admin Access** (User permissions)

## 🔄 User Flow

### 1. **User Authentication** (Supabase)
- User signs up/logs in via Supabase Auth
- Frontend receives JWT token

### 2. **Onboarding Status Check**
- Frontend calls `GET /v1/auth/users/me/status`
- API returns user status and eligibility

### 3. **Smart Redirection**
```typescript
if (userStatus.needsOnboarding === false) {
  // Redirect to dashboard
  router.push('/dashboard');
} else {
  // Show onboarding form
  showOnboardingForm();
}
```

### 4. **Onboarding Form Submission**
- User fills tenant name and workspace name
- Frontend calls `POST /v1/onboarding`
- API creates tenant, workspace, and grants admin access

### 5. **Success & Redirect**
- Show success message with details
- Redirect to dashboard
- User can access their new workspace

## 🛠️ API Integration

### **Check User Status**
```http
GET /v1/auth/users/me/status
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "needsOnboarding": false,
  "hasWorkspaces": true, 
  "workspaceCount": 1,
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
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "lastLoginAt": "2025-09-04T21:00:00.000Z"
  }
}
```

### **Check Onboarding Eligibility** (Optional)
```http
GET /v1/onboarding/eligibility
Authorization: Bearer <jwt_token>
```

**Response:**
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

### **Create Tenant & Workspace**
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

## 🎯 Frontend Implementation

### **React Example**
```typescript
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

interface UserStatus {
  needsOnboarding: boolean;
  hasWorkspaces: boolean;
  primaryWorkspace?: {
    tenantName: string;
    workspaceName: string;
  };
}

export function useOnboardingFlow() {
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      const token = getAuthToken(); // Your auth token getter
      const response = await fetch('/api/v1/auth/users/me/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const status: UserStatus = await response.json();
      setUserStatus(status);
      
      // Smart redirection
      if (!status.needsOnboarding) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to check user status:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitOnboarding = async (data: { tenantName: string; workspaceName: string }) => {
    try {
      setLoading(true);
      const token = getAuthToken();
      
      const response = await fetch('/api/v1/onboarding', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Onboarding failed');
      }

      const result = await response.json();
      
      // Show success message
      showSuccessMessage(result.message);
      
      // Redirect to dashboard
      router.push('/dashboard');
      
    } catch (error) {
      console.error('Onboarding failed:', error);
      showErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    userStatus,
    loading,
    submitOnboarding
  };
}
```

## ⚠️ Error Handling

### **Common Error Responses**

#### **409 - User Already Has Access**
```json
{
  "statusCode": 409,
  "message": "You already have access to a workspace and don't need to complete onboarding again. Please go to your dashboard to access your existing workspace(s). If you need to create additional workspaces, please contact support.",
  "error": "Conflict"
}
```

**Frontend Action:** Redirect to dashboard with informational message.

#### **409 - Duplicate Company Name**
```json
{
  "statusCode": 409,
  "message": "A company with the name \"Heat\" already exists. Please choose a different company name and try again.",
  "error": "Conflict"
}
```

**Frontend Action:** Show inline error on company name field.

#### **401 - Invalid Token**
```json
{
  "statusCode": 401,
  "message": "Invalid JWT token",
  "error": "Unauthorized"  
}
```

**Frontend Action:** Redirect to login.

## 🔒 Security Considerations

- ✅ **JWT Validation**: All endpoints validate Supabase JWT tokens
- ✅ **Duplicate Prevention**: Users can't onboard twice
- ✅ **Transaction Safety**: Atomic database operations
- ✅ **Input Validation**: Company/workspace names are validated
- ✅ **Rate Limiting**: Protected by global rate limits

## 📊 Analytics & Monitoring

The onboarding process emits the following metrics:
- `onboarding_requests` - Total requests
- `onboarding_errors` - Failed attempts  
- `onboarding_processing_time` - Completion time

## 🧪 Testing

### **Manual Testing Checklist**
- [ ] New user completes onboarding successfully
- [ ] Existing user is redirected to dashboard
- [ ] Duplicate company names are rejected
- [ ] Invalid tokens are rejected
- [ ] Success response includes all required fields

### **API Testing Examples**
```bash
# Test user status (replace with real JWT)
curl -H "Authorization: Bearer <jwt_token>" \\
     https://your-api.com/v1/auth/users/me/status

# Test onboarding
curl -X POST \\
     -H "Authorization: Bearer <jwt_token>" \\
     -H "Content-Type: application/json" \\
     -d '{"tenantName":"TestCorp","workspaceName":"TestWorkspace"}' \\
     https://your-api.com/v1/onboarding
```

## 🔄 Related Features

- **[Authentication](../authentication/)** - User login/signup
- **[Workspaces](../workspaces/)** - Workspace management  
- **[Tenants](../tenants/)** - Tenant administration
- **[Analytics](../analytics/)** - Usage tracking

## 📝 Next Steps

After onboarding completion:
1. User gets admin access to their workspace
2. Can create API keys for event tracking
3. Can invite additional team members
4. Can start sending analytics events
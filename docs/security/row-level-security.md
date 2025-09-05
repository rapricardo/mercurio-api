# Row Level Security (RLS) Implementation

## 🔒 Overview

The Mercurio API now implements comprehensive Row Level Security (RLS) at the database level to ensure strict multi-tenant isolation and role-based access control.

## 🏗️ Architecture

### **Hybrid Authentication Support**
- **API Keys**: Session variables for tenant/workspace context
- **JWT Tokens**: User-based access with role hierarchy
- **Database-Level**: RLS policies enforce isolation automatically

### **Security Layers**
1. **Application Guard**: `HybridAuthGuard` validates authentication
2. **Session Variables**: Set tenant/workspace context for RLS
3. **Database Policies**: Enforce access control at row level
4. **Service Layer**: `PrismaRLSService` manages context automatically

## 🎯 RLS Functions

### **Context Functions**
```sql
-- Get current tenant ID from JWT or session
current_tenant_id() → bigint

-- Get current workspace ID from JWT or session  
current_workspace_id() → bigint

-- Get current user role
current_user_role() → text

-- Get current user ID (for JWT auth)
current_user_id() → text

-- Check workspace access with optional role requirement
has_workspace_access(workspace_id, required_role) → boolean
```

### **How It Works**
1. **JWT Authentication**: Extracts context from JWT claims
2. **API Key Authentication**: Uses session variables set by `HybridAuthGuard`
3. **Fallback**: Graceful handling when context is unavailable

## 📊 RLS Policy Coverage

### **Core Tables**
- ✅ `tenant` - Users only see their accessible tenants
- ✅ `workspace` - Workspace access control
- ✅ `user_profile` - Own profile + workspace colleagues
- ✅ `user_workspace_access` - Permission management

### **Analytics Tables**
- ✅ `visitor` - Workspace isolation
- ✅ `lead` - PII data protection with workspace isolation
- ✅ `identity_link` - User identity linking security
- ✅ `event` - High-volume table with optimized policies
- ✅ `session` - Session data isolation

### **Administrative Tables**
- ✅ `api_key` - Admin-only access to API key management
- ✅ `funnel*` - Role-based funnel access (viewer/editor/admin)

## 🛠️ Usage Guide

### **1. In Controllers**

```typescript
import { PrismaRLSService, RLSContext } from '../common/services/prisma-rls.service';
import { RLSContext as RLSContextDecorator } from '../common/decorators/rls-context.decorator';

@Controller('events')
export class EventsController {
  constructor(private readonly prismaRLS: PrismaRLSService) {}

  @Get()
  async getEvents(@RLSContextDecorator() rlsContext: RLSContext) {
    // Create context-aware Prisma client
    const prisma = this.prismaRLS.createContextualClient(rlsContext);
    
    // This query automatically enforces RLS policies
    return await prisma.event.findMany({
      take: 100,
      orderBy: { timestamp: 'desc' }
    });
  }
}
```

### **2. In Services**

```typescript
@Injectable()
export class AnalyticsService {
  constructor(private readonly prismaRLS: PrismaRLSService) {}

  async getWorkspaceAnalytics(rlsContext: RLSContext, dateRange: DateRange) {
    const prisma = this.prismaRLS.createContextualClient(rlsContext);
    
    // RLS automatically filters to accessible workspace data
    const [events, visitors, conversions] = await Promise.all([
      prisma.event.count({
        where: {
          timestamp: {
            gte: dateRange.start,
            lte: dateRange.end
          }
        }
      }),
      prisma.visitor.count(),
      prisma.lead.count()
    ]);
    
    return { events, visitors, conversions };
  }
}
```

### **3. Transaction Support**

```typescript
async createFunnelWithSteps(rlsContext: RLSContext, funnelData: CreateFunnelData) {
  const prisma = this.prismaRLS.createContextualClient(rlsContext);
  
  return await prisma.$transaction(async (tx) => {
    // All operations in transaction inherit RLS context
    const funnel = await tx.funnel.create({
      data: {
        name: funnelData.name,
        description: funnelData.description,
        tenantId: BigInt(rlsContext.tenantId),
        workspaceId: BigInt(rlsContext.workspaceId)
      }
    });
    
    const version = await tx.funnelVersion.create({
      data: {
        funnelId: funnel.id,
        version: 1,
        state: 'draft'
      }
    });
    
    return { funnel, version };
  });
}
```

## 🔧 Configuration

### **Environment Variables**
No additional configuration needed - RLS works automatically with existing authentication.

### **Performance Optimization**
RLS policies are optimized with:
- ✅ Targeted indexes for multi-tenant queries
- ✅ Efficient policy conditions
- ✅ Function caching with `STABLE` attribute
- ✅ Minimal overhead on high-volume tables

## 📋 Access Control Matrix

| Role | Tenants | Workspaces | Analytics | API Keys | Funnels | Users |
|------|---------|------------|-----------|----------|---------|-------|
| **API Key** | Own | Own | Full | ❌ | Read | ❌ |
| **Viewer** | Accessible | Accessible | Read | ❌ | Read | Own |
| **Editor** | Accessible | Accessible | Full | ❌ | Full | Colleagues |
| **Admin** | Accessible | Accessible | Full | Full | Full | Full |

## 🚨 Security Benefits

### **Database-Level Protection**
- ✅ **Automatic Enforcement**: Impossible to bypass via application bugs
- ✅ **Multi-Tenant Isolation**: Zero data leakage between workspaces
- ✅ **Role-Based Access**: Granular permissions based on user roles
- ✅ **PII Protection**: Extra security for sensitive lead data

### **Defense in Depth**
1. **Network**: HTTPS, rate limiting
2. **Application**: Authentication guards, input validation  
3. **Database**: RLS policies, encrypted PII
4. **Monitoring**: Security advisors, audit logs

## 🧪 Testing

### **Verify RLS Status**
```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

### **Test Context Functions**
```sql
-- Set test context
SELECT set_config('app.current_tenant_id', '123', true);
SELECT current_tenant_id(); -- Should return 123
```

### **Manual Policy Testing**
```sql
-- Test as API key user
SELECT set_config('app.current_tenant_id', '1', true);
SELECT set_config('app.current_workspace_id', '1', true);
SELECT set_config('app.current_user_role', 'api_key', true);

SELECT COUNT(*) FROM event; -- Should only show workspace 1 events
```

## ⚠️ Important Notes

### **Migration Safety**
- ✅ All existing functionality preserved
- ✅ Backward compatible with current API
- ✅ Zero downtime deployment
- ✅ Gradual rollout possible

### **Development Tips**
1. **Always use `PrismaRLSService`** for database operations
2. **Test with different contexts** to verify isolation
3. **Monitor performance** on high-volume queries
4. **Use decorators** to simplify context extraction

### **Troubleshooting**
- **Empty results**: Check RLS context is set correctly
- **Permission errors**: Verify user has workspace access
- **Performance issues**: Review query plans and indexes

## 🔄 Migration Path

The RLS system is now **fully implemented and active**. All future database queries will automatically enforce security policies based on the authentication context.

**Next Steps:**
1. Update service methods to use `PrismaRLSService`
2. Test thoroughly with different user roles
3. Monitor performance and adjust policies if needed
4. Document any custom access patterns for your team
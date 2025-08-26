# API Changes — Sprint 1 Ingestão Operacional

## 🎯 Overview

Este documento especifica as mudanças necessárias na API para implementar os requisitos do Sprint 1, com foco em **limites operacionais**, **deduplicação** e **schema versioning**.

---

## 🔧 Changes Required

### 1. Payload & Batch Limits

**File**: `apps/api/src/events/controllers/events.controller.ts`

**Current Implementation**:
```typescript
private readonly MAX_BATCH_SIZE = 1000
private readonly MAX_PAYLOAD_SIZE = 1024 * 1024 // 1MB
```

**Required Change**:
```typescript
private readonly MAX_BATCH_SIZE = 50           // ← Reduced
private readonly MAX_PAYLOAD_SIZE = 256 * 1024  // ← 256KB (4x reduction)
```

**Rationale**: Conservative limits for staging environment stability.

---

### 2. Event Deduplication

**Status**: ❌ Not implemented

#### 2.1 Database Schema Addition

**File**: `apps/api/prisma/schema.prisma`

**Add unique constraint**:
```prisma
model Event {
  // ... existing fields
  eventId       String?  @map("event_id") @db.VarChar(100)  // ← New field
  
  // ... existing relations
  
  // Add unique constraint for deduplication
  @@unique([tenantId, eventId], name: "unique_tenant_event")
}
```

#### 2.2 DTO Updates

**File**: `apps/api/src/events/dto/track-event.dto.ts`

**Add optional event_id**:
```typescript
export class TrackEventDto {
  // ... existing fields
  
  @IsOptional()
  @IsString()
  @Length(1, 100)
  event_id?: string;  // ← New optional field
}
```

#### 2.3 Deduplication Logic

**File**: `apps/api/src/events/services/event-processor.service.ts`

**Add deduplication check**:
```typescript
async processTrackEvent(event: TrackEventDto, tenant: TenantContext, enrichment: any) {
  // Check for deduplication if event_id provided
  if (event.event_id) {
    const existing = await this.prisma.event.findFirst({
      where: {
        tenantId: tenant.tenantId,
        eventId: event.event_id
      }
    });
    
    if (existing) {
      // Return success for duplicate (idempotent)
      return {
        success: true,
        eventId: existing.eventId,
        isDuplicate: true
      };
    }
  }
  
  // ... proceed with normal processing
}
```

---

### 3. Schema Versioning Support

**Status**: ❌ Not implemented

#### 3.1 EnrichmentService Enhancement

**File**: `apps/api/src/events/services/enrichment.service.ts`

**Extract schema version from headers**:
```typescript
enrichEvent(request: Request) {
  return {
    // ... existing enrichment data
    schemaVersion: this.extractSchemaVersion(request)
  };
}

private extractSchemaVersion(request: Request): string {
  const headerVersion = request.headers['x-event-schema-version'] as string;
  
  if (headerVersion) {
    // Basic semver validation
    if (this.isValidSemver(headerVersion)) {
      return headerVersion;
    } else {
      // Log invalid version for monitoring
      console.warn(`[Schema] Invalid version format: ${headerVersion}`);
    }
  }
  
  return '1.0.0'; // Default fallback
}

private isValidSemver(version: string): boolean {
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
  return semverRegex.test(version);
}
```

#### 3.2 Event Processing Update

**File**: `apps/api/src/events/services/event-processor.service.ts`

**Store schema version**:
```typescript
const eventRecord = await this.prisma.event.create({
  data: {
    // ... existing fields
    schemaVersion: enrichmentData.schemaVersion, // ← Store schema version
  }
});
```

---

### 4. Rate Limiting (Basic)

**Status**: ❌ Not implemented  
**Priority**: Medium (can be Sprint 2)

#### 4.1 Simple In-Memory Rate Limiter

**File**: `apps/api/src/common/guards/rate-limit.guard.ts`

**Basic implementation**:
```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  private requestCounts = new Map<string, { count: number; reset: number }>();
  private readonly WINDOW_MS = 60 * 1000; // 1 minute
  private readonly MAX_REQUESTS = 1000;   // per tenant per minute

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request[TENANT_CONTEXT_KEY]?.tenantId;
    
    if (!tenantId) return true; // Skip if no tenant context
    
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;
    
    const key = `tenant:${tenantId}`;
    const current = this.requestCounts.get(key);
    
    if (!current || current.reset < now) {
      // New window or expired
      this.requestCounts.set(key, { count: 1, reset: now + this.WINDOW_MS });
      return true;
    }
    
    if (current.count >= this.MAX_REQUESTS) {
      throw new HttpException('Rate limit exceeded', 429);
    }
    
    current.count++;
    return true;
  }
}
```

---

## 📊 Database Migration

### Migration Script

**File**: `apps/api/prisma/migrations/XXXXXX_add_event_deduplication/migration.sql`

```sql
-- Add event_id column for deduplication
ALTER TABLE "event" ADD COLUMN "event_id" VARCHAR(100);

-- Create unique index for deduplication
CREATE UNIQUE INDEX "unique_tenant_event" ON "event"("tenant_id", "event_id") 
WHERE "event_id" IS NOT NULL;

-- Add index for schema_version for analytics
CREATE INDEX "event_schema_version_idx" ON "event"("schema_version");
```

---

## 🔄 Testing Strategy

### Unit Tests
- ✅ Payload size validation 
- ✅ Batch size validation
- ✅ Event deduplication logic
- ✅ Schema version extraction
- ✅ Semver validation

### Integration Tests  
- ✅ End-to-end deduplication flow
- ✅ Schema version persistence  
- ✅ Rate limiting behavior
- ✅ Error responses for limits

### Performance Tests
- ✅ Latency impact of deduplication
- ✅ Memory usage with rate limiting
- ✅ Throughput with new limits

---

## ⚠️ Breaking Changes

### 1. Batch Size Reduction
**Impact**: Clients sending >50 events will get 400 errors  
**Migration**: Update client code to batch in chunks of 50

### 2. Payload Size Reduction  
**Impact**: Large payloads (>256KB) will be rejected  
**Migration**: Client-side payload size validation

### 3. None for Optional Features
- `event_id` is optional - no breaking change
- `X-Event-Schema-Version` is optional - no breaking change

---

## 🚀 Implementation Order

1. **Week 1**: Limits adjustment + tests
2. **Week 1**: Database migration for deduplication  
3. **Week 1**: Schema versioning implementation
4. **Week 2**: Deduplication logic + comprehensive tests
5. **Week 2**: Rate limiting (if Sprint 1 scope)

---

## 📋 Validation Checklist

- [ ] Payload limit enforced (256KB)
- [ ] Batch limit enforced (50 events)  
- [ ] Event deduplication working
- [ ] Schema version persistence
- [ ] Semver validation functional
- [ ] Error messages informative
- [ ] Rate limiting operational (if included)
- [ ] Migration script tested
- [ ] Performance impact acceptable
- [ ] All tests passing
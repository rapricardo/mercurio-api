# Database ID Strategy and Prefixing Rules

## Overview

This document defines the comprehensive ID strategy for the Mercurio project, covering internal database IDs, external API IDs, and the prefixing system that ensures type safety and debugging efficiency.

## Internal ID Strategy

### Primary Key Design
All database tables use `BIGSERIAL` for primary keys:

```sql
CREATE TABLE example_table (
    id BIGSERIAL PRIMARY KEY,  -- Internal ID: 1, 2, 3, ...
    -- other columns
);
```

### Benefits of BIGINT IDs
- **Performance**: Faster joins and indexing compared to UUIDs
- **Storage**: 8 bytes vs 16 bytes for UUIDs (50% space savings)
- **Sequential**: Natural ordering for debugging and pagination
- **Deterministic**: Predictable ID generation for testing

### Foreign Key Relationships
All foreign keys use `BIGINT` to match primary keys:

```sql
CREATE TABLE workspace (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenant(id),  -- FK uses BIGINT
    -- other columns
);
```

## External ID Prefixing System

### Prefix Registry
Each entity type has a unique prefix for external representation:

| Entity | Prefix | Pattern | Example | Internal ID |
|--------|--------|---------|---------|-------------|
| Tenant | `tn_` | `tn_{id}` | `tn_123` | 123 |
| Workspace | `ws_` | `ws_{id}` | `ws_456` | 456 |
| Lead | `ld_` | `ld_{id}` | `ld_789` | 789 |
| Visitor | `a_` | `a_{client_id}` | `a_abc123def` | Client-generated |
| Session | `s_` | `s_{client_id}` | `s_xyz789abc` | Client-generated |
| API Key | `ak_` | `ak_{id}` | `ak_101` | 101 |
| Funnel | `fn_` | `fn_{id}` | `fn_202` | 202 |
| Funnel Version | `fv_` | `fv_{id}` | `fv_303` | 303 |
| Event | `ev_` | `ev_{id}` | `ev_404` | 404 |

### Client-Generated IDs
Some entities use client-generated IDs for performance and offline capability:

#### Anonymous ID (Visitor)
```javascript
// Client-side generation
const anonymousId = 'a_' + generateRandomString(12); // a_abc123def456
```

#### Session ID
```javascript
// Client-side generation  
const sessionId = 's_' + generateRandomString(12); // s_xyz789abc123
```

### Database Implementation

#### Helper Functions
```sql
-- Function to generate external ID from internal ID
CREATE OR REPLACE FUNCTION generate_external_id(prefix TEXT, internal_id BIGINT)
RETURNS TEXT AS $$
BEGIN
    RETURN prefix || internal_id::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to extract internal ID from external ID
CREATE OR REPLACE FUNCTION extract_internal_id(external_id TEXT)
RETURNS BIGINT AS $$
BEGIN
    RETURN SUBSTRING(external_id FROM '[0-9]+')::BIGINT;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid external ID format: %', external_id;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### Usage Examples
```sql
-- Generate external IDs in queries
SELECT 
    generate_external_id('tn_', id) as external_id,
    name,
    status
FROM tenant;

-- Convert external ID back to internal for queries
SELECT * FROM tenant 
WHERE id = extract_internal_id('tn_123');
```

## API Integration Patterns

### Request/Response Format
APIs should always use external IDs in requests and responses:

#### Request Example
```json
{
  "tenant_id": "tn_123",
  "workspace_id": "ws_456", 
  "funnel_id": "fn_789"
}
```

#### Response Example
```json
{
  "id": "ld_101",
  "tenant_id": "tn_123",
  "workspace_id": "ws_456",
  "email": "user@example.com",
  "created_at": "2025-08-23T14:30:00Z"
}
```

### TypeScript Type Definitions
```typescript
// Branded types for type safety
type TenantId = string & { readonly brand: unique symbol };
type WorkspaceId = string & { readonly brand: unique symbol };
type LeadId = string & { readonly brand: unique symbol };

// Helper functions
function createTenantId(id: string): TenantId {
  if (!id.startsWith('tn_')) {
    throw new Error('Invalid tenant ID format');
  }
  return id as TenantId;
}

function extractInternalId(externalId: string): number {
  const match = externalId.match(/^[a-z]+_(\d+)$/);
  if (!match) {
    throw new Error('Invalid external ID format');
  }
  return parseInt(match[1], 10);
}
```

## Validation Rules

### Format Validation
All external IDs must follow these patterns:

```regex
# Server-generated IDs
^(tn|ws|ld|ak|fn|fv|ev)_\d+$

# Client-generated IDs  
^(a|s)_[a-zA-Z0-9]{12}$
```

### Database Constraints
```sql
-- Add check constraints for client-generated IDs
ALTER TABLE visitor 
ADD CONSTRAINT chk_visitor_anonymous_id_format 
CHECK (anonymous_id ~ '^a_[a-zA-Z0-9]{12}$');

ALTER TABLE session 
ADD CONSTRAINT chk_session_id_format 
CHECK (session_id ~ '^s_[a-zA-Z0-9]{12}$');
```

## Migration Examples

### Adding New Entity with ID Strategy
```sql
-- Migration: Create new entity with proper ID strategy
CREATE TABLE funnel_step (
    id BIGSERIAL PRIMARY KEY,  -- Internal BIGINT ID
    funnel_version_id BIGINT NOT NULL REFERENCES funnel_version(id),
    order_index INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    label VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX idx_funnel_step_version ON funnel_step(funnel_version_id);

-- Comment for documentation
COMMENT ON TABLE funnel_step IS 'Steps within a funnel version - external ID: fs_{id}';
```

### Converting Existing UUIDs to BIGINT
```sql
-- Migration: Convert UUID to BIGINT (if needed)
BEGIN;

-- Create new column
ALTER TABLE old_table ADD COLUMN new_id BIGSERIAL;

-- Create mapping table for transition period
CREATE TABLE id_mapping (
    old_uuid UUID PRIMARY KEY,
    new_id BIGINT NOT NULL
);

-- Populate mapping
INSERT INTO id_mapping (old_uuid, new_id)
SELECT uuid_id, new_id FROM old_table;

-- Update foreign key references
-- (This would be done in subsequent migrations)

COMMIT;
```

## Performance Considerations

### Index Strategy
Always include tenant isolation in indexes:

```sql
-- Correct: Tenant-aware composite index
CREATE INDEX idx_lead_tenant_email ON lead(tenant_id, workspace_id, email_fingerprint);

-- Correct: Partial index for active records
CREATE INDEX idx_tenant_active ON tenant(id) WHERE status = 'active';
```

### Query Patterns
```sql
-- Efficient tenant-scoped query
SELECT generate_external_id('ld_', id) as external_id, email_enc
FROM lead 
WHERE tenant_id = extract_internal_id('tn_123')
  AND workspace_id = extract_internal_id('ws_456');

-- Efficient pagination with BIGINT IDs
SELECT * FROM event 
WHERE tenant_id = 123 
  AND workspace_id = 456
  AND id > 1000  -- Cursor-based pagination
ORDER BY id 
LIMIT 100;
```

## Security Considerations

### ID Enumeration Prevention
While BIGINT IDs are sequential, implement proper authorization:

```typescript
// Always verify tenant access before ID operations
async function getLeadById(leadId: LeadId, tenantId: TenantId): Promise<Lead> {
  const internalLeadId = extractInternalId(leadId);
  const internalTenantId = extractInternalId(tenantId);
  
  const lead = await db.lead.findFirst({
    where: {
      id: internalLeadId,
      tenant_id: internalTenantId  // Prevent cross-tenant access
    }
  });
  
  if (!lead) {
    throw new Error('Lead not found or access denied');
  }
  
  return lead;
}
```

### Rate Limiting by Tenant
Use tenant IDs for rate limiting:

```typescript
// Rate limit by tenant to prevent abuse
const rateLimitKey = `api_calls:${tenantId}:${windowStart}`;
```

## Testing Strategies

### Unit Tests for ID Functions
```sql
-- Test external ID generation
SELECT generate_external_id('tn_', 123) = 'tn_123';

-- Test internal ID extraction  
SELECT extract_internal_id('tn_123') = 123;

-- Test invalid format handling
SELECT extract_internal_id('invalid_format'); -- Should raise exception
```

### Integration Tests
```typescript
describe('ID Strategy', () => {
  test('should generate consistent external IDs', () => {
    const tenant = await createTenant({ name: 'Test Tenant' });
    expect(tenant.external_id).toMatch(/^tn_\d+$/);
  });
  
  test('should prevent cross-tenant access', async () => {
    const tenant1 = await createTenant({ name: 'Tenant 1' });
    const tenant2 = await createTenant({ name: 'Tenant 2' });
    
    const lead = await createLead({ tenant_id: tenant1.id });
    
    // Should fail when accessing from different tenant
    await expect(
      getLeadById(lead.external_id, tenant2.external_id)
    ).rejects.toThrow('Lead not found or access denied');
  });
});
```

## Monitoring and Debugging

### ID Tracking in Logs
Always log external IDs for better debugging:

```typescript
logger.info('Processing lead', {
  lead_id: 'ld_123',
  tenant_id: 'tn_456', 
  workspace_id: 'ws_789'
});
```

### Database Monitoring
```sql
-- Monitor ID sequence usage
SELECT schemaname, sequencename, last_value 
FROM pg_sequences 
WHERE sequencename LIKE '%_id_seq';

-- Check for ID gaps (potential issues)
SELECT id, id - LAG(id) OVER (ORDER BY id) as gap
FROM tenant 
WHERE id - LAG(id) OVER (ORDER BY id) > 1;
```

This ID strategy ensures type safety, performance, and maintainability across the entire Mercurio system.
# Database Migration Guidelines

## Overview

This document establishes comprehensive guidelines for database migrations in the Mercurio project, ensuring consistency, traceability, and reliability across all database schema changes.

## Migration Naming Conventions

### File Structure
All migrations must follow this exact naming pattern:
```
YYYYMMDD_HHMMSS_descricao_da_mudanca/
├── migration.sql
└── (optional) rollback.sql
```

### Naming Rules
1. **Timestamp Format**: `YYYYMMDD_HHMMSS` using UTC time
2. **Description**: Use snake_case, be descriptive but concise
3. **Language**: Portuguese for consistency with codebase
4. **Max Length**: Keep total filename under 100 characters

### Examples
```
20250823_143000_create_tenant_tables/
20250823_143500_add_workspace_indexes/
20250823_144000_create_identity_system/
20250824_090000_add_event_partitioning/
```

## Migration Content Guidelines

### File Header
Every migration must start with a descriptive comment:
```sql
-- Migration: Create tenant and workspace tables
-- Purpose: Establish multi-tenant foundation with proper isolation
-- Author: [Developer Name]
-- Date: 2025-08-23
-- Requirements: 1.1, 1.2, 1.3

-- Forward migration
```

### SQL Structure
1. **Transaction Wrapping**: All migrations should be wrapped in transactions when possible
2. **Idempotent Operations**: Use `IF NOT EXISTS` where applicable
3. **Proper Ordering**: Create tables before indexes, constraints after data
4. **Comments**: Explain complex operations and business logic

### Example Migration Structure
```sql
-- Migration: Create core tenancy tables
-- Purpose: Establish multi-tenant foundation
-- Requirements: 3.1, 3.2, 3.3

BEGIN;

-- Create tenant table
CREATE TABLE IF NOT EXISTS tenant (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workspace table with tenant relationship
CREATE TABLE IF NOT EXISTS workspace (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique workspace names per tenant
    UNIQUE(tenant_id, name)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenant(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_workspace_tenant ON workspace(tenant_id);

-- Add comments for documentation
COMMENT ON TABLE tenant IS 'Top-level tenant organization';
COMMENT ON TABLE workspace IS 'Workspace within a tenant for data isolation';
COMMENT ON COLUMN tenant.status IS 'Tenant status: active, suspended, or deleted';

COMMIT;
```

## ID Strategy and Prefixing Rules

### Internal IDs
- **Type**: `BIGSERIAL` (BIGINT with auto-increment)
- **Usage**: All internal primary keys and foreign keys
- **Benefits**: Compact storage, fast joins, sequential ordering

### External ID Prefixes
When exposing IDs to external systems or APIs, use prefixed format:

| Entity | Prefix | Example | Internal ID |
|--------|--------|---------|-------------|
| Tenant | `tn_` | `tn_123` | 123 |
| Workspace | `ws_` | `ws_456` | 456 |
| Lead | `ld_` | `ld_789` | 789 |
| Anonymous ID | `a_` | `a_abc123` | Client-generated |
| Session | `s_` | `s_def456` | Client-generated |
| API Key | `ak_` | `ak_ghi789` | 789 |
| Funnel | `fn_` | `fn_101` | 101 |

### Implementation Example
```sql
-- Function to generate external ID
CREATE OR REPLACE FUNCTION generate_external_id(prefix TEXT, internal_id BIGINT)
RETURNS TEXT AS $$
BEGIN
    RETURN prefix || internal_id::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage in application queries
SELECT 
    generate_external_id('tn_', id) as external_id,
    name,
    status
FROM tenant 
WHERE status = 'active';
```

## Rollback Procedures

### Automatic Rollback
Prisma provides automatic rollback for failed migrations within transactions:
```bash
# If migration fails, Prisma automatically rolls back
npx prisma migrate dev
```

### Manual Rollback
For complex migrations, create explicit rollback procedures:

#### rollback.sql Example
```sql
-- Rollback: Remove tenant and workspace tables
-- This reverses migration 20250823_143000_create_tenant_tables

BEGIN;

-- Drop indexes first
DROP INDEX IF EXISTS idx_workspace_tenant;
DROP INDEX IF EXISTS idx_tenant_status;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS workspace;
DROP TABLE IF EXISTS tenant;

-- Drop functions if created
DROP FUNCTION IF EXISTS generate_external_id(TEXT, BIGINT);

COMMIT;
```

### Rollback Best Practices
1. **Test Rollbacks**: Always test rollback procedures in development
2. **Data Preservation**: Consider data backup before destructive rollbacks
3. **Dependency Order**: Drop dependent objects first (indexes, constraints, tables)
4. **Documentation**: Document what data will be lost in rollback

## Migration Execution Process

### Development Workflow
```bash
# 1. Create new migration
npx prisma migrate dev --name create_tenant_tables

# 2. Review generated SQL
cat prisma/migrations/[timestamp]_create_tenant_tables/migration.sql

# 3. Test migration
npx prisma migrate dev

# 4. Verify schema
npx prisma db pull
```

### Production Deployment
```bash
# 1. Backup database
pg_dump production_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Deploy migration
npx prisma migrate deploy

# 3. Verify deployment
npx prisma migrate status
```

## Multi-Tenant Considerations

### Tenant Isolation Rules
Every domain table must include tenant isolation:
```sql
CREATE TABLE example_table (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenant(id),
    workspace_id BIGINT NOT NULL REFERENCES workspace(id),
    -- other columns
    
    -- Composite index for tenant isolation
    INDEX idx_example_tenant_workspace (tenant_id, workspace_id)
);
```

### Index Strategy
All indexes on tenant data must start with tenant_id and workspace_id:
```sql
-- Correct: Tenant-first indexing
CREATE INDEX idx_events_tenant_timestamp ON event(tenant_id, workspace_id, timestamp);

-- Incorrect: Non-tenant-aware indexing
CREATE INDEX idx_events_timestamp ON event(timestamp); -- Missing tenant isolation
```

## Performance Guidelines

### Index Creation
- Create indexes CONCURRENTLY in production to avoid locks
- Use partial indexes for filtered queries
- Consider composite indexes for multi-column queries

```sql
-- Concurrent index creation for production
CREATE INDEX CONCURRENTLY idx_event_tenant_timestamp 
ON event(tenant_id, workspace_id, timestamp DESC);

-- Partial index for active records only
CREATE INDEX idx_tenant_active 
ON tenant(id) WHERE status = 'active';
```

### Large Table Migrations
For tables with significant data:
1. **Batch Processing**: Process changes in batches
2. **Background Jobs**: Use background processes for data migrations
3. **Monitoring**: Monitor migration progress and performance

## Validation and Testing

### Pre-Migration Checks
```sql
-- Verify current schema state
SELECT schemaname, tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check for blocking locks
SELECT * FROM pg_locks WHERE NOT granted;
```

### Post-Migration Validation
```sql
-- Verify table creation
\dt

-- Check constraints
SELECT conname, contype FROM pg_constraint WHERE conrelid = 'tenant'::regclass;

-- Validate data integrity
SELECT COUNT(*) FROM tenant;
SELECT COUNT(*) FROM workspace;
```

## Common Patterns and Examples

### Adding New Columns
```sql
-- Add column with default value
ALTER TABLE tenant 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Update existing records if needed
UPDATE tenant SET timezone = 'America/Sao_Paulo' WHERE timezone = 'UTC';
```

### Creating Relationships
```sql
-- Add foreign key with proper naming
ALTER TABLE workspace 
ADD CONSTRAINT fk_workspace_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;
```

### Modifying Existing Columns
```sql
-- Change column type safely
ALTER TABLE tenant ALTER COLUMN name TYPE TEXT;

-- Add constraints
ALTER TABLE tenant ADD CONSTRAINT chk_tenant_name_length 
CHECK (LENGTH(name) >= 2 AND LENGTH(name) <= 255);
```

## Troubleshooting

### Common Issues
1. **Lock Timeouts**: Use CONCURRENTLY for index creation
2. **Constraint Violations**: Validate data before adding constraints
3. **Dependency Errors**: Check foreign key relationships
4. **Permission Issues**: Ensure proper database user permissions

### Recovery Procedures
```bash
# Reset migration state (development only)
npx prisma migrate reset

# Mark migration as applied without running
npx prisma migrate resolve --applied [migration_name]

# Force migration state
npx prisma db push --force-reset
```

This documentation ensures all database changes follow consistent patterns and maintain the integrity of our multi-tenant system.
# Database Migration Examples

## Overview

This document provides practical examples of database migrations following the Mercurio guidelines, including proper structure, rollback procedures, and common scenarios.

## Basic Migration Structure

### Example 1: Creating Core Tables

#### File: `20250823_143000_create_tenant_tables/migration.sql`
```sql
-- Migration: Create tenant and workspace tables
-- Purpose: Establish multi-tenant foundation with proper isolation
-- Author: Development Team
-- Date: 2025-08-23
-- Requirements: 3.1, 3.2, 3.3

BEGIN;

-- Create tenant table
CREATE TABLE tenant (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workspace table with tenant relationship
CREATE TABLE workspace (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique workspace names per tenant
    UNIQUE(tenant_id, name)
);

-- Create API key table for workspace authentication
CREATE TABLE api_key (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    scopes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure unique key names per workspace
    UNIQUE(workspace_id, name)
);

-- Create indexes for efficient queries
CREATE INDEX idx_tenant_status ON tenant(status) WHERE status = 'active';
CREATE INDEX idx_workspace_tenant ON workspace(tenant_id);
CREATE INDEX idx_api_key_workspace ON api_key(workspace_id);
CREATE INDEX idx_api_key_hash ON api_key(key_hash) WHERE revoked_at IS NULL;

-- Add table comments for documentation
COMMENT ON TABLE tenant IS 'Top-level tenant organization - external ID: tn_{id}';
COMMENT ON TABLE workspace IS 'Workspace within a tenant for data isolation - external ID: ws_{id}';
COMMENT ON TABLE api_key IS 'API keys for workspace authentication - external ID: ak_{id}';

-- Add column comments
COMMENT ON COLUMN tenant.status IS 'Tenant status: active, suspended, or deleted';
COMMENT ON COLUMN api_key.key_hash IS 'bcrypt hash of the API key';
COMMENT ON COLUMN api_key.scopes IS 'JSON array of permitted scopes';

COMMIT;
```

#### File: `20250823_143000_create_tenant_tables/rollback.sql`
```sql
-- Rollback: Remove tenant and workspace tables
-- This reverses migration 20250823_143000_create_tenant_tables

BEGIN;

-- Drop indexes first
DROP INDEX IF EXISTS idx_api_key_hash;
DROP INDEX IF EXISTS idx_api_key_workspace;
DROP INDEX IF EXISTS idx_workspace_tenant;
DROP INDEX IF EXISTS idx_tenant_status;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS api_key;
DROP TABLE IF EXISTS workspace;
DROP TABLE IF EXISTS tenant;

COMMIT;
```

### Example 2: Creating Identity System

#### File: `20250823_144000_create_identity_system/migration.sql`
```sql
-- Migration: Create identity system tables
-- Purpose: Support anonymous visitors and identified leads with secure PII handling
-- Author: Development Team  
-- Date: 2025-08-23
-- Requirements: 4.1, 4.2, 4.3, 4.4, 4.5

BEGIN;

-- Create visitor table for anonymous tracking
CREATE TABLE visitor (
    anonymous_id VARCHAR(50) PRIMARY KEY CHECK (anonymous_id ~ '^a_[a-zA-Z0-9]{12}$'),
    tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    workspace_id BIGINT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_utm JSONB,
    last_utm JSONB,
    last_device JSONB,
    last_geo JSONB
);

-- Create lead table for identified users
CREATE TABLE lead (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    workspace_id BIGINT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    email_enc TEXT, -- AES encrypted email
    email_fingerprint VARCHAR(64), -- HMAC-SHA256 for matching
    phone_enc TEXT, -- AES encrypted phone
    phone_fingerprint VARCHAR(64), -- HMAC-SHA256 for matching
    first_name_enc TEXT, -- AES encrypted first name
    last_name_enc TEXT, -- AES encrypted last name
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure at least one identifier is present
    CHECK (email_enc IS NOT NULL OR phone_enc IS NOT NULL)
);

-- Create identity link table for anonymous-to-lead mapping
CREATE TABLE identity_link (
    tenant_id BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    workspace_id BIGINT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    anonymous_id VARCHAR(50) NOT NULL REFERENCES visitor(anonymous_id) ON DELETE CASCADE,
    lead_id BIGINT NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    PRIMARY KEY (tenant_id, workspace_id, anonymous_id, lead_id)
);

-- Create indexes for efficient tenant-scoped queries
CREATE INDEX idx_visitor_tenant_workspace ON visitor(tenant_id, workspace_id);
CREATE INDEX idx_visitor_last_seen ON visitor(tenant_id, workspace_id, last_seen_at DESC);

CREATE INDEX idx_lead_tenant_workspace ON lead(tenant_id, workspace_id);
CREATE INDEX idx_lead_email_fingerprint ON lead(tenant_id, workspace_id, email_fingerprint) 
    WHERE email_fingerprint IS NOT NULL;
CREATE INDEX idx_lead_phone_fingerprint ON lead(tenant_id, workspace_id, phone_fingerprint) 
    WHERE phone_fingerprint IS NOT NULL;

CREATE INDEX idx_identity_link_anonymous ON identity_link(tenant_id, workspace_id, anonymous_id);
CREATE INDEX idx_identity_link_lead ON identity_link(tenant_id, workspace_id, lead_id);

-- Add table comments
COMMENT ON TABLE visitor IS 'Anonymous visitors tracked by client-generated ID - external ID: anonymous_id';
COMMENT ON TABLE lead IS 'Identified leads with encrypted PII - external ID: ld_{id}';
COMMENT ON TABLE identity_link IS 'Links between anonymous visitors and identified leads';

-- Add column comments
COMMENT ON COLUMN visitor.anonymous_id IS 'Client-generated ID with format a_{12_chars}';
COMMENT ON COLUMN lead.email_fingerprint IS 'HMAC-SHA256 of email for secure matching';
COMMENT ON COLUMN lead.phone_fingerprint IS 'HMAC-SHA256 of phone for secure matching';
COMMENT ON COLUMN identity_link.confidence_score IS 'Matching confidence from 0.0 to 1.0';

COMMIT;
```

### Example 3: Adding Indexes and Constraints

#### File: `20250823_145000_add_event_system_indexes/migration.sql`
```sql
-- Migration: Add optimized indexes for event system
-- Purpose: Improve query performance for event analytics
-- Author: Development Team
-- Date: 2025-08-23
-- Requirements: 5.4, 5.5

BEGIN;

-- Add composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_event_tenant_timestamp 
ON event(tenant_id, workspace_id, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_event_anonymous_timestamp 
ON event(tenant_id, workspace_id, anonymous_id, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_event_lead_timestamp 
ON event(tenant_id, workspace_id, lead_id, timestamp DESC) 
WHERE lead_id IS NOT NULL;

-- Add partial index for specific event types
CREATE INDEX CONCURRENTLY idx_event_conversion 
ON event(tenant_id, workspace_id, timestamp DESC) 
WHERE event_name IN ('purchase', 'signup', 'conversion');

-- Add GIN index for JSONB properties search
CREATE INDEX CONCURRENTLY idx_event_props_gin 
ON event USING GIN (props) 
WHERE props IS NOT NULL;

-- Add index for session-based queries
CREATE INDEX CONCURRENTLY idx_event_session 
ON event(tenant_id, workspace_id, session_id, timestamp) 
WHERE session_id IS NOT NULL;

COMMIT;
```

## Complex Migration Scenarios

### Example 4: Data Migration with Transformation

#### File: `20250824_090000_migrate_legacy_user_data/migration.sql`
```sql
-- Migration: Migrate legacy user data to new identity system
-- Purpose: Transform existing user table to visitor/lead structure
-- Author: Development Team
-- Date: 2025-08-24
-- Requirements: 4.1, 4.2, 4.3

BEGIN;

-- Create temporary table for data transformation
CREATE TEMP TABLE user_migration_temp AS
SELECT 
    id,
    tenant_id,
    workspace_id,
    email,
    phone,
    first_name,
    last_name,
    anonymous_id,
    created_at
FROM legacy_user_table
WHERE migrated_at IS NULL;

-- Insert visitors for users with anonymous_id
INSERT INTO visitor (anonymous_id, tenant_id, workspace_id, first_seen_at, last_seen_at)
SELECT DISTINCT
    anonymous_id,
    tenant_id, 
    workspace_id,
    created_at,
    created_at
FROM user_migration_temp
WHERE anonymous_id IS NOT NULL
ON CONFLICT (anonymous_id) DO NOTHING;

-- Insert leads for users with email or phone
INSERT INTO lead (tenant_id, workspace_id, email_enc, email_fingerprint, phone_enc, phone_fingerprint, first_name_enc, last_name_enc, created_at)
SELECT 
    tenant_id,
    workspace_id,
    CASE WHEN email IS NOT NULL THEN encrypt_pii(email) END,
    CASE WHEN email IS NOT NULL THEN hmac_sha256(email, get_hmac_key()) END,
    CASE WHEN phone IS NOT NULL THEN encrypt_pii(phone) END,
    CASE WHEN phone IS NOT NULL THEN hmac_sha256(phone, get_hmac_key()) END,
    CASE WHEN first_name IS NOT NULL THEN encrypt_pii(first_name) END,
    CASE WHEN last_name IS NOT NULL THEN encrypt_pii(last_name) END,
    created_at
FROM user_migration_temp
WHERE email IS NOT NULL OR phone IS NOT NULL;

-- Create identity links for users with both anonymous_id and lead data
INSERT INTO identity_link (tenant_id, workspace_id, anonymous_id, lead_id, linked_at)
SELECT 
    umt.tenant_id,
    umt.workspace_id,
    umt.anonymous_id,
    l.id,
    umt.created_at
FROM user_migration_temp umt
JOIN lead l ON (
    l.tenant_id = umt.tenant_id 
    AND l.workspace_id = umt.workspace_id
    AND (
        (umt.email IS NOT NULL AND l.email_fingerprint = hmac_sha256(umt.email, get_hmac_key()))
        OR (umt.phone IS NOT NULL AND l.phone_fingerprint = hmac_sha256(umt.phone, get_hmac_key()))
    )
)
WHERE umt.anonymous_id IS NOT NULL;

-- Mark legacy records as migrated
UPDATE legacy_user_table 
SET migrated_at = NOW()
WHERE id IN (SELECT id FROM user_migration_temp);

-- Log migration statistics
INSERT INTO migration_log (migration_name, records_processed, completed_at)
VALUES ('migrate_legacy_user_data', (SELECT COUNT(*) FROM user_migration_temp), NOW());

COMMIT;
```

### Example 5: Schema Modification with Data Preservation

#### File: `20250824_100000_add_funnel_versioning/migration.sql`
```sql
-- Migration: Add versioning system to funnels
-- Purpose: Support draft/published states with immutable snapshots
-- Author: Development Team
-- Date: 2025-08-24
-- Requirements: 6.1, 6.2, 6.3

BEGIN;

-- Create funnel_version table
CREATE TABLE funnel_version (
    id BIGSERIAL PRIMARY KEY,
    funnel_id BIGINT NOT NULL REFERENCES funnel(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    state VARCHAR(20) DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'archived')),
    created_by BIGINT, -- Will reference user table when implemented
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(funnel_id, version)
);

-- Create funnel_publication table for immutable snapshots
CREATE TABLE funnel_publication (
    id BIGSERIAL PRIMARY KEY,
    funnel_id BIGINT NOT NULL REFERENCES funnel(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_days INTEGER DEFAULT 7 CHECK (window_days > 0),
    notes TEXT,
    snapshot_data JSONB NOT NULL -- Complete funnel definition at publication time
);

-- Migrate existing funnels to versioned structure
INSERT INTO funnel_version (funnel_id, version, state, created_at)
SELECT 
    id,
    1, -- First version
    'published', -- Assume existing funnels are published
    created_at
FROM funnel;

-- Create initial publications for existing funnels
INSERT INTO funnel_publication (funnel_id, version, published_at, notes, snapshot_data)
SELECT 
    f.id,
    1,
    f.created_at,
    'Initial migration from legacy funnel structure',
    jsonb_build_object(
        'funnel_id', f.id,
        'name', f.name,
        'description', f.description,
        'steps', COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'id', fs.id,
                    'order_index', fs.order_index,
                    'type', fs.type,
                    'label', fs.label
                )
                ORDER BY fs.order_index
            )
            FROM funnel_step fs 
            WHERE fs.funnel_id = f.id), 
            '[]'::jsonb
        )
    )
FROM funnel f;

-- Add foreign key from funnel_step to funnel_version instead of funnel
ALTER TABLE funnel_step 
ADD COLUMN funnel_version_id BIGINT REFERENCES funnel_version(id) ON DELETE CASCADE;

-- Update existing funnel_step records to reference the version
UPDATE funnel_step 
SET funnel_version_id = fv.id
FROM funnel_version fv
WHERE funnel_step.funnel_id = fv.funnel_id AND fv.version = 1;

-- Make funnel_version_id NOT NULL after data migration
ALTER TABLE funnel_step ALTER COLUMN funnel_version_id SET NOT NULL;

-- Drop old foreign key constraint
ALTER TABLE funnel_step DROP CONSTRAINT IF EXISTS funnel_step_funnel_id_fkey;
ALTER TABLE funnel_step DROP COLUMN funnel_id;

-- Create indexes for efficient queries
CREATE INDEX idx_funnel_version_funnel ON funnel_version(funnel_id, version DESC);
CREATE INDEX idx_funnel_version_state ON funnel_version(funnel_id, state) WHERE state = 'published';
CREATE INDEX idx_funnel_publication_funnel ON funnel_publication(funnel_id, published_at DESC);
CREATE INDEX idx_funnel_step_version ON funnel_step(funnel_version_id, order_index);

-- Add table comments
COMMENT ON TABLE funnel_version IS 'Versioned funnel definitions - external ID: fv_{id}';
COMMENT ON TABLE funnel_publication IS 'Immutable funnel snapshots for analytics - external ID: fp_{id}';

COMMIT;
```

## Rollback Examples

### Complex Rollback with Data Preservation

#### File: `20250824_100000_add_funnel_versioning/rollback.sql`
```sql
-- Rollback: Remove funnel versioning system
-- This reverses migration 20250824_100000_add_funnel_versioning
-- WARNING: This will lose version history but preserve current funnel state

BEGIN;

-- Re-add funnel_id column to funnel_step
ALTER TABLE funnel_step ADD COLUMN funnel_id BIGINT;

-- Restore funnel_id references from version data
UPDATE funnel_step 
SET funnel_id = fv.funnel_id
FROM funnel_version fv
WHERE funnel_step.funnel_version_id = fv.id;

-- Make funnel_id NOT NULL and add foreign key
ALTER TABLE funnel_step ALTER COLUMN funnel_id SET NOT NULL;
ALTER TABLE funnel_step 
ADD CONSTRAINT funnel_step_funnel_id_fkey 
FOREIGN KEY (funnel_id) REFERENCES funnel(id) ON DELETE CASCADE;

-- Drop version-related columns
ALTER TABLE funnel_step DROP COLUMN funnel_version_id;

-- Drop indexes
DROP INDEX IF EXISTS idx_funnel_step_version;
DROP INDEX IF EXISTS idx_funnel_publication_funnel;
DROP INDEX IF EXISTS idx_funnel_version_state;
DROP INDEX IF EXISTS idx_funnel_version_funnel;

-- Drop tables in dependency order
DROP TABLE IF EXISTS funnel_publication;
DROP TABLE IF EXISTS funnel_version;

-- Log rollback
INSERT INTO migration_log (migration_name, records_processed, completed_at, notes)
VALUES ('rollback_add_funnel_versioning', 
        (SELECT COUNT(*) FROM funnel_step), 
        NOW(),
        'Rolled back funnel versioning - version history lost');

COMMIT;
```

## Testing Migration Examples

### Pre-Migration Validation
```sql
-- Check current schema state
SELECT 
    schemaname, 
    tablename, 
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify data counts before migration
SELECT 
    'tenant' as table_name, COUNT(*) as record_count FROM tenant
UNION ALL
SELECT 
    'workspace' as table_name, COUNT(*) as record_count FROM workspace
UNION ALL  
SELECT 
    'funnel' as table_name, COUNT(*) as record_count FROM funnel;
```

### Post-Migration Validation
```sql
-- Verify new tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('funnel_version', 'funnel_publication');

-- Check data integrity
SELECT 
    f.id as funnel_id,
    f.name,
    COUNT(fv.id) as version_count,
    COUNT(fp.id) as publication_count
FROM funnel f
LEFT JOIN funnel_version fv ON f.id = fv.funnel_id
LEFT JOIN funnel_publication fp ON f.id = fp.funnel_id
GROUP BY f.id, f.name
ORDER BY f.id;

-- Verify foreign key relationships
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('funnel_version', 'funnel_publication', 'funnel_step');
```

## Performance Testing

### Index Usage Verification
```sql
-- Check if indexes are being used
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM funnel_version 
WHERE funnel_id = 123 AND state = 'published';

-- Monitor index usage over time
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('funnel_version', 'funnel_publication')
ORDER BY idx_scan DESC;
```

These examples demonstrate proper migration structure, data preservation techniques, and comprehensive rollback procedures following Mercurio's database guidelines.
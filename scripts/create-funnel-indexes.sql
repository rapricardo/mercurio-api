-- Script to create funnel performance indexes one by one
-- Run each command separately to use CONCURRENTLY

-- Index for funnel configuration queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funnel_tenant_workspace_created 
ON funnel (tenant_id, workspace_id, created_at) 
WHERE archived_at IS NULL;

-- Index for event-to-funnel matching  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_funnel_matching 
ON event (tenant_id, workspace_id, event_name, timestamp) 
INCLUDE (anonymous_id, lead_id, session_id, page, props);

-- Index for funnel step analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funnel_step_version_order
ON funnel_step (funnel_version_id, order_index, type);

-- Index for funnel step matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funnel_step_match_kind
ON funnel_step_match (funnel_step_id, kind);

-- Index for published funnel versions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funnel_version_published
ON funnel_version (funnel_id, state, created_at)
WHERE state = 'published';

-- Index for active publications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funnel_publication_active
ON funnel_publication (funnel_id, published_at, window_days);

-- Index for user progression analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funnel_user_state_progression
ON funnel_user_state (tenant_id, workspace_id, funnel_id, current_step_index, status, last_activity_at);

-- Index for conversion analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funnel_user_state_conversion
ON funnel_user_state (tenant_id, workspace_id, funnel_id, completed_at, conversion_time_seconds)
WHERE status = 'completed';

-- Index for abandoned users
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funnel_user_state_abandoned
ON funnel_user_state (tenant_id, workspace_id, funnel_id, exit_step_index, exited_at)
WHERE status IN ('exited', 'abandoned');
-- Materialized views for funnel analysis performance
-- These views pre-calculate common funnel metrics

-- Daily funnel step completions materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_funnel_step_completions AS
SELECT 
    fus.tenant_id,
    fus.workspace_id,
    fus.funnel_id,
    fus.current_step_index,
    DATE(fus.last_activity_at) as activity_date,
    COUNT(*) as users_at_step,
    COUNT(CASE WHEN fus.status = 'completed' THEN 1 END) as completions,
    COUNT(CASE WHEN fus.status = 'exited' THEN 1 END) as exits,
    AVG(fus.conversion_time_seconds) as avg_conversion_time
FROM funnel_user_state fus
WHERE fus.last_activity_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 
    fus.tenant_id, 
    fus.workspace_id, 
    fus.funnel_id, 
    fus.current_step_index,
    DATE(fus.last_activity_at);

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_daily_funnel_completions_lookup
ON mv_daily_funnel_step_completions (tenant_id, workspace_id, funnel_id, activity_date);

-- Funnel conversion summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_funnel_conversion_summary AS
SELECT 
    f.tenant_id,
    f.workspace_id,
    f.id as funnel_id,
    f.name as funnel_name,
    COUNT(DISTINCT fus.anonymous_id) as total_users,
    COUNT(CASE WHEN fus.status = 'completed' THEN 1 END) as conversions,
    COUNT(CASE WHEN fus.status = 'exited' THEN 1 END) as exits,
    COUNT(CASE WHEN fus.status = 'abandoned' THEN 1 END) as abandoned,
    ROUND(
        COUNT(CASE WHEN fus.status = 'completed' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(DISTINCT fus.anonymous_id), 0), 2
    ) as conversion_rate,
    AVG(CASE WHEN fus.status = 'completed' THEN fus.conversion_time_seconds END) as avg_conversion_time,
    MIN(fus.entered_at) as first_entry,
    MAX(fus.last_activity_at) as last_activity
FROM funnel f
LEFT JOIN funnel_user_state fus ON f.id = fus.funnel_id
WHERE f.archived_at IS NULL
GROUP BY f.tenant_id, f.workspace_id, f.id, f.name;

-- Create index on conversion summary
CREATE INDEX IF NOT EXISTS idx_mv_funnel_conversion_summary_lookup
ON mv_funnel_conversion_summary (tenant_id, workspace_id, funnel_id);

-- User progression paths materialized view (for advanced analysis)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_progression_paths AS
SELECT 
    fus.tenant_id,
    fus.workspace_id,
    fus.funnel_id,
    fus.anonymous_id,
    fus.lead_id,
    fus.current_step_index,
    fus.exit_step_index,
    fus.status,
    fus.entered_at,
    fus.completed_at,
    fus.conversion_time_seconds,
    -- Calculate step progression rate
    CASE 
        WHEN fus.current_step_index IS NOT NULL AND fus.current_step_index > 0 
        THEN fus.current_step_index
        ELSE 0 
    END as steps_completed
FROM funnel_user_state fus
WHERE fus.entered_at >= CURRENT_DATE - INTERVAL '30 days';

-- Create index on progression paths
CREATE INDEX IF NOT EXISTS idx_mv_user_progression_paths_lookup
ON mv_user_progression_paths (tenant_id, workspace_id, funnel_id, status);
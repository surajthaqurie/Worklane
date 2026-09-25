-- db/migrations/036_create_dashboard_layouts.sql
-- Worklane Phase 20 — Dashboard Widget System Layout Persistence

CREATE TABLE IF NOT EXISTS dashboard_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_user_global 
    ON dashboard_layouts(user_id) 
    WHERE project_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_user_project 
    ON dashboard_layouts(user_id, project_id) 
    WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_project_id 
    ON dashboard_layouts(project_id);

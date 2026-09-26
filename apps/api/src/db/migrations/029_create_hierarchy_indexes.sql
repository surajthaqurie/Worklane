-- db/migrations/029_create_hierarchy_indexes.sql

-- Performance indexes for recursive CTE hierarchy tree lookups and rollups
CREATE INDEX IF NOT EXISTS idx_work_items_parent_project ON work_items(project_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_work_items_parent_id ON work_items(parent_id);

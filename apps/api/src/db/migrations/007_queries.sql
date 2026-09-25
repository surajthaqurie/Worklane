-- db/migrations/007_queries.sql
-- Azure-Boards-style saved queries: personal + shared, JSONB definition

CREATE TABLE IF NOT EXISTS saved_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder VARCHAR(100),
  definition JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_queries_project_id ON saved_queries(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_shared ON saved_queries(project_id, is_shared);
CREATE INDEX IF NOT EXISTS idx_saved_queries_created_by ON saved_queries(created_by);

-- Seed shared default queries (Azure-style templates) for every project
INSERT INTO saved_queries (project_id, name, description, is_shared, created_by, definition, sort_order)
SELECT p.id, q.name, q.description, TRUE, p.created_by, q.definition::jsonb, q.sort_order
FROM projects p
CROSS JOIN (
  VALUES
    ('Work Items (All)', 'All work items in this project.', '{"filters":[],"sortBy":"key","sortOrder":"asc"}'::text, 1),
    ('Assigned to Me', 'Work items assigned to the current user.', '{"filters":[{"field":"assignedTo","operator":"equals","value":"@me","logicalOperator":"AND"}],"sortBy":"key","sortOrder":"asc"}'::text, 2),
    ('Created by Me', 'Work items created by the current user.', '{"filters":[{"field":"createdBy","operator":"equals","value":"@me","logicalOperator":"AND"}],"sortBy":"key","sortOrder":"asc"}'::text, 3),
    ('Unfinished Backlog', 'Work items not yet in a sprint.', '{"filters":[{"field":"sprintId","operator":"isEmpty","value":"","logicalOperator":"AND"}],"sortBy":"key","sortOrder":"asc"}'::text, 4)
) AS q(name, description, definition, sort_order)
ON CONFLICT DO NOTHING;
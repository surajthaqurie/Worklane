-- db/migrations/006_work_item_states_and_sprint_history.sql
-- Azure-board style configurable workflow states + sprint audit trail

-- 1. Custom, per-project state workflow (default: To Do -> In Progress -> Done)
CREATE TABLE IF NOT EXISTS work_item_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  key VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#94A3B8',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_work_item_states_project_order
  ON work_item_states(project_id, sort_order);

-- 2. Widen state column for longer custom keys and drop the static default
-- (the app chooses the project's first/default state explicitly on insert)
ALTER TABLE work_items ALTER COLUMN state TYPE VARCHAR(50);
ALTER TABLE work_items ALTER COLUMN state DROP DEFAULT;

-- 3. Seed the default workflow for every existing project
INSERT INTO work_item_states (project_id, name, key, color, sort_order, is_done, is_default)
SELECT p.id, s.name, s.key, s.color, s.sort_order, s.is_done, TRUE
FROM projects p
CROSS JOIN (
  VALUES
    ('To Do', 'TODO', '#94A3B8', 0, FALSE),
    ('In Progress', 'IN_PROGRESS', '#3B82F6', 1, FALSE),
    ('Done', 'DONE', '#22C55E', 2, TRUE)
) AS s(name, key, color, sort_order, is_done)
ON CONFLICT (project_id, key) DO NOTHING;

-- Safety: normalise any legacy state value that has no matching workflow entry
UPDATE work_items w
SET state = 'TODO'
WHERE NOT EXISTS (
  SELECT 1 FROM work_item_states s
  WHERE s.project_id = w.project_id AND s.key = w.state
);

-- 4. Enforce every work item state belongs to the project's workflow
ALTER TABLE work_items
  ADD CONSTRAINT fk_work_items_state
  FOREIGN KEY (project_id, state) REFERENCES work_item_states(project_id, key);

-- 5. Sprint audit log (immutable history is preserved even after delete)
CREATE TABLE IF NOT EXISTS sprint_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  field VARCHAR(50),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sprint_history_sprint_id ON sprint_history(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_history_user_id ON sprint_history(user_id);

-- 6. Keep history of deleted work items (log DELETED before delete)
ALTER TABLE work_item_history DROP CONSTRAINT work_item_history_work_item_id_fkey;
ALTER TABLE work_item_history ALTER COLUMN work_item_id DROP NOT NULL;
ALTER TABLE work_item_history
  ADD CONSTRAINT work_item_history_work_item_id_fkey
  FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;
-- db/migrations/002_create_work_items.sql

ALTER TABLE projects ADD COLUMN next_work_item_seq INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  seq_no INTEGER NOT NULL,
  parent_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  state VARCHAR(20) NOT NULL DEFAULT 'TODO',
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(project_id, seq_no)
);

CREATE INDEX idx_work_items_project_id ON work_items(project_id);
CREATE INDEX idx_work_items_state ON work_items(state);
CREATE INDEX idx_work_items_priority ON work_items(priority);
CREATE INDEX idx_work_items_assigned_to ON work_items(assigned_to);

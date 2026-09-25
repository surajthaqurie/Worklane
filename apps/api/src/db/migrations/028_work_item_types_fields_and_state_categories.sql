-- db/migrations/028_work_item_types_fields_and_state_categories.sql

-- 1. Add category column to work_item_states table
ALTER TABLE work_item_states
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'PROPOSED';

-- Seed/backfill category for existing states based on explicit rules (not string inference at runtime)
UPDATE work_item_states SET category = 'PROPOSED' WHERE key IN ('TODO', 'BACKLOG', 'NEW', 'PROPOSED');
UPDATE work_item_states SET category = 'IN_PROGRESS' WHERE key IN ('IN_PROGRESS', 'DOING', 'ACTIVE', 'DEVELOPMENT');
UPDATE work_item_states SET category = 'RESOLVED' WHERE key IN ('RESOLVED', 'REVIEW', 'QA', 'TESTING');
UPDATE work_item_states SET category = 'COMPLETED' WHERE key IN ('DONE', 'CLOSED', 'COMPLETED') OR is_done = TRUE;

-- Enforce valid category values
ALTER TABLE work_item_states
  DROP CONSTRAINT IF EXISTS chk_work_item_states_category;

ALTER TABLE work_item_states
  ADD CONSTRAINT chk_work_item_states_category
  CHECK (category IN ('PROPOSED', 'IN_PROGRESS', 'RESOLVED', 'COMPLETED'));

-- 2. Add typed fields to work_items table
ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS remaining_work NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS completed_work NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS target_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Constraints for severity and non-negative work values
ALTER TABLE work_items
  DROP CONSTRAINT IF EXISTS chk_work_items_severity;

ALTER TABLE work_items
  ADD CONSTRAINT chk_work_items_severity
  CHECK (severity IS NULL OR severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

ALTER TABLE work_items
  DROP CONSTRAINT IF EXISTS chk_work_items_remaining_work;

ALTER TABLE work_items
  ADD CONSTRAINT chk_work_items_remaining_work
  CHECK (remaining_work IS NULL OR remaining_work >= 0);

ALTER TABLE work_items
  DROP CONSTRAINT IF EXISTS chk_work_items_completed_work;

ALTER TABLE work_items
  ADD CONSTRAINT chk_work_items_completed_work
  CHECK (completed_work IS NULL OR completed_work >= 0);

-- 3. Indexes for queries & state category filtering
CREATE INDEX IF NOT EXISTS idx_work_item_states_category ON work_item_states(project_id, category);
CREATE INDEX IF NOT EXISTS idx_work_items_severity ON work_items(severity);
CREATE INDEX IF NOT EXISTS idx_work_items_dates ON work_items(start_date, target_date);

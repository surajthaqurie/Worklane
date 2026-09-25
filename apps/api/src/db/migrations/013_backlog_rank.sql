-- Migration 013: Add backlog_rank for fractional ordering within same parent
-- This enables stable, efficient sibling-level reordering without touching all rows.

ALTER TABLE work_items ADD COLUMN IF NOT EXISTS backlog_rank DOUBLE PRECISION;

-- Seed backlog_rank from backlog_order per parent group
UPDATE work_items wi
SET backlog_rank = sub.rn * 1000
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY backlog_order, seq_no) AS rn
  FROM work_items
) sub
WHERE wi.id = sub.id;

-- Fallback for any NULLs
UPDATE work_items SET backlog_rank = seq_no * 1000 WHERE backlog_rank IS NULL;

ALTER TABLE work_items ALTER COLUMN backlog_rank SET NOT NULL;
ALTER TABLE work_items ALTER COLUMN backlog_rank SET DEFAULT 0;

-- Index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_work_items_parent_rank ON work_items (project_id, parent_id, backlog_rank);

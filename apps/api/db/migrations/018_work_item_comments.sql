ALTER TABLE work_item_comments
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

UPDATE work_item_comments
SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);

ALTER TABLE work_item_comments
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX idx_work_item_comments_history
  ON work_item_comments (work_item_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

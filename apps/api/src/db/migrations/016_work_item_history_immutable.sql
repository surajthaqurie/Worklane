-- db/migrations/016_work_item_history_immutable.sql
-- Make work-item history a fully immutable, append-only audit log.
--
-- 1. Detach the FK so every record keeps its work_item_id after the work item
--    is deleted. Migration 006's ON DELETE SET NULL nulled the id on delete,
--    which orphaned the DELETED record and made the trail unattributable.
--    Auditable deletion requires the id to survive; history is only ever
--    queried through it.
ALTER TABLE work_item_history DROP CONSTRAINT work_item_history_work_item_id_fkey;

-- Clean up rows orphaned by the old SET NULL behaviour (they have no id and
-- can no longer be attributed to any work item).
DELETE FROM work_item_history WHERE work_item_id IS NULL;

-- Every record must reference a work item.
ALTER TABLE work_item_history ALTER COLUMN work_item_id SET NOT NULL;

-- 2. Enforce immutability at the database level. No application code path may
--    UPDATE or DELETE history rows; this trigger makes that impossible.
CREATE OR REPLACE FUNCTION prevent_work_item_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'work_item_history is an immutable audit log (%).', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS work_item_history_immutable ON work_item_history;
CREATE TRIGGER work_item_history_immutable
BEFORE UPDATE OR DELETE ON work_item_history
FOR EACH ROW EXECUTE FUNCTION prevent_work_item_history_mutation();

-- 3. Efficient chronological reads plus future audit/reporting queries.
CREATE INDEX IF NOT EXISTS idx_work_item_history_work_item_created
  ON work_item_history(work_item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_work_item_history_action
  ON work_item_history(action);
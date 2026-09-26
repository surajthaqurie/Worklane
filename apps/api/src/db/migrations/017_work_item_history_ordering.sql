-- db/migrations/017_work_item_history_ordering.sql
-- Give work-item history a statement-accurate insertion timestamp so batch
-- writes (several records created in one transaction/batch) still surface in
-- their true insertion order.
--
-- created_at (CURRENT_TIMESTAMP / now()) is the transaction timestamp — all
-- rows written inside one transaction share it, so it cannot order a batch.
-- inserted_at uses clock_timestamp(), which advances at statement evaluation
-- time, giving each appended record a monotonic, distinct timestamp.
ALTER TABLE work_item_history
  ADD COLUMN inserted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp();

DROP INDEX IF EXISTS idx_work_item_history_work_item_created;
CREATE INDEX idx_work_item_history_work_item_inserted
  ON work_item_history(work_item_id, inserted_at);
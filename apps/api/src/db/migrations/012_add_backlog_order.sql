-- apps/api/db/migrations/012_add_backlog_order.sql
ALTER TABLE work_items ADD COLUMN backlog_order DOUBLE PRECISION;
UPDATE work_items SET backlog_order = seq_no;
ALTER TABLE work_items ALTER COLUMN backlog_order SET NOT NULL;

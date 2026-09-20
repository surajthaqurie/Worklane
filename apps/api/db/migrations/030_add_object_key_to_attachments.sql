-- db/migrations/030_add_object_key_to_attachments.sql

-- Add object_key column for S3 object storage tracking
ALTER TABLE work_item_attachments ADD COLUMN IF NOT EXISTS object_key VARCHAR(512);

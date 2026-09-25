-- db/migrations/008_add_story_points.sql

ALTER TABLE work_items ADD COLUMN points INTEGER;

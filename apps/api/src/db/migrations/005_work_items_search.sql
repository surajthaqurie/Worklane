-- db/migrations/005_work_items_search.sql

-- Add extension for trigram matching if we want to use ILIKE efficiently, 
-- but a simple GIN index on tsvector is standard for text search in Postgres without extensions.
-- We can add a tsvector column for title and description.

ALTER TABLE work_items ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B')
) STORED;

CREATE INDEX idx_work_items_search_vector ON work_items USING GIN (search_vector);
CREATE INDEX idx_work_items_sprint_id ON work_items(sprint_id);

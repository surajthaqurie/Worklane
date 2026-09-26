-- Query execution history: powers "recent queries" and records the definition
-- each time a query runs (saved or ad-hoc) so it is auditable and reusable.

CREATE TABLE query_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  query_id UUID REFERENCES saved_queries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  definition JSONB,
  ran_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_query_runs_project_user_time ON query_runs(project_id, user_id, ran_at DESC);
CREATE INDEX idx_query_runs_query ON query_runs(query_id);

-- Repair the seeded "Unfinished Backlog" query: it referenced the pre-rename
-- 'sprintId' field (migration 009 renamed sprints to iterations), so the stored
-- filter matched items whose title was null instead of unbacklogged items.
UPDATE saved_queries
SET definition = jsonb_set(
    definition,
    '{filters}',
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN filter->>'field' = 'sprintId'
            THEN jsonb_set(filter, '{field}', '"iterationId"'::jsonb)
            ELSE filter
          END
        )
        FROM jsonb_array_elements(definition->'filters') AS filter
      ),
      '[]'::jsonb
    )
)
WHERE name = 'Unfinished Backlog'
  AND jsonb_typeof(definition->'filters') = 'array';
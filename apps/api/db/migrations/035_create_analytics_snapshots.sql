-- Worklane Phase 18 — Analytics & Reporting
-- Precomputed aggregation cache for heavy analytics metrics (velocity,
-- cumulative flow, cycle time, lead time). Background recalculation jobs
-- write snapshots here; read endpoints serve them when a fresh snapshot
-- matches the requested scope so large datasets don't get replayed on every
-- page load.
--
-- scope_key is a stable stringified-and-sorted serialisation of the metric's
-- query scope so an exact match can be looked up with a UNIQUE index.
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL,
  scope_key VARCHAR(500) NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  item_count INT NOT NULL DEFAULT 0,
  job_id UUID,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, kind, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_project_kind
  ON analytics_snapshots(project_id, kind, computed_at DESC);
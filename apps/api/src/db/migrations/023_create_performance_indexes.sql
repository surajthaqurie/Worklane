-- db/migrations/023_create_performance_indexes.sql
-- Performance optimization indexes for comments, sequence lookups, and backlog hierarchy.

-- Index for comment cursor-based history lookup (matching ASC order of getComments)
CREATE INDEX IF NOT EXISTS idx_work_item_comments_asc_history
  ON work_item_comments (work_item_id, created_at ASC, id ASC)
  WHERE deleted_at IS NULL;

-- Composite index for project-scoped sequence number search ("PROJ-123" / "123")
CREATE INDEX IF NOT EXISTS idx_work_items_project_seq
  ON work_items (project_id, seq_no);

-- Composite index for project-scoped parent & rank ordering
CREATE INDEX IF NOT EXISTS idx_work_items_project_parent_rank
  ON work_items (project_id, parent_id, backlog_rank);

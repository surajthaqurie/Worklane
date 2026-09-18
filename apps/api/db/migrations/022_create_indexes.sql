-- db/migrations/022_create_indexes.sql
-- Indexes for the Azure Boards access patterns on work_items, validated with
-- EXPLAIN ANALYZE against a ~200k-row seed (see index review).
--
-- Summary of changes vs. migrations 001-021:
--   * work_items: add composite project-prefix indexes for the common board /
--     backlog filters (project+state, project+type, project+assigned user),
--     plus area_id and parent_id single-column indexes. The latter two also
--     make ON DELETE SET NULL FK enforcement seek instead of seq-scanning.
--   * work_items: replace idx_work_items_sprint_id with a (iteration_id,
--     backlog_rank, seq_no) index so sprint pages read in rank order without
--     an explicit sort.
--   * work_item_history: add (created_at DESC) for the project-overview
--     "recent activity" query, and drop the single-column work_item_id index
--     left over from 004 — migration 017's (work_item_id, inserted_at)
--     composite already covers per-item lookups.
--   * work_item_attachments / notifications: add work_item_id indexes so the
--     existing ON DELETE CASCADE from work_items does indexed child lookups.

-- work_items: project-scoped board/backlog filters.
CREATE INDEX idx_work_items_project_state    ON work_items (project_id, state);
CREATE INDEX idx_work_items_project_type     ON work_items (project_id, type);
CREATE INDEX idx_work_items_project_assigned ON work_items (project_id, assigned_to);

-- work_items: ON DELETE SET NULL FK enforcement + area-filtered queries.
-- Deliberately single-column: area_id is globally unique (see 009), so the
-- composite would add nothing for queries while a bare area_id is required
-- for the areas -> work_items FK check.
CREATE INDEX idx_work_items_area_id ON work_items (area_id);

-- work_items: child-count / has_children lookups and the parent self-FK
-- (ON DELETE SET NULL). project_id is deliberately NOT included here; the
-- existing idx_work_items_parent_rank (project_id, parent_id, backlog_rank)
-- already covers project-scoped traversal.
CREATE INDEX idx_work_items_parent_id ON work_items (parent_id);

-- work_items: sprint pages ordered by backlog_rank; replaces the plain
-- iteration index from 003.
DROP INDEX IF EXISTS idx_work_items_sprint_id;
CREATE INDEX idx_work_items_iteration_rank ON work_items (iteration_id, backlog_rank, seq_no);

-- work_item_history: newest-first project activity (project overview).
CREATE INDEX idx_work_item_history_created_at ON work_item_history (created_at DESC);

-- work_item_history: drop the legacy 004 single-column index; migration 017's
-- (work_item_id, inserted_at) composite already serves per-item history.
DROP INDEX IF EXISTS idx_work_item_history_work_item_id;

-- Cascades from work_items deletes must not scan the child tables.
CREATE INDEX idx_work_item_attachments_work_item_id ON work_item_attachments (work_item_id);
CREATE INDEX idx_notifications_work_item_id         ON notifications (work_item_id);
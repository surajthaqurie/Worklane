-- Worklane Phase 16 — Board swimlanes & WIP enforcement
--
-- Boards gain a swimlane mode (none | assignee | priority | epic). The mode is
-- stored as a plain identifier so future custom grouping modes can be added by
-- extending the accepted enumeration/registry without a schema change (the
-- grouping logic itself lives in the API shape plus a per-type registry).

ALTER TABLE boards ADD COLUMN swimlane VARCHAR(20) NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_boards_swimlane ON boards(swimlane);
-- Migration 019: Add role to project_members
--
-- Adds a role column to project_members to support OWNER / ADMIN / MEMBER
-- project-level roles, enabling fine-grained permissions per action rather
-- than just binary membership checks.
--
-- OWNER: project creator; can do everything including delete.
-- ADMIN: elevated member; can manage members, teams, settings, delete work items.
-- MEMBER: standard access; can view, create, edit work items, change states, etc.

ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS role VARCHAR(20)
    NOT NULL
    DEFAULT 'MEMBER'
    CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER'));

-- Promote existing project creators to OWNER in their own project_members row.
-- If the creator doesn't have a project_members row yet, insert one.
INSERT INTO project_members (project_id, user_id, role)
SELECT p.id, p.created_by, 'OWNER'
FROM projects p
ON CONFLICT (project_id, user_id)
DO UPDATE SET role = 'OWNER';

-- Index to speed up role lookups during permission checks.
CREATE INDEX IF NOT EXISTS idx_project_members_role
  ON project_members (project_id, user_id, role);

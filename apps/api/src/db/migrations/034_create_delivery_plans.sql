-- Worklane Phase 17 — Delivery Plans & Timeline
--
-- Cross-team planning: a delivery plan aggregates multiple teams of a
-- project, their iterations, the work items on those timelines, and the
-- dependencies between work items.
--
-- Model:
--   Delivery Plan
--    ├── Teams        (delivery_plan_teams)
--    ├── Iterations   (derived from each team's team_iterations scope)
--    ├── Work Items   (items in the teams' area + iteration scopes)
--    └── Dependencies (work_item_links — "A depends on B")
--
-- Everything stays project-scoped (organizations scope projects), and every
-- read is additionally filtered by team membership on the requesting user.

-- A plan belongs to exactly one project; multiple plans may exist per project.
CREATE TABLE IF NOT EXISTS delivery_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_plans_project ON delivery_plans(project_id);

-- Teams participating in the plan. A plan is "cross-team" by construction.
CREATE TABLE IF NOT EXISTS delivery_plan_teams (
    plan_id UUID NOT NULL REFERENCES delivery_plans(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plan_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_plan_teams_team ON delivery_plan_teams(team_id);

-- Dependencies between work items of the same project.
--   source depends on target  ->  link_type = 'DEPENDS_ON'
--   source is related to target -> link_type = 'RELATED'
CREATE TABLE IF NOT EXISTS work_item_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    target_work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    link_type VARCHAR(20) NOT NULL DEFAULT 'DEPENDS_ON',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_work_item_links_type
        CHECK (link_type IN ('DEPENDS_ON', 'RELATED')),
    CONSTRAINT chk_work_item_links_not_self
        CHECK (source_work_item_id <> target_work_item_id),
    CONSTRAINT uq_work_item_links
        UNIQUE (source_work_item_id, target_work_item_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_work_item_links_source ON work_item_links(source_work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_item_links_target ON work_item_links(target_work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_item_links_project ON work_item_links(project_id);
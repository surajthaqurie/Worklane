-- Team model: members with roles, team configuration, and iteration/area scoping.
--
-- Project membership = access to the project. Team membership = being in a
-- specific project team. Work items stay project-scoped; teams narrow their
-- board/backlog/sprint views by their configured areas and iterations.

-- Track team updates
ALTER TABLE teams ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Team membership with role (ADMIN can manage the team, MEMBER participates)
CREATE TABLE team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id)
);

-- Per-team planning configuration
CREATE TABLE team_configurations (
    team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    board_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    backlog_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_iteration_id UUID REFERENCES iterations(id) ON DELETE SET NULL,
    default_area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Iterations a team works in (sprint/iteration selection)
CREATE TABLE team_iterations (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    iteration_id UUID NOT NULL REFERENCES iterations(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, iteration_id)
);

-- Areas a team owns (area configuration)
CREATE TABLE team_areas (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, area_id)
);

-- ─── Backfill so existing projects keep working ─────────────────────────────
-- Every project gets a default team (reusing the one seeded by migration 009
-- when present), all project members become team members, the team sees all
-- of the project's areas and iterations, and a config row is created.

INSERT INTO teams (project_id, name, description)
SELECT id, name || ' Team', 'Default team for ' || name
FROM projects
WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.project_id = projects.id);

-- Project creators are admins of their default team
INSERT INTO team_members (team_id, user_id, role)
SELECT t.id, p.created_by, 'ADMIN'
FROM projects p
JOIN teams t ON t.project_id = p.id
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Every project member is a member of the project's default team
INSERT INTO team_members (team_id, user_id, role)
SELECT t.id, pm.user_id, 'MEMBER'
FROM project_members pm
JOIN teams t ON t.project_id = pm.project_id
WHERE NOT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = t.id AND tm.user_id = pm.user_id
);

-- Default teams see all of the project's areas and iterations by default,
-- preserving today's project-wide behaviour until a team narrows its scope.
INSERT INTO team_areas (team_id, area_id)
SELECT t.id, a.id
FROM teams t
JOIN areas a ON a.project_id = t.project_id
WHERE NOT EXISTS (
    SELECT 1 FROM team_areas ta
    WHERE ta.team_id = t.id AND ta.area_id = a.id
);

INSERT INTO team_iterations (team_id, iteration_id)
SELECT t.id, i.id
FROM teams t
JOIN iterations i ON i.project_id = t.project_id
WHERE NOT EXISTS (
    SELECT 1 FROM team_iterations ti
    WHERE ti.team_id = t.id AND ti.iteration_id = i.id
);

INSERT INTO team_configurations (team_id, board_config, backlog_config, default_area_id, default_iteration_id)
SELECT
    t.id,
    '{"collapsedCategories": false, "hideEmptyColumns": false}'::jsonb,
    '{"showInProgressItems": false}'::jsonb,
    (SELECT a.id FROM areas a
      WHERE a.project_id = t.project_id AND a.parent_id IS NULL
      ORDER BY a.created_at ASC, a.name ASC LIMIT 1),
    (SELECT i.id FROM iterations i
      WHERE i.project_id = t.project_id AND i.state = 'ACTIVE'
      ORDER BY i.start_date DESC LIMIT 1)
FROM teams t
WHERE NOT EXISTS (SELECT 1 FROM team_configurations tc WHERE tc.team_id = t.id);
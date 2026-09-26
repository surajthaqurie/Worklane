-- Worklane Final Database Schema Migration
-- Consolidated single-schema migration baseline containing all production tables, constraints, indexes, and triggers.

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default organization for backward compatibility
INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Organization')
ON CONFLICT (id) DO NOTHING;

-- 3. Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);

-- 4. Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  key VARCHAR(20) NOT NULL,
  next_work_item_seq INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_key ON projects(key);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);

-- 5. Project Members
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(project_id, user_id, role);

-- 6. Teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_project_id ON teams(project_id);

-- 7. Areas
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_areas_project_id ON areas(project_id);
CREATE INDEX IF NOT EXISTS idx_areas_parent_id ON areas(parent_id);

-- 8. Iterations
CREATE TABLE IF NOT EXISTS iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES iterations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  goal TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iterations_project_id ON iterations(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS only_one_active_sprint_per_project ON iterations (project_id) WHERE state = 'ACTIVE';

-- 9. Work Item States
CREATE TABLE IF NOT EXISTS work_item_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  key VARCHAR(50) NOT NULL,
  category VARCHAR(20) NOT NULL DEFAULT 'PROPOSED' CHECK (category IN ('PROPOSED', 'IN_PROGRESS', 'RESOLVED', 'COMPLETED')),
  color VARCHAR(20) NOT NULL DEFAULT '#94A3B8',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_work_item_states_project_order ON work_item_states(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_work_item_states_category ON work_item_states(project_id, category);

-- 10. Work Items
CREATE TABLE IF NOT EXISTS work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  seq_no INTEGER NOT NULL,
  parent_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  state VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  severity VARCHAR(20) DEFAULT 'MEDIUM' CHECK (severity IS NULL OR severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  points INTEGER,
  remaining_work NUMERIC(10, 2) CHECK (remaining_work IS NULL OR remaining_work >= 0),
  completed_work NUMERIC(10, 2) CHECK (completed_work IS NULL OR completed_work >= 0),
  backlog_order DOUBLE PRECISION NOT NULL DEFAULT 0,
  backlog_rank DOUBLE PRECISION NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  iteration_id UUID REFERENCES iterations(id) ON DELETE SET NULL,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  start_date TIMESTAMP WITH TIME ZONE,
  target_date TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED,
  UNIQUE(project_id, seq_no),
  CONSTRAINT fk_work_items_state FOREIGN KEY (project_id, state) REFERENCES work_item_states(project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_work_items_project_id ON work_items(project_id);
CREATE INDEX IF NOT EXISTS idx_work_items_state ON work_items(state);
CREATE INDEX IF NOT EXISTS idx_work_items_priority ON work_items(priority);
CREATE INDEX IF NOT EXISTS idx_work_items_assigned_to ON work_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_items_search_vector ON work_items USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_work_items_parent_rank ON work_items (project_id, parent_id, backlog_rank);
CREATE INDEX IF NOT EXISTS idx_work_items_project_state ON work_items (project_id, state);
CREATE INDEX IF NOT EXISTS idx_work_items_project_type ON work_items (project_id, type);
CREATE INDEX IF NOT EXISTS idx_work_items_project_assigned ON work_items (project_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_items_area_id ON work_items (area_id);
CREATE INDEX IF NOT EXISTS idx_work_items_parent_id ON work_items (parent_id);
CREATE INDEX IF NOT EXISTS idx_work_items_iteration_rank ON work_items (iteration_id, backlog_rank, seq_no);
CREATE INDEX IF NOT EXISTS idx_work_items_project_seq ON work_items (project_id, seq_no);
CREATE INDEX IF NOT EXISTS idx_work_items_project_parent_rank ON work_items (project_id, parent_id, backlog_rank);
CREATE INDEX IF NOT EXISTS idx_work_items_severity ON work_items(severity);
CREATE INDEX IF NOT EXISTS idx_work_items_dates ON work_items(start_date, target_date);
CREATE INDEX IF NOT EXISTS idx_work_items_parent_project ON work_items(project_id, parent_id);

-- 11. Work Item Comments
CREATE TABLE IF NOT EXISTS work_item_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_item_comments_work_item_id ON work_item_comments(work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_item_comments_user_id ON work_item_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_work_item_comments_history ON work_item_comments (work_item_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_item_comments_asc_history ON work_item_comments (work_item_id, created_at ASC, id ASC) WHERE deleted_at IS NULL;

-- 12. Work Item History
CREATE TABLE IF NOT EXISTS work_item_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  field VARCHAR(50),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  inserted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_work_item_history_user_id ON work_item_history(user_id);
CREATE INDEX IF NOT EXISTS idx_work_item_history_work_item_inserted ON work_item_history(work_item_id, inserted_at);
CREATE INDEX IF NOT EXISTS idx_work_item_history_created_at ON work_item_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_item_history_action ON work_item_history(action);

CREATE OR REPLACE FUNCTION prevent_work_item_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'work_item_history is an immutable audit log (%).', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS work_item_history_immutable ON work_item_history;
CREATE TRIGGER work_item_history_immutable
BEFORE UPDATE OR DELETE ON work_item_history
FOR EACH ROW EXECUTE FUNCTION prevent_work_item_history_mutation();

-- 13. Iteration History
CREATE TABLE IF NOT EXISTS iteration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iteration_id UUID REFERENCES iterations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  field VARCHAR(50),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iteration_history_iteration_id ON iteration_history(iteration_id);
CREATE INDEX IF NOT EXISTS idx_iteration_history_user_id ON iteration_history(user_id);

-- 14. Saved Queries
CREATE TABLE IF NOT EXISTS saved_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder VARCHAR(100),
  definition JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_queries_project_id ON saved_queries(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_shared ON saved_queries(project_id, is_shared);
CREATE INDEX IF NOT EXISTS idx_saved_queries_created_by ON saved_queries(created_by);

-- 15. Tags & Work Item Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS work_item_tags (
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (work_item_id, tag_id)
);

-- 16. Work Item Attachments
CREATE TABLE IF NOT EXISTS work_item_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  object_key VARCHAR(512),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_item_attachments_work_item_id ON work_item_attachments (work_item_id);

-- 17. Team Members & Team Configurations
CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_configurations (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  board_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  backlog_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_iteration_id UUID REFERENCES iterations(id) ON DELETE SET NULL,
  default_area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_iterations (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  iteration_id UUID NOT NULL REFERENCES iterations(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, iteration_id)
);

CREATE TABLE IF NOT EXISTS team_areas (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, area_id)
);

-- 18. Query Runs
CREATE TABLE IF NOT EXISTS query_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  query_id UUID REFERENCES saved_queries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  definition JSONB,
  ran_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_query_runs_project_user_time ON query_runs(project_id, user_id, ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_runs_query ON query_runs(query_id);

-- 19. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_work_item_id ON notifications (work_item_id);

-- 20. Boards
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  swimlane VARCHAR(20) NOT NULL DEFAULT 'none',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  card_fields JSONB NOT NULL DEFAULT '{"showType": true, "showPriority": true, "showAssignee": true, "showPoints": true, "showParent": true, "showTags": true}'::jsonb,
  filter_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_boards_project_id ON boards(project_id);
CREATE INDEX IF NOT EXISTS idx_boards_team_id ON boards(team_id);
CREATE INDEX IF NOT EXISTS idx_boards_swimlane ON boards(swimlane);

-- 21. Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  replaced_by_token_id UUID
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- 22. Security Audit Logs
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_project_id ON security_audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON security_audit_logs(created_at);

-- 23. Idempotency Keys
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path VARCHAR(255) NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(key, user_id, path)
);

-- 24. Work Item Followers & Notification Preferences
CREATE TABLE IF NOT EXISTS work_item_followers (
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (work_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_work_item_followers_user ON work_item_followers(user_id);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  channel_in_app BOOLEAN DEFAULT true,
  channel_email BOOLEAN DEFAULT true,
  notify_mentions BOOLEAN DEFAULT true,
  notify_assigned BOOLEAN DEFAULT true,
  notify_followed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 25. Background Jobs
CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,
  idempotency_key VARCHAR(255) UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  progress INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON background_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_idempotency ON background_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 26. Delivery Plans & Links
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

CREATE TABLE IF NOT EXISTS delivery_plan_teams (
  plan_id UUID NOT NULL REFERENCES delivery_plans(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (plan_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_plan_teams_team ON delivery_plan_teams(team_id);

CREATE TABLE IF NOT EXISTS work_item_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  target_work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  link_type VARCHAR(20) NOT NULL DEFAULT 'DEPENDS_ON',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_work_item_links_type CHECK (link_type IN ('DEPENDS_ON', 'RELATED')),
  CONSTRAINT chk_work_item_links_not_self CHECK (source_work_item_id <> target_work_item_id),
  CONSTRAINT uq_work_item_links UNIQUE (source_work_item_id, target_work_item_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_work_item_links_source ON work_item_links(source_work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_item_links_target ON work_item_links(target_work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_item_links_project ON work_item_links(project_id);

-- 27. Analytics Snapshots
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

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_project_kind ON analytics_snapshots(project_id, kind, computed_at DESC);

-- 28. Dashboard Layouts
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_user_global ON dashboard_layouts(user_id) WHERE project_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_user_project ON dashboard_layouts(user_id, project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_project_id ON dashboard_layouts(project_id);

-- 29. Saved Reports & Analytics Performance Indexes
CREATE TABLE IF NOT EXISTS saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    report_type VARCHAR(100) NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_shared BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_project_id ON saved_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by ON saved_reports(created_by);

CREATE INDEX IF NOT EXISTS idx_work_items_analytics_composite 
    ON work_items(project_id, iteration_id, area_id, state, type, priority, assigned_to, created_at, completed_at);

CREATE INDEX IF NOT EXISTS idx_work_item_history_analytics 
    ON work_item_history(work_item_id, action, inserted_at);

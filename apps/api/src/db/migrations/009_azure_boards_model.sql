-- Create Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default organization
INSERT INTO organizations (id, name) VALUES ('00000000-0000-0000-0000-000000000000', 'Default Organization');

-- Add organization_id to projects
ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id);
UPDATE projects SET organization_id = '00000000-0000-0000-0000-000000000000';
ALTER TABLE projects ALTER COLUMN organization_id SET NOT NULL;

-- Create Teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create default team for each project
INSERT INTO teams (project_id, name, description)
SELECT id, name || ' Team', 'Default team for ' || name FROM projects;

-- Create Areas (Area Paths)
CREATE TABLE areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES areas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create default area for each project
INSERT INTO areas (project_id, name)
SELECT id, name FROM projects;

-- Rename sprints to iterations (or alter table)
-- We'll rename it to match the domain model
ALTER TABLE sprints RENAME TO iterations;
ALTER TABLE iterations ADD COLUMN parent_id UUID REFERENCES iterations(id) ON DELETE CASCADE;

-- Create Tags
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, name)
);

CREATE TABLE work_item_tags (
    work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (work_item_id, tag_id)
);

-- Update Work Items
ALTER TABLE work_items RENAME COLUMN sprint_id TO iteration_id;
ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_sprint_id_fkey;
ALTER TABLE work_items ADD CONSTRAINT work_items_iteration_id_fkey FOREIGN KEY (iteration_id) REFERENCES iterations(id) ON DELETE SET NULL;

ALTER TABLE work_items ADD COLUMN area_id UUID REFERENCES areas(id) ON DELETE SET NULL;
ALTER TABLE work_items ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE;

-- Set default area for existing work items
UPDATE work_items wi
SET area_id = (SELECT id FROM areas a WHERE a.project_id = wi.project_id LIMIT 1);

ALTER TABLE work_items ALTER COLUMN area_id SET NOT NULL;


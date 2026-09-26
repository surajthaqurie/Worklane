-- db/migrations/038_backfill_user_default_organizations.sql
-- Ensure every user without an organization receives a default organization with OWNER role

INSERT INTO organizations (id, name, created_by)
SELECT
  gen_random_uuid(),
  CASE
    WHEN u.name LIKE '%s' OR u.name LIKE '%S' THEN u.name || ''' Organization'
    ELSE u.name || '''s Organization'
  END,
  u.id
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM organization_members om WHERE om.user_id = u.id
);

-- Ensure all users are organization members with OWNER role for their created organizations
INSERT INTO organization_members (organization_id, user_id, role)
SELECT o.id, o.created_by, 'OWNER'
FROM organizations o
WHERE o.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM organization_members om WHERE om.organization_id = o.id AND om.user_id = o.created_by
  )
ON CONFLICT (organization_id, user_id) DO NOTHING;

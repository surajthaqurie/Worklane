import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionGate } from '../components/PermissionGate';
import { Can } from '../components/Can';

vi.mock('@/app/(app)/projects/[projectId]/project-layout-client', () => ({
  useProjectContext: vi.fn(),
}));

import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
const mockUseProjectContext = vi.mocked(useProjectContext);

function makeMockContext(permissions: string[]) {
  const can = (p: string) => permissions.includes(p);
  return {
    project: null,
    projectId: 'proj-1',
    orgId: null,
    teams: [],
    selectedTeamId: null,
    setSelectedTeamId: vi.fn(),
    can,
    canAll: (...perms: string[]) => perms.every(can),
    canAny: (...perms: string[]) => perms.some(can),
    projectRole: 'MEMBER',
  };
}

describe('PermissionGate', () => {
  beforeEach(() => {
    mockUseProjectContext.mockReturnValue(
      makeMockContext(['work_item:view', 'work_item:create']) as ReturnType<typeof useProjectContext>
    );
  });

  it('renders children when user has the required permission', () => {
    render(
      <PermissionGate permission="work_item:create">
        <span>Create Button</span>
      </PermissionGate>
    );
    expect(screen.getByText('Create Button')).toBeInTheDocument();
  });

  it('renders nothing when user lacks the required permission', () => {
    render(
      <PermissionGate permission="project:delete">
        <span>Delete Project</span>
      </PermissionGate>
    );
    expect(screen.queryByText('Delete Project')).not.toBeInTheDocument();
  });

  it('renders fallback when user lacks permission', () => {
    render(
      <PermissionGate permission="project:delete" fallback={<span>No access</span>}>
        <span>Delete Project</span>
      </PermissionGate>
    );
    expect(screen.getByText('No access')).toBeInTheDocument();
    expect(screen.queryByText('Delete Project')).not.toBeInTheDocument();
  });

  it('renders when user has ALL required permissions', () => {
    render(
      <PermissionGate all={['work_item:view', 'work_item:create']}>
        <span>Multi-perm action</span>
      </PermissionGate>
    );
    expect(screen.getByText('Multi-perm action')).toBeInTheDocument();
  });

  it('hides when user is missing one of required permissions', () => {
    render(
      <PermissionGate all={['work_item:view', 'project:delete']}>
        <span>Multi-perm action</span>
      </PermissionGate>
    );
    expect(screen.queryByText('Multi-perm action')).not.toBeInTheDocument();
  });

  it('renders when user has ANY of the permissions', () => {
    render(
      <PermissionGate any={['project:delete', 'work_item:create']}>
        <span>Any-perm action</span>
      </PermissionGate>
    );
    expect(screen.getByText('Any-perm action')).toBeInTheDocument();
  });

  it('renders children when no constraint is specified', () => {
    render(
      <PermissionGate>
        <span>Always visible</span>
      </PermissionGate>
    );
    expect(screen.getByText('Always visible')).toBeInTheDocument();
  });
});

describe('Can', () => {
  beforeEach(() => {
    mockUseProjectContext.mockReturnValue(
      makeMockContext(['work_item:view']) as ReturnType<typeof useProjectContext>
    );
  });

  it('renders children when user can do the action', () => {
    render(
      <Can do="work_item:view">
        <span>View Item</span>
      </Can>
    );
    expect(screen.getByText('View Item')).toBeInTheDocument();
  });

  it('renders fallback when user cannot do the action', () => {
    render(
      <Can do="work_item:delete" fallback={<span>Locked</span>}>
        <span>Delete Item</span>
      </Can>
    );
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.queryByText('Delete Item')).not.toBeInTheDocument();
  });
});

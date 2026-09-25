'use client';

import React, { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { useProject } from '@/features/projects/hooks/useProjects';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { useProjectPermissions } from '@/shared/hooks/useProjectPermissions';
import { PermissionValue } from '@/config/permissions';
import { Project } from '@/shared/types/projects';
import { Team } from '@/shared/types/teams';
import { Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { ProjectSidebar } from '@/components/layout/project-sidebar';

interface ProjectContextValue {
  project: Project | null;
  projectId: string;
  orgId: string | null;
  teams: Team[];
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string | null) => void;
  can: (permission: PermissionValue) => boolean;
  canAll: (...permissions: PermissionValue[]) => boolean;
  canAny: (...permissions: PermissionValue[]) => boolean;
  projectRole: string | null;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectLayoutClient');
  return ctx;
}

function useLocalStorageValue(key: string): string | null {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener('storage', onStoreChange);
    return () => window.removeEventListener('storage', onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function ProjectLayoutClient({
  children,
  projectId,
  expectedOrgId,
}: {
  children: React.ReactNode;
  projectId: string;
  expectedOrgId?: string;
}) {
  const { data: project = null, isLoading, error } = useProject(projectId);
  const { data: teamsData } = useTeams(projectId);
  const teams = teamsData ?? [];

  const { can, canAll, canAny, role: projectRole } = useProjectPermissions(projectId);

  const storageKey = `worklane:selectedTeam:${projectId}`;
  const selectedTeamId = useLocalStorageValue(storageKey);

  const effectiveTeamId =
    selectedTeamId && teams.some((t) => t.id === selectedTeamId) ? selectedTeamId : null;

  const setSelectedTeamId = useCallback(
    (id: string | null) => {
      try {
        if (id) window.localStorage.setItem(storageKey, id);
        else window.localStorage.removeItem(storageKey);
      } catch {
        // ignore storage errors
      }
      window.dispatchEvent(new Event('storage'));
    },
    [storageKey]
  );

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-[var(--text-secondary)]">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
            <p>Loading workspace...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !project) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center p-6">
          <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-8 text-center shadow-sm">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Project Not Found</h2>
            <p className="text-[14px] text-[var(--text-secondary)] mb-6">
              The project you&apos;re looking for doesn&apos;t exist, or you don&apos;t have permission to access it.
            </p>
            <Link
              href="/projects"
              className="inline-flex items-center justify-center px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              Back to Projects
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (expectedOrgId && project.organizationId && project.organizationId !== expectedOrgId) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center p-6">
          <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-8 text-center shadow-lg">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Organization Mismatch
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] mb-6 leading-relaxed">
              This project belongs to another organization and cannot be accessed under this URL.
              Direct URL manipulation across organization boundaries is restricted.
            </p>
            <Link
              href={`/orgs/${project.organizationId}/projects/${project.id}`}
              className="inline-flex items-center justify-center px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity shadow-xs"
            >
              Open in Correct Organization
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <ProjectContext.Provider
      value={{
        project,
        projectId,
        orgId: project.organizationId || null,
        teams,
        selectedTeamId: effectiveTeamId,
        setSelectedTeamId,
        can,
        canAll,
        canAny,
        projectRole,
      }}
    >
      <AppShell sidebar={<ProjectSidebar />}>{children}</AppShell>
    </ProjectContext.Provider>
  );
}

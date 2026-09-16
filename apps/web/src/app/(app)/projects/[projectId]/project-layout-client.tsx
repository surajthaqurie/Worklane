'use client';

import React, { createContext, useContext } from 'react';
import { useProject } from '@/hooks/useProjects';
import { Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ProjectContextValue {
  project: any;
  projectId: string;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectLayoutClient');
  return ctx;
}

import { AppShell } from '@/components/layout/app-shell';
import { ProjectSidebar } from '@/components/layout/project-sidebar';

export function ProjectLayoutClient({
  children,
  projectId
}: {
  children: React.ReactNode;
  projectId: string;
}) {
  const { data: project, isLoading, error } = useProject(projectId);

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
              The project you're looking for doesn't exist, or you don't have permission to access it.
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

  return (
    <ProjectContext.Provider value={{ project, projectId }}>
      <AppShell sidebar={<ProjectSidebar />}>
        {children}
      </AppShell>
    </ProjectContext.Provider>
  );
}

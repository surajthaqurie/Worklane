'use client';

import Link from 'next/link';
import { useProjectContext } from './project-layout-client';
import { ProjectOverview } from '@/features/projects/components/ProjectOverview';

export default function ProjectOverviewPage() {
  const { project, projectId } = useProjectContext();

  return (
    <div className="w-full flex flex-col space-y-8 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[var(--border-subtle)]">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">
            {project?.name || 'Project'}
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {project?.key || 'P'} · {project?.description || 'No description provided'}
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
          <Link
            href={`/projects/${projectId}/work-items?new=1`}
            className="px-4 py-2 bg-[var(--brand-primary)] hover:opacity-90 text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors inline-block"
          >
            + New Work Item
          </Link>
        </div>
      </div>

      <ProjectOverview projectId={projectId} />
    </div>
  );
}

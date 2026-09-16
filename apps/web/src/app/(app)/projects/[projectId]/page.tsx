'use client';

import Link from 'next/link';
import { useProjectContext } from './project-layout-client';

export default function ProjectOverviewPage() {
  const { project, projectId } = useProjectContext();

  return (
    <div className="w-full flex flex-col space-y-8 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[var(--border-subtle)]">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">
            {project.name}
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {project.key || 'P'} · {project.description || 'No description provided'}
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
          <Link
            href={`/projects/${projectId}/work-items?new=1`}
            className="px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors inline-block"
          >
            + New Work Item
          </Link>
        </div>
      </div>

      <div className="space-y-6 max-w-4xl">
        <section>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4">Project health</h2>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-4 flex gap-12">
            <div>
              <div className="text-[13px] text-[var(--text-secondary)] mb-1">Open Work</div>
              <div className="text-[24px] font-semibold text-[var(--text-primary)]">24</div>
            </div>
            <div>
              <div className="text-[13px] text-[var(--text-secondary)] mb-1">In Progress</div>
              <div className="text-[24px] font-semibold text-[var(--status-in-progress)]">8</div>
            </div>
            <div>
              <div className="text-[13px] text-[var(--text-secondary)] mb-1">Completed</div>
              <div className="text-[24px] font-semibold text-[var(--status-done)]">42</div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4">Current Iteration</h2>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6">
            <div className="flex justify-between items-end mb-2">
              <div className="font-medium text-[14px] text-[var(--text-primary)]">Iteration 12</div>
              <div className="text-[13px] font-medium text-[var(--text-secondary)]">72%</div>
            </div>
            <div className="w-full bg-[var(--bg-surface-hover)] h-2 rounded-full overflow-hidden">
              <div className="bg-[var(--brand-primary)] h-full" style={{ width: '72%' }}></div>
            </div>
            <div className="mt-3 text-[13px] text-[var(--text-secondary)]">18 of 25 items completed</div>
          </div>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <div className="text-[13px] flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-[10px] shrink-0">SC</div>
              <div>
                <span className="font-medium text-[var(--text-primary)]">Suraj</span>
                <span className="text-[var(--text-secondary)]"> moved APP-124 to In Progress</span>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">2 hours ago</div>
              </div>
            </div>
            <div className="text-[13px] flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-[10px] shrink-0">SC</div>
              <div>
                <span className="font-medium text-[var(--text-primary)]">Suraj</span>
                <span className="text-[var(--text-secondary)]"> completed APP-122</span>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Yesterday</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, Layers, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useOrgOverview } from '@/features/analytics/hooks/useAnalytics';
import { Spinner, ErrorState } from '@/shared/components/ui';

export function OrgReportsView({ orgId }: { orgId: string }) {
  const overview = useOrgOverview(orgId);

  if (overview.isLoading) {
    return (
      <div className="flex items-center justify-center p-12" role="status">
        <Spinner size="lg" />
      </div>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <div className="p-6">
        <ErrorState error={overview.error as Error} onRetry={() => overview.refetch()} title="Failed to load organization analytics overview" />
      </div>
    );
  }

  const data = overview.data;
  const projects = data.projects || [];

  return (
    <div className="flex flex-col gap-6 p-6 w-full h-full overflow-y-auto bg-[var(--bg-canvas)]">
      {/* Header */}
      <div className="pb-4 border-b border-[var(--border-subtle)]">
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[var(--brand-primary)]" aria-hidden />
          Organization Analytics Overview
        </h1>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Cross-project high-level health metrics, workload distribution, and portfolio progress across all organization projects.
        </p>
      </div>

      {/* Org Summary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Organization KPIs">
        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Building2 className="w-4 h-4 text-blue-500" />
            <span>Total Projects</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">{data.summary.totalProjects}</div>
          <span className="text-[11px] text-[var(--text-muted)]">Active projects in org</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>Total Work Items</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">{data.summary.totalItems}</div>
          <span className="text-[11px] text-[var(--text-muted)]">{data.summary.totalOpen} open items</span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Completed Work</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 tabular-nums">{data.summary.totalCompleted}</div>
          <span className="text-[11px] text-emerald-600/80">
            {data.summary.totalItems > 0 ? `${Math.round((data.summary.totalCompleted / data.summary.totalItems) * 100)}% overall completion` : '0%'}
          </span>
        </div>

        <div className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Overdue &amp; Blocked</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 tabular-nums">{data.summary.totalOverdue + data.summary.totalBlocked}</div>
          <span className="text-[11px] text-amber-600/80">{data.summary.totalOverdue} overdue, {data.summary.totalBlocked} blocked</span>
        </div>
      </section>

      {/* Projects Portfolio Grid */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Project Portfolio Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const completionPct = proj.totalItems > 0 ? Math.round((proj.completedItems / proj.totalItems) * 100) : 0;
            return (
              <div
                key={proj.projectId}
                className="p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col justify-between space-y-4 hover:border-[var(--brand-primary)]/50 transition-all shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">{proj.projectName}</h3>
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[var(--text-muted)] shrink-0">
                      {proj.projectKey}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-[var(--text-muted)]">
                      <span>Completion Rate</span>
                      <span className="font-semibold text-[var(--text-primary)]">{completionPct}% ({proj.completedItems}/{proj.totalItems})</span>
                    </div>
                    <div className="w-full bg-[var(--bg-surface-raised)] rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${completionPct}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-[var(--bg-surface-raised)]">
                      <span className="block text-[10px] text-[var(--text-muted)] uppercase">Open</span>
                      <span className="font-bold text-blue-600">{proj.openItems}</span>
                    </div>
                    <div className="p-2 rounded bg-[var(--bg-surface-raised)]">
                      <span className="block text-[10px] text-[var(--text-muted)] uppercase">Overdue</span>
                      <span className={`font-bold ${proj.overdueItems > 0 ? 'text-amber-600' : 'text-[var(--text-muted)]'}`}>{proj.overdueItems}</span>
                    </div>
                    <div className="p-2 rounded bg-[var(--bg-surface-raised)]">
                      <span className="block text-[10px] text-[var(--text-muted)] uppercase">Blocked</span>
                      <span className={`font-bold ${proj.blockedItems > 0 ? 'text-rose-600' : 'text-[var(--text-muted)]'}`}>{proj.blockedItems}</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/orgs/${orgId}/projects/${proj.projectId}/analytics`}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)]/20 rounded-[var(--radius-button)] transition-colors"
                >
                  <span>View Full Project Analytics</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

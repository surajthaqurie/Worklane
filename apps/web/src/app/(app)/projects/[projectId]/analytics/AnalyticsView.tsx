'use client';

import React, { useState } from 'react';
import { format, subDays } from 'date-fns';
import { RefreshCw, CalendarRange } from 'lucide-react';
import { useProjectContext } from '../project-layout-client';
import { useIterations } from '@/features/iterations/hooks/useIterations';
import {
  useAnalyticsSummary,
  useBurndown,
  useCumulativeFlow,
  useCycleTime,
  useLeadTime,
  useRecomputeAnalytics,
  useVelocity,
} from '@/features/analytics/hooks/useAnalytics';
import { SprintBurndownChart } from '@/features/analytics/components/SprintBurndownChart';
import { VelocityChart } from '@/features/analytics/components/VelocityChart';
import { CumulativeFlowChart } from '@/features/analytics/components/CumulativeFlowChart';
import { FlowTimeChart } from '@/features/analytics/components/FlowTimeChart';
import { SummaryCards } from '@/features/analytics/components/SummaryCards';
import { Spinner, ErrorState } from '@/shared/components/ui';

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
] as const;

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      style={{ height }}
      role="status"
      aria-label="Loading chart"
    />
  );
}

function ChartError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
      <ErrorState error={new Error(message)} onRetry={onRetry} title="Failed to load chart" />
    </div>
  );
}

export function AnalyticsView({ projectId }: { projectId: string }) {
  const { selectedTeamId } = useProjectContext();
  const [from, setFrom] = useState(() => format(subDays(new Date(), 90), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [groupBy, setGroupBy] = useState<'category' | 'state'>('category');
  const [selectedIterationId, setSelectedIterationId] = useState<string | undefined>(undefined);

  const iterations = useIterations(projectId, selectedTeamId);
  const activeIteration =
    iterations.data?.find((it) => (it.status ?? it.state ?? '') === 'ACTIVE') ?? iterations.data?.[iterations.data.length - 1];
  const iterationId = selectedIterationId ?? activeIteration?.id;

  const range = { from, to };
  const summary = useAnalyticsSummary(projectId, range, selectedTeamId);
  const burndown = useBurndown(projectId, iterationId, selectedTeamId);
  const velocity = useVelocity(projectId, range, selectedTeamId);
  const cumulativeFlow = useCumulativeFlow(projectId, range, groupBy, selectedTeamId);
  const cycleTime = useCycleTime(projectId, range, selectedTeamId);
  const leadTime = useLeadTime(projectId, range, selectedTeamId);
  const recompute = useRecomputeAnalytics(projectId);

  const applyPreset = (days: number) => {
    setFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    setTo(format(new Date(), 'yyyy-MM-dd'));
  };

  return (
    <div className="flex flex-col w-full h-full p-6 overflow-y-auto">
      <div className="pb-5 mb-5 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-[var(--text-secondary)]" aria-hidden="true" />
              Analytics
            </h1>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Metrics replayed from history — sprint burndown, velocity, cumulative flow, cycle &amp; lead time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1 py-1">
              {PRESETS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => applyPreset(p.days)}
                  className={`px-2.5 py-1 rounded text-[12px] font-medium transition-colors ${
                    from === format(subDays(new Date(), p.days), 'yyyy-MM-dd')
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
              From
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12px] text-[var(--text-primary)]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
              To
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12px] text-[var(--text-primary)]"
              />
            </label>
            <button
              onClick={() => recompute.mutate()}
              disabled={recompute.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recompute.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
              Recompute snapshots
            </button>
          </div>
        </div>
      </div>

      {summary.isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Spinner size="lg" />
        </div>
      ) : summary.isError || !summary.data ? (
        <ErrorState error={summary.error as Error} onRetry={() => summary.refetch()} title="Failed to load analytics" />
      ) : (
        <div className="flex flex-col gap-5">
          <SummaryCards summary={summary.data} />

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-5" aria-label="Charts">
            <div className="xl:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-5">
              {iterationId ? (
                burndown.isLoading ? (
                  <ChartSkeleton />
                ) : burndown.isError || !burndown.data ? (
                  <ChartError message={(burndown.error as Error)?.message} onRetry={() => burndown.refetch()} />
                ) : burndown.data.totalScopeItems === 0 ? (
                  <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-[13px] text-[var(--text-muted)]">
                    No work items were scoped to this sprint.
                  </div>
                ) : (
                  <SprintBurndownChart data={burndown.data} />
                )
              ) : iterations.isLoading ? (
                <ChartSkeleton />
              ) : (
                <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-[13px] text-[var(--text-muted)]">
                  No iterations yet — burndown needs a sprint.
                </div>
              )}

              {velocity.isLoading ? (
                <ChartSkeleton />
              ) : velocity.isError || !velocity.data ? (
                <ChartError message={(velocity.error as Error)?.message} onRetry={() => velocity.refetch()} />
              ) : velocity.data.iterations.length === 0 ? (
                <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-[13px] text-[var(--text-muted)]">
                  No sprints overlap the selected window.
                </div>
              ) : (
                <VelocityChart data={velocity.data} />
              )}

              {cumulativeFlow.isLoading ? (
                <ChartSkeleton />
              ) : cumulativeFlow.isError || !cumulativeFlow.data ? (
                <ChartError message={(cumulativeFlow.error as Error)?.message} onRetry={() => cumulativeFlow.refetch()} />
              ) : cumulativeFlow.data.points.every((p) => p.series.every((s) => s.value === 0)) ? (
                <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-[13px] text-[var(--text-muted)]">
                  No work items in the selected window.
                </div>
              ) : (
                <CumulativeFlowChart data={cumulativeFlow.data} />
              )}

              {cycleTime.isLoading ? (
                <ChartSkeleton />
              ) : cycleTime.isError || !cycleTime.data ? (
                <ChartError message={(cycleTime.error as Error)?.message} onRetry={() => cycleTime.refetch()} />
              ) : (
                <FlowTimeChart data={cycleTime.data} title="Cycle Time" />
              )}

              {leadTime.isLoading ? (
                <ChartSkeleton />
              ) : leadTime.isError || !leadTime.data ? (
                <ChartError message={(leadTime.error as Error)?.message} onRetry={() => leadTime.refetch()} />
              ) : (
                <FlowTimeChart data={leadTime.data} title="Lead Time" />
              )}
            </div>

            <aside className="flex flex-col gap-4">
              <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-2">Burndown sprint</h2>
                {iterations.isLoading ? (
                  <div className="h-8 animate-pulse rounded bg-[var(--bg-surface-raised)]" role="status" aria-label="Loading iterations" />
                ) : iterations.data && iterations.data.length > 0 ? (
                  <select
                    value={iterationId ?? ''}
                    onChange={(e) => setSelectedIterationId(e.target.value || undefined)}
                    className="w-full rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)]"
                    aria-label="Burndown sprint"
                  >
                    {iterations.data.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[12px] text-[var(--text-muted)]">No sprints yet.</p>
                )}
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-2">Cumulative flow grouping</h2>
                <div className="flex gap-1 rounded-[var(--radius-button)] border border-[var(--border-subtle)] p-1">
                  {(['category', 'state'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGroupBy(g)}
                      className={`flex-1 px-2 py-1.5 rounded text-[12px] font-medium capitalize transition-colors ${
                        groupBy === g
                          ? 'bg-[var(--brand-primary)] text-white'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-[12px] text-[var(--text-muted)] leading-relaxed">
                <p>
                  <span className="font-medium text-[var(--text-secondary)]">How this works.</span>{' '}
                  Burndown, velocity, CFD, cycle and lead time are recomputed from the work-item event log — state
                  transitions, iteration moves and timestamps — never from the live board alone. Select{' '}
                  <span className="font-medium text-[var(--text-secondary)]">Recompute snapshots</span> to pre-aggregate
                  the default windows in the background.
                </p>
              </div>
            </aside>
          </section>
        </div>
      )}
    </div>
  );
}
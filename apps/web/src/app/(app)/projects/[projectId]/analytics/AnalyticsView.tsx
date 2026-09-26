'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Activity,
  Users,
  Layers,
  TrendingUp,
  BarChart2,
  Clock,
  Hourglass,
  AlertTriangle,
  Ban,
  PieChart,
  GitCommit,
  LineChart,
  RefreshCw,
} from 'lucide-react';
import { useProjectContext } from '../project-layout-client';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { useIterations } from '@/features/iterations/hooks/useIterations';
import { useAnalyticsFilters, useRecomputeAnalytics } from '@/features/analytics/hooks/useAnalytics';
import { ReportFilterBar } from '@/features/analytics/components/ReportFilterBar';
import { SavedReportsModal } from '@/features/analytics/components/SavedReportsModal';

// Specialized Report Views
import { OverviewReportView } from '@/features/analytics/components/OverviewReportView';
import { ProjectHealthView } from '@/features/analytics/components/ProjectHealthView';
import { TeamAnalyticsView } from '@/features/analytics/components/TeamAnalyticsView';
import { IterationReportView } from '@/features/analytics/components/IterationReportView';
import { VelocityView } from '@/features/analytics/components/VelocityView';
import { ThroughputView } from '@/features/analytics/components/ThroughputView';
import { CycleAndLeadTimeView } from '@/features/analytics/components/CycleAndLeadTimeView';
import { AgingReportView } from '@/features/analytics/components/AgingReportView';
import { OverdueReportView } from '@/features/analytics/components/OverdueReportView';
import { BlockedReportView } from '@/features/analytics/components/BlockedReportView';
import { WorkDistributionView } from '@/features/analytics/components/WorkDistributionView';
import { StateTransitionsView } from '@/features/analytics/components/StateTransitionsView';
import { TrendsReportView } from '@/features/analytics/components/TrendsReportView';

const REPORT_TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'project-health', label: 'Project Health', icon: Activity },
  { id: 'team', label: 'Team Analytics', icon: Users },
  { id: 'iteration', label: 'Iteration / Sprint', icon: Layers },
  { id: 'velocity', label: 'Velocity', icon: TrendingUp },
  { id: 'throughput', label: 'Throughput', icon: BarChart2 },
  { id: 'cycle-time', label: 'Cycle & Lead Time', icon: Clock },
  { id: 'aging', label: 'Work Item Aging', icon: Hourglass },
  { id: 'overdue', label: 'Overdue Work', icon: AlertTriangle },
  { id: 'blocked', label: 'Blocked Work', icon: Ban },
  { id: 'work-distribution', label: 'Work Distribution', icon: PieChart },
  { id: 'state-transitions', label: 'State Transitions', icon: GitCommit },
  { id: 'trends', label: 'Trends Over Time', icon: LineChart },
] as const;

export function AnalyticsView({ projectId }: { projectId: string }) {
  const { selectedTeamId } = useProjectContext();
  const { filters, updateFilters } = useAnalyticsFilters();
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

  const teams = useTeams(projectId);
  const iterations = useIterations(projectId, selectedTeamId || filters.teamId);
  const recompute = useRecomputeAnalytics(projectId);

  const activeTab = filters.view || 'overview';

  const queryParams = {
    from: filters.from,
    to: filters.to,
    teamId: filters.teamId || selectedTeamId,
    iterationId: filters.iterationId,
    areaId: filters.areaId,
    workItemTypes: filters.workItemTypes,
    states: filters.states,
    priorities: filters.priorities,
    assignedTo: filters.assignedTo,
    status: filters.status,
  };

  const teamOptions = teams.data?.map((t) => ({ id: t.id, name: t.name })) || [];
  const iterationOptions = iterations.data?.map((it) => ({ id: it.id, name: it.name })) || [];

  const handleTabChange = (tabId: string) => {
    updateFilters({ tab: tabId });
  };

  return (
    <div className="flex flex-col w-full h-full p-6 overflow-y-auto bg-[var(--bg-canvas)]">
      {/* Analytics Hub Header */}
      <div className="pb-4 mb-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[var(--brand-primary)]" aria-hidden />
              Reports &amp; Analytics Hub
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Production project management analytics replayed from PostgreSQL history — burndown, velocity, throughput, cycle time, aging, and state transitions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => recompute.mutate()}
              disabled={recompute.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] disabled:opacity-60 transition-colors focus-ring"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recompute.isPending ? 'animate-spin' : ''}`} aria-hidden />
              <span>Recompute Snapshots</span>
            </button>
          </div>
        </div>
      </div>

      {/* Centralized Filter Bar */}
      <ReportFilterBar
        projectId={projectId}
        teams={teamOptions}
        iterations={iterationOptions}
        onRefresh={() => recompute.mutate()}
      />

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-6 border-b border-[var(--border-subtle)] no-scrollbar shrink-0">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-[var(--radius-button)] whitespace-nowrap transition-colors border-b-2 ${
                isActive
                  ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-surface-hover)] font-semibold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`} aria-hidden />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab View Rendering */}
      <main className="flex-1 min-h-0">
        {activeTab === 'overview' && (
          <OverviewReportView projectId={projectId} queryParams={queryParams} onNavigateTab={handleTabChange} />
        )}
        {activeTab === 'project-health' && (
          <ProjectHealthView projectId={projectId} queryParams={queryParams} />
        )}
        {activeTab === 'team' && (
          <TeamAnalyticsView projectId={projectId} queryParams={queryParams} />
        )}
        {activeTab === 'iteration' && (
          <IterationReportView
            projectId={projectId}
            iterationId={filters.iterationId || iterations.data?.[0]?.id}
            teamId={queryParams.teamId}
            iterations={iterationOptions}
            onSelectIteration={(id) => updateFilters({ iteration: id })}
          />
        )}
        {activeTab === 'velocity' && (
          <VelocityView projectId={projectId} queryParams={queryParams} />
        )}
        {activeTab === 'throughput' && (
          <ThroughputView projectId={projectId} queryParams={queryParams} />
        )}
        {activeTab === 'cycle-time' && (
          <CycleAndLeadTimeView projectId={projectId} queryParams={queryParams} />
        )}
        {activeTab === 'aging' && (
          <AgingReportView projectId={projectId} queryParams={queryParams} />
        )}
        {activeTab === 'overdue' && (
          <OverdueReportView projectId={projectId} queryParams={queryParams} />
        )}
        {activeTab === 'blocked' && (
          <BlockedReportView projectId={projectId} queryParams={queryParams} />
        )}
        {activeTab === 'work-distribution' && (
          <WorkDistributionView projectId={projectId} queryParams={queryParams} />
        )}
        {activeTab === 'state-transitions' && (
          <StateTransitionsView projectId={projectId} queryParams={queryParams} />
        )}
        {activeTab === 'trends' && (
          <TrendsReportView projectId={projectId} queryParams={queryParams} />
        )}
      </main>

      {/* Saved Reports Modal */}
      <SavedReportsModal
        projectId={projectId}
        isOpen={isSavedReportsOpen}
        onClose={() => setIsSavedReportsOpen(false)}
      />
    </div>
  );
}
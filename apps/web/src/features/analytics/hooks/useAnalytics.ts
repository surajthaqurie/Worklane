import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { analyticsApi, AnalyticsQueryParams } from '../api/analyticsApi';
import {
  AnalyticsSummaryDto,
  BurndownDto,
  CumulativeFlowDto,
  FlowTimeDto,
  VelocityDto,
  ThroughputDto,
  ProjectHealthDto,
  TeamAnalyticsDto,
  IterationReportDto,
  WorkItemAgingDto,
  OverdueReportDto,
  BlockedReportDto,
  WorkDistributionDto,
  StateTransitionsDto,
  TrendsAnalyticsDto,
  SavedReport,
  CreateSavedReportPayload,
  OrgAnalyticsOverviewDto,
} from '@/shared/types/analytics';
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';

export interface AnalyticsRange {
  from: string | undefined;
  to: string | undefined;
}

function filterKey(params: object) {
  return JSON.stringify(Object.entries(params as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
}

// ─── URL Filter Hook ─────────────────────────────────────────────────────────

export function useAnalyticsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const teamId = searchParams.get('team') || searchParams.get('teamId') || undefined;
    const iterationId = searchParams.get('iteration') || searchParams.get('iterationId') || undefined;
    const areaId = searchParams.get('area') || searchParams.get('areaId') || undefined;
    const workItemTypes = searchParams.get('types')?.split(',').filter(Boolean) || undefined;
    const states = searchParams.get('states')?.split(',').filter(Boolean) || undefined;
    const priorities = searchParams.get('priorities')?.split(',').filter(Boolean) || undefined;
    const assignedTo = searchParams.get('assignee')?.split(',').filter(Boolean) || undefined;
    const status = searchParams.get('status') || undefined;
    const view = searchParams.get('tab') || searchParams.get('view') || 'overview';
    const rangePreset = searchParams.get('range') || '30d';

    return {
      from,
      to,
      teamId,
      iterationId,
      areaId,
      workItemTypes,
      states,
      priorities,
      assignedTo,
      status,
      view,
      rangePreset,
    };
  }, [searchParams]);

  const updateFilters = useCallback(
    (newFilters: Record<string, string | number | string[] | null | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(newFilters)) {
        if (value === null || value === undefined || value === '') {
          sp.delete(key);
        } else if (Array.isArray(value)) {
          if (value.length > 0) sp.set(key, value.join(','));
          else sp.delete(key);
        } else {
          sp.set(key, String(value));
        }
      }
      router.push(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const clearFilters = useCallback(() => {
    const tab = searchParams.get('tab') || searchParams.get('view');
    router.push(tab ? `${pathname}?tab=${tab}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  return { filters, updateFilters, clearFilters };
}

// ─── Query Hooks ────────────────────────────────────────────────────────────

export function useAnalyticsSummary(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<AnalyticsSummaryDto>({
    queryKey: ['projects', projectId, 'analytics', 'summary', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getSummary(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useProjectHealth(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<ProjectHealthDto>({
    queryKey: ['projects', projectId, 'analytics', 'project-health', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getProjectHealth(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useTeamAnalytics(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<TeamAnalyticsDto>({
    queryKey: ['projects', projectId, 'analytics', 'team', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getTeamAnalytics(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useIterationReport(
  projectId: string,
  iterationId: string | undefined,
  teamId?: string | null,
) {
  return useQuery<IterationReportDto>({
    queryKey: ['projects', projectId, 'analytics', 'iteration', iterationId, { teamId: teamId ?? null }],
    queryFn: ({ signal }) =>
      analyticsApi.getIterationReport(projectId, { iterationId: iterationId!, teamId, signal }),
    enabled: !!projectId && !!iterationId,
  });
}

export function useBurndown(
  projectId: string,
  iterationId: string | undefined,
  teamId?: string | null,
) {
  return useQuery<BurndownDto>({
    queryKey: ['projects', projectId, 'analytics', 'burndown', iterationId, { teamId: teamId ?? null }],
    queryFn: ({ signal }) => analyticsApi.getBurndown(projectId, { iterationId, teamId, signal }),
    enabled: !!projectId && !!iterationId,
  });
}

export function useVelocity(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<VelocityDto>({
    queryKey: ['projects', projectId, 'analytics', 'velocity', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getVelocity(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useThroughput(
  projectId: string,
  params: AnalyticsQueryParams & { groupBy?: 'day' | 'week' | 'month' },
) {
  return useQuery<ThroughputDto>({
    queryKey: ['projects', projectId, 'analytics', 'throughput', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getThroughput(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useCumulativeFlow(
  projectId: string,
  params: AnalyticsQueryParams & { bucketSizeDays?: number; groupBy?: 'category' | 'state' },
) {
  return useQuery<CumulativeFlowDto>({
    queryKey: ['projects', projectId, 'analytics', 'cumulative-flow', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getCumulativeFlow(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useCycleTime(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<FlowTimeDto>({
    queryKey: ['projects', projectId, 'analytics', 'cycle-time', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getCycleTime(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useLeadTime(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<FlowTimeDto>({
    queryKey: ['projects', projectId, 'analytics', 'lead-time', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getLeadTime(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useAging(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<WorkItemAgingDto>({
    queryKey: ['projects', projectId, 'analytics', 'aging', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getAging(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useOverdue(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<OverdueReportDto>({
    queryKey: ['projects', projectId, 'analytics', 'overdue', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getOverdue(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useBlocked(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<BlockedReportDto>({
    queryKey: ['projects', projectId, 'analytics', 'blocked', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getBlocked(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useWorkDistribution(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<WorkDistributionDto>({
    queryKey: ['projects', projectId, 'analytics', 'work-distribution', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getWorkDistribution(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useStateTransitions(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<StateTransitionsDto>({
    queryKey: ['projects', projectId, 'analytics', 'state-transitions', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getStateTransitions(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useTrends(projectId: string, params: AnalyticsQueryParams) {
  return useQuery<TrendsAnalyticsDto>({
    queryKey: ['projects', projectId, 'analytics', 'trends', filterKey(params)],
    queryFn: ({ signal }) => analyticsApi.getTrends(projectId, { ...params, signal }),
    enabled: !!projectId,
  });
}

export function useSavedReports(projectId: string) {
  return useQuery<SavedReport[]>({
    queryKey: ['projects', projectId, 'analytics', 'saved-reports'],
    queryFn: () => analyticsApi.listSavedReports(projectId),
    enabled: !!projectId,
  });
}

export function useCreateSavedReport(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: CreateSavedReportPayload) => analyticsApi.createSavedReport(projectId, payload),
    onSuccess: () => {
      toast.showSuccess('Report Saved', 'Your custom report configuration has been saved.');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'analytics', 'saved-reports'] });
    },
    onError: (err) => {
      toast.showError('Failed to save report', formatApiError(err));
    },
  });
}

export function useDeleteSavedReport(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => analyticsApi.deleteSavedReport(projectId, id),
    onSuccess: () => {
      toast.showSuccess('Report Deleted', 'Saved report has been deleted.');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'analytics', 'saved-reports'] });
    },
    onError: (err) => {
      toast.showError('Failed to delete report', formatApiError(err));
    },
  });
}

export function useOrgOverview(orgId: string | null | undefined) {
  return useQuery<OrgAnalyticsOverviewDto>({
    queryKey: ['orgs', orgId, 'analytics', 'overview'],
    queryFn: () => analyticsApi.getOrgOverview(orgId!),
    enabled: !!orgId,
  });
}

export function useRecomputeAnalytics(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (body?: { from?: string; to?: string }) => analyticsApi.recompute(projectId, body),
    onSuccess: () => {
      toast.showSuccess('Analytics snapshot queued', 'A background job is recalculating the dashboard.');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'analytics'] });
    },
    onError: (err) => {
      toast.showError('Failed to queue analytics recompute', formatApiError(err));
    },
  });
}
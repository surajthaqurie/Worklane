import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '../api/analyticsApi';
import {
  AnalyticsSummaryDto,
  BurndownDto,
  CumulativeFlowDto,
  FlowTimeDto,
  VelocityDto,
} from '@/shared/types/analytics';
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';

export interface AnalyticsRange {
  from: string | undefined;
  to: string | undefined;
}

function windowKey(range: AnalyticsRange) {
  return `${range.from ?? ''}..${range.to ?? ''}`;
}

export function useAnalyticsSummary(
  projectId: string,
  range: AnalyticsRange,
  teamId: string | null | undefined,
) {
  return useQuery<AnalyticsSummaryDto>({
    queryKey: ['projects', projectId, 'analytics', 'summary', windowKey(range), { teamId: teamId ?? null }],
    queryFn: ({ signal }) => analyticsApi.getSummary(projectId, { ...range, teamId, signal }),
    enabled: !!projectId,
  });
}

export function useBurndown(
  projectId: string,
  iterationId: string | undefined,
  teamId: string | null | undefined,
) {
  return useQuery<BurndownDto>({
    queryKey: ['projects', projectId, 'analytics', 'burndown', iterationId, { teamId: teamId ?? null }],
    queryFn: ({ signal }) => analyticsApi.getBurndown(projectId, { iterationId, teamId, signal }),
    enabled: !!projectId && !!iterationId,
  });
}

export function useVelocity(
  projectId: string,
  range: AnalyticsRange,
  teamId: string | null | undefined,
) {
  return useQuery<VelocityDto>({
    queryKey: ['projects', projectId, 'analytics', 'velocity', windowKey(range), { teamId: teamId ?? null }],
    queryFn: ({ signal }) => analyticsApi.getVelocity(projectId, { ...range, teamId, signal }),
    enabled: !!projectId,
  });
}

export function useCumulativeFlow(
  projectId: string,
  range: AnalyticsRange,
  groupBy: 'category' | 'state',
  teamId?: string | null,
  bucketSizeDays?: number,
) {
  return useQuery<CumulativeFlowDto>({
    queryKey: [
      'projects',
      projectId,
      'analytics',
      'cumulative-flow',
      windowKey(range),
      groupBy,
      bucketSizeDays ?? 1,
      { teamId: teamId ?? null },
    ],
    queryFn: ({ signal }) =>
      analyticsApi.getCumulativeFlow(projectId, { ...range, groupBy, bucketSizeDays, teamId, signal }),
    enabled: !!projectId,
  });
}

function useFlowTime(
  endpoint: 'cycle' | 'lead',
  projectId: string,
  range: AnalyticsRange,
  teamId?: string | null,
  type?: string,
) {
  return useQuery<FlowTimeDto>({
    queryKey: [
      'projects',
      projectId,
      'analytics',
      `${endpoint}-time`,
      windowKey(range),
      { teamId: teamId ?? null, type: type ?? null },
    ],
    queryFn: ({ signal }) =>
      endpoint === 'cycle'
        ? analyticsApi.getCycleTime(projectId, { ...range, teamId, type, signal })
        : analyticsApi.getLeadTime(projectId, { ...range, teamId, type, signal }),
    enabled: !!projectId,
  });
}

export function useCycleTime(
  projectId: string,
  range: AnalyticsRange,
  teamId?: string | null,
  type?: string,
) {
  return useFlowTime('cycle', projectId, range, teamId, type);
}

export function useLeadTime(
  projectId: string,
  range: AnalyticsRange,
  teamId?: string | null,
  type?: string,
) {
  return useFlowTime('lead', projectId, range, teamId, type);
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
import { apiClient } from '@/shared/utils/apiClient';
import {
  AnalyticsSnapshotInfo,
  AnalyticsSummaryDto,
  BurndownDto,
  CumulativeFlowDto,
  FlowTimeDto,
  RecomputeDto,
  VelocityDto,
} from '@/shared/types/analytics';

export interface AnalyticsQueryParams {
  from?: string;
  to?: string;
  teamId?: string | null;
  type?: string;
  limit?: number;
}

function toQuery(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const analyticsApi = {
  getBurndown: (
    projectId: string,
    params: { iterationId: string | undefined; teamId?: string | null; signal?: AbortSignal },
  ) =>
    apiClient.get<BurndownDto>(
      `/projects/${projectId}/analytics/burndown${toQuery({
        iterationId: params.iterationId,
        teamId: params.teamId,
      })}`,
      { signal: params.signal },
    ),

  getVelocity: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<VelocityDto>(
      `/projects/${projectId}/analytics/velocity${toQuery({
        from: params.from,
        to: params.to,
        teamId: params.teamId,
      })}`,
      { signal: params.signal },
    ),

  getCumulativeFlow: (
    projectId: string,
    params: AnalyticsQueryParams & { bucketSizeDays?: number; groupBy?: 'category' | 'state'; signal?: AbortSignal },
  ) =>
    apiClient.get<CumulativeFlowDto>(
      `/projects/${projectId}/analytics/cumulative-flow${toQuery({
        from: params.from,
        to: params.to,
        bucketSizeDays: params.bucketSizeDays,
        groupBy: params.groupBy,
        teamId: params.teamId,
      })}`,
      { signal: params.signal },
    ),

  getCycleTime: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<FlowTimeDto>(
      `/projects/${projectId}/analytics/cycle-time${toQuery({
        from: params.from,
        to: params.to,
        type: params.type,
        limit: params.limit,
        teamId: params.teamId,
      })}`,
      { signal: params.signal },
    ),

  getLeadTime: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<FlowTimeDto>(
      `/projects/${projectId}/analytics/lead-time${toQuery({
        from: params.from,
        to: params.to,
        type: params.type,
        limit: params.limit,
        teamId: params.teamId,
      })}`,
      { signal: params.signal },
    ),

  getSummary: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<AnalyticsSummaryDto>(
      `/projects/${projectId}/analytics/summary${toQuery({
        from: params.from,
        to: params.to,
        teamId: params.teamId,
      })}`,
      { signal: params.signal },
    ),

  getSnapshots: (projectId: string, kind?: string) =>
    apiClient.get<AnalyticsSnapshotInfo[]>(
      `/projects/${projectId}/analytics/snapshots${toQuery({ kind })}`,
    ),

  recompute: (projectId: string, body?: { from?: string; to?: string }) =>
    apiClient.post<RecomputeDto>(`/projects/${projectId}/analytics/recompute`, body ?? {}),
};
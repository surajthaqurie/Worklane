import { apiClient } from '@/shared/utils/apiClient';
import {
  AnalyticsSnapshotInfo,
  AnalyticsSummaryDto,
  BurndownDto,
  CumulativeFlowDto,
  FlowTimeDto,
  RecomputeDto,
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

export interface AnalyticsQueryParams {
  from?: string;
  to?: string;
  teamId?: string | null;
  iterationId?: string;
  areaId?: string;
  workItemTypes?: string[] | string;
  states?: string[] | string;
  priorities?: string[] | string;
  assignedTo?: string[] | string;
  tags?: string[] | string;
  status?: string;
  groupBy?: string;
  type?: string;
  limit?: number;
  reportType?: string;
}

function toQuery(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        if (value.length > 0) sp.set(key, value.join(','));
      } else {
        sp.set(key, String(value));
      }
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const analyticsApi = {
  getSummary: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<AnalyticsSummaryDto>(
      `/projects/${projectId}/analytics/summary${toQuery(params)}`,
      { signal: params.signal },
    ),

  getOverview: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<AnalyticsSummaryDto>(
      `/projects/${projectId}/analytics/overview${toQuery(params)}`,
      { signal: params.signal },
    ),

  getProjectHealth: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<ProjectHealthDto>(
      `/projects/${projectId}/analytics/project-health${toQuery(params)}`,
      { signal: params.signal },
    ),

  getTeamAnalytics: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<TeamAnalyticsDto>(
      `/projects/${projectId}/analytics/team${toQuery(params)}`,
      { signal: params.signal },
    ),

  getIterationReport: (
    projectId: string,
    params: { iterationId: string; teamId?: string | null; signal?: AbortSignal },
  ) =>
    apiClient.get<IterationReportDto>(
      `/projects/${projectId}/analytics/iteration${toQuery({
        iterationId: params.iterationId,
        teamId: params.teamId,
      })}`,
      { signal: params.signal },
    ),

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
      `/projects/${projectId}/analytics/velocity${toQuery(params)}`,
      { signal: params.signal },
    ),

  getThroughput: (
    projectId: string,
    params: AnalyticsQueryParams & { groupBy?: 'day' | 'week' | 'month'; signal?: AbortSignal },
  ) =>
    apiClient.get<ThroughputDto>(
      `/projects/${projectId}/analytics/throughput${toQuery(params)}`,
      { signal: params.signal },
    ),

  getCumulativeFlow: (
    projectId: string,
    params: AnalyticsQueryParams & { bucketSizeDays?: number; groupBy?: 'category' | 'state'; signal?: AbortSignal },
  ) =>
    apiClient.get<CumulativeFlowDto>(
      `/projects/${projectId}/analytics/cumulative-flow${toQuery(params)}`,
      { signal: params.signal },
    ),

  getCycleTime: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<FlowTimeDto>(
      `/projects/${projectId}/analytics/cycle-time${toQuery(params)}`,
      { signal: params.signal },
    ),

  getLeadTime: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<FlowTimeDto>(
      `/projects/${projectId}/analytics/lead-time${toQuery(params)}`,
      { signal: params.signal },
    ),

  getAging: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<WorkItemAgingDto>(
      `/projects/${projectId}/analytics/aging${toQuery(params)}`,
      { signal: params.signal },
    ),

  getOverdue: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<OverdueReportDto>(
      `/projects/${projectId}/analytics/overdue${toQuery(params)}`,
      { signal: params.signal },
    ),

  getBlocked: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<BlockedReportDto>(
      `/projects/${projectId}/analytics/blocked${toQuery(params)}`,
      { signal: params.signal },
    ),

  getWorkDistribution: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<WorkDistributionDto>(
      `/projects/${projectId}/analytics/work-distribution${toQuery(params)}`,
      { signal: params.signal },
    ),

  getStateTransitions: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<StateTransitionsDto>(
      `/projects/${projectId}/analytics/state-transitions${toQuery(params)}`,
      { signal: params.signal },
    ),

  getTrends: (projectId: string, params: AnalyticsQueryParams & { signal?: AbortSignal }) =>
    apiClient.get<TrendsAnalyticsDto>(
      `/projects/${projectId}/analytics/trends${toQuery(params)}`,
      { signal: params.signal },
    ),

  getExportUrl: (projectId: string, params: AnalyticsQueryParams): string =>
    `/api/projects/${projectId}/analytics/export${toQuery(params)}`,

  listSavedReports: (projectId: string) =>
    apiClient.get<SavedReport[]>(`/projects/${projectId}/analytics/saved-reports`),

  createSavedReport: (projectId: string, payload: CreateSavedReportPayload) =>
    apiClient.post<SavedReport>(`/projects/${projectId}/analytics/saved-reports`, payload),

  deleteSavedReport: (projectId: string, reportId: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/analytics/saved-reports/${reportId}`),

  getOrgOverview: (orgId: string) =>
    apiClient.get<OrgAnalyticsOverviewDto>(`/orgs/${orgId}/analytics/overview`),

  getSnapshots: (projectId: string, kind?: string) =>
    apiClient.get<AnalyticsSnapshotInfo[]>(
      `/projects/${projectId}/analytics/snapshots${toQuery({ kind })}`,
    ),

  recompute: (projectId: string, body?: { from?: string; to?: string }) =>
    apiClient.post<RecomputeDto>(`/projects/${projectId}/analytics/recompute`, body ?? {}),
};
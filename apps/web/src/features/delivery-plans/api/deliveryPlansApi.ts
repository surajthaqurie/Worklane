import { apiClient } from '@/shared/utils/apiClient';
import {
  DeliveryPlan,
  DeliveryPlanTimeline,
  PlanTeam,
  TimelineQueryParams,
  WorkItemLink,
  WorkItemLinksResponse,
  CreateDeliveryPlanDto,
  UpdateDeliveryPlanDto,
  SetPlanTeamsDto,
  CreateDependencyDto,
} from '@/shared/types/delivery-plans';

export const deliveryPlansApi = {
  // ─── Plans ─────────────────────────────────────────────────────────────────

  getPlans: (projectId: string) =>
    apiClient.get<DeliveryPlan[]>(`/projects/${projectId}/delivery-plans`),

  getPlan: (projectId: string, planId: string) =>
    apiClient.get<DeliveryPlan>(`/projects/${projectId}/delivery-plans/${planId}`),

  createPlan: (projectId: string, data: CreateDeliveryPlanDto) =>
    apiClient.post<DeliveryPlan>(`/projects/${projectId}/delivery-plans`, data),

  updatePlan: (projectId: string, planId: string, data: UpdateDeliveryPlanDto) =>
    apiClient.patch<DeliveryPlan>(`/projects/${projectId}/delivery-plans/${planId}`, data),

  deletePlan: (projectId: string, planId: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/delivery-plans/${planId}`),

  // ─── Plan teams ───────────────────────────────────────────────────────────

  getPlanTeams: (projectId: string, planId: string) =>
    apiClient.get<PlanTeam[]>(`/projects/${projectId}/delivery-plans/${planId}/teams`),

  setPlanTeams: (projectId: string, planId: string, data: SetPlanTeamsDto) =>
    apiClient.patch<{ planId: string; teamCount: number }>(
      `/projects/${projectId}/delivery-plans/${planId}/teams`,
      data,
    ),

  // ─── Timeline ──────────────────────────────────────────────────────────────

  getTimeline: (projectId: string, planId: string, params?: TimelineQueryParams) => {
    const search = new URLSearchParams();
    if (params?.teamId) search.set('teamId', params.teamId);
    if (params?.iterationId) search.set('iterationId', params.iterationId);
    if (params?.limit != null) search.set('limit', String(params.limit));
    if (params?.offset != null) search.set('offset', String(params.offset));
    const qs = search.toString();
    return apiClient.get<DeliveryPlanTimeline>(
      `/projects/${projectId}/delivery-plans/${planId}/timeline${qs ? `?${qs}` : ''}`,
    );
  },

  // ─── Dependencies ──────────────────────────────────────────────────────────

  getDependencies: (projectId: string, workItemId: string) =>
    apiClient.get<WorkItemLinksResponse>(
      `/projects/${projectId}/work-items/${workItemId}/dependencies`,
    ),

  createDependency: (projectId: string, workItemId: string, data: CreateDependencyDto) =>
    apiClient.post<WorkItemLink | null>(
      `/projects/${projectId}/work-items/${workItemId}/dependencies`,
      data,
    ),

  removeDependency: (projectId: string, workItemId: string, targetWorkItemId: string) =>
    apiClient.delete<{ success: boolean }>(
      `/projects/${projectId}/work-items/${workItemId}/dependencies/${targetWorkItemId}`,
    ),
};
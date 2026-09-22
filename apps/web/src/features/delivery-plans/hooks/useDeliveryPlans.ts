import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryPlansApi } from '../api/deliveryPlansApi';
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
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';

function planKeys(projectId: string) {
  return ['projects', projectId, 'delivery-plans'] as const;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useDeliveryPlans(projectId: string) {
  return useQuery<DeliveryPlan[]>({
    queryKey: planKeys(projectId),
    queryFn: () => deliveryPlansApi.getPlans(projectId),
    enabled: !!projectId,
  });
}

export function useDeliveryPlan(projectId: string, planId: string) {
  return useQuery<DeliveryPlan>({
    queryKey: [...planKeys(projectId), planId],
    queryFn: () => deliveryPlansApi.getPlan(projectId, planId),
    enabled: !!projectId && !!planId,
  });
}

export function useDeliveryPlanTeams(projectId: string, planId: string) {
  return useQuery<PlanTeam[]>({
    queryKey: [...planKeys(projectId), planId, 'teams'],
    queryFn: () => deliveryPlansApi.getPlanTeams(projectId, planId),
    enabled: !!projectId && !!planId,
  });
}

export function useDeliveryPlanTimeline(
  projectId: string,
  planId: string,
  params?: TimelineQueryParams,
) {
  return useQuery<DeliveryPlanTimeline>({
    queryKey: [...planKeys(projectId), planId, 'timeline', params ?? {}],
    queryFn: () => deliveryPlansApi.getTimeline(projectId, planId, params),
    enabled: !!projectId && !!planId,
  });
}

export function useDependencies(projectId: string, workItemId: string | null) {
  return useQuery<WorkItemLinksResponse>({
    queryKey: ['projects', projectId, 'work-items', workItemId, 'dependencies'],
    queryFn: () => deliveryPlansApi.getDependencies(projectId, workItemId!),
    enabled: !!projectId && !!workItemId,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateDeliveryPlan(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateDeliveryPlanDto) => deliveryPlansApi.createPlan(projectId, data),
    onSuccess: () => {
      toast.showSuccess('Delivery plan created');
      queryClient.invalidateQueries({ queryKey: planKeys(projectId) });
    },
    onError: (err) => {
      toast.showError('Failed to create delivery plan', formatApiError(err));
    },
  });
}

export function useUpdateDeliveryPlan(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: UpdateDeliveryPlanDto }) =>
      deliveryPlansApi.updatePlan(projectId, planId, data),
    onSuccess: () => {
      toast.showSuccess('Delivery plan updated');
      queryClient.invalidateQueries({ queryKey: planKeys(projectId) });
    },
    onError: (err) => {
      toast.showError('Failed to update delivery plan', formatApiError(err));
    },
  });
}

export function useDeleteDeliveryPlan(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (planId: string) => deliveryPlansApi.deletePlan(projectId, planId),
    onSuccess: () => {
      toast.showSuccess('Delivery plan deleted');
      queryClient.invalidateQueries({ queryKey: planKeys(projectId) });
    },
    onError: (err) => {
      toast.showError('Failed to delete delivery plan', formatApiError(err));
    },
  });
}

export function useSetPlanTeams(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: SetPlanTeamsDto }) =>
      deliveryPlansApi.setPlanTeams(projectId, planId, data),
    onSuccess: () => {
      toast.showSuccess('Plan teams updated');
      queryClient.invalidateQueries({ queryKey: planKeys(projectId) });
    },
    onError: (err) => {
      toast.showError('Failed to update plan teams', formatApiError(err));
    },
  });
}

export function useCreateDependency(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      workItemId,
      data,
    }: {
      workItemId: string;
      data: CreateDependencyDto;
    }) => deliveryPlansApi.createDependency(projectId, workItemId, data),
    onSuccess: (_res, { workItemId, data }) => {
      toast.showSuccess('Dependency created');
      for (const id of [workItemId, data.targetWorkItemId]) {
        queryClient.invalidateQueries({
          queryKey: ['projects', projectId, 'work-items', id, 'dependencies'],
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'delivery-plans'],
      });
    },
    onError: (err) => {
      toast.showError('Failed to create dependency', formatApiError(err));
    },
  });
}

export function useRemoveDependency(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ workItemId, targetWorkItemId }: { workItemId: string; targetWorkItemId: string }) =>
      deliveryPlansApi.removeDependency(projectId, workItemId, targetWorkItemId),
    onSuccess: (_res, { workItemId, targetWorkItemId }) => {
      toast.showSuccess('Dependency removed');
      for (const id of [workItemId, targetWorkItemId]) {
        queryClient.invalidateQueries({
          queryKey: ['projects', projectId, 'work-items', id, 'dependencies'],
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'delivery-plans'],
      });
    },
    onError: (err) => {
      toast.showError('Failed to remove dependency', formatApiError(err));
    },
  });
}

export type {
  DeliveryPlan,
  DeliveryPlanTimeline,
  PlanTeam,
  WorkItemLink,
  WorkItemLinksResponse,
};
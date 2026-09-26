import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardsApi } from '../api/dashboardsApi';
import type {
  DashboardData,
  DashboardLayoutResponse,
  WidgetLayout,
} from '@/shared/types/dashboard';

export const dashboardKeys = {
  layout: (projectId?: string | null) => ['dashboard-layout', projectId || 'global'] as const,
  data: (projectId?: string | null, teamId?: string | null) =>
    ['dashboard-data', projectId || 'global', teamId || 'all'] as const,
};

export function useDashboardLayout(projectId?: string | null) {
  return useQuery<DashboardLayoutResponse>({
    queryKey: dashboardKeys.layout(projectId),
    queryFn: () => dashboardsApi.getLayout(projectId),
    staleTime: 60_000,
  });
}

export function useUpdateDashboardLayout(projectId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (widgets: WidgetLayout[]) =>
      dashboardsApi.updateLayout({ projectId: projectId || null, widgets }),
    onMutate: async (newWidgets: WidgetLayout[]) => {
      await queryClient.cancelQueries({ queryKey: dashboardKeys.layout(projectId) });
      const previous = queryClient.getQueryData<DashboardLayoutResponse>(
        dashboardKeys.layout(projectId),
      );

      queryClient.setQueryData<DashboardLayoutResponse>(
        dashboardKeys.layout(projectId),
        {
          projectId: projectId || null,
          widgets: newWidgets,
        },
      );

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dashboardKeys.layout(projectId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.layout(projectId) });
    },
  });
}

export function useResetDashboardLayout(projectId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => dashboardsApi.resetLayout(projectId),
    onSuccess: (data) => {
      queryClient.setQueryData(dashboardKeys.layout(projectId), data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.layout(projectId) });
    },
  });
}

export function useDashboardData(projectId?: string | null, teamId?: string | null) {
  return useQuery<DashboardData>({
    queryKey: dashboardKeys.data(projectId, teamId),
    queryFn: () => dashboardsApi.getDashboardData(projectId, teamId),
    staleTime: 30_000, // 30s cache prevents duplicate queries across widgets
    refetchOnWindowFocus: false,
  });
}

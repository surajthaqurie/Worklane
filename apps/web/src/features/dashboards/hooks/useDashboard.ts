import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardsApi } from '../api/dashboardsApi';
import type {
  DashboardData,
  DashboardLayoutResponse,
  WidgetLayout,
} from '@/shared/types/dashboard';

export function useDashboardLayout(projectId?: string | null) {
  const scopeKey = projectId || 'global';
  return useQuery<DashboardLayoutResponse>({
    queryKey: ['dashboard-layout', scopeKey],
    queryFn: () => dashboardsApi.getLayout(projectId),
    staleTime: 60_000,
  });
}

export function useUpdateDashboardLayout(projectId?: string | null) {
  const queryClient = useQueryClient();
  const scopeKey = projectId || 'global';

  return useMutation({
    mutationFn: (widgets: WidgetLayout[]) =>
      dashboardsApi.updateLayout({ projectId: projectId || null, widgets }),
    onMutate: async (newWidgets: WidgetLayout[]) => {
      await queryClient.cancelQueries({ queryKey: ['dashboard-layout', scopeKey] });
      const previous = queryClient.getQueryData<DashboardLayoutResponse>([
        'dashboard-layout',
        scopeKey,
      ]);

      queryClient.setQueryData<DashboardLayoutResponse>(
        ['dashboard-layout', scopeKey],
        {
          projectId: projectId || null,
          widgets: newWidgets,
        },
      );

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['dashboard-layout', scopeKey], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layout', scopeKey] });
    },
  });
}

export function useResetDashboardLayout(projectId?: string | null) {
  const queryClient = useQueryClient();
  const scopeKey = projectId || 'global';

  return useMutation({
    mutationFn: () => dashboardsApi.resetLayout(projectId),
    onSuccess: (data) => {
      queryClient.setQueryData(['dashboard-layout', scopeKey], data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layout', scopeKey] });
    },
  });
}

export function useDashboardData(projectId?: string | null, teamId?: string | null) {
  const scopeKey = projectId || 'global';
  const teamKey = teamId || 'all';

  return useQuery<DashboardData>({
    queryKey: ['dashboard-data', scopeKey, teamKey],
    queryFn: () => dashboardsApi.getDashboardData(projectId, teamId),
    staleTime: 30_000, // 30s cache prevents duplicate queries across widgets
    refetchOnWindowFocus: false,
  });
}

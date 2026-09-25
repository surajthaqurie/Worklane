import { apiClient } from '@/shared/utils/apiClient';
import type {
  DashboardData,
  DashboardLayoutResponse,
  WidgetLayout,
} from '@/shared/types/dashboard';

export const dashboardsApi = {
  getLayout: (projectId?: string | null) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return apiClient.get<DashboardLayoutResponse>(`/dashboards/layout${qs}`);
  },

  updateLayout: (data: { projectId?: string | null; widgets: WidgetLayout[] }) => {
    return apiClient.put<DashboardLayoutResponse>('/dashboards/layout', data);
  },

  resetLayout: (projectId?: string | null) => {
    return apiClient.post<DashboardLayoutResponse>('/dashboards/layout/reset', {
      projectId: projectId || null,
    });
  },

  getDashboardData: (projectId?: string | null, teamId?: string | null) => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (teamId) params.set('teamId', teamId);
    const qs = params.toString();
    return apiClient.get<DashboardData>(`/dashboards/data${qs ? `?${qs}` : ''}`);
  },
};

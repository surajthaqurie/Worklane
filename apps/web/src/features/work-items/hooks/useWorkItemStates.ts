import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workItemStatesApi } from '../api/workItemStatesApi';
import { WorkItemState } from '@/shared/types/work-items';

export function useWorkItemStates(projectId: string) {
  return useQuery<WorkItemState[]>({
    queryKey: ['projects', projectId, 'work-item-states'],
    queryFn: () => workItemStatesApi.getStates(projectId),
    enabled: !!projectId,
  });
}

export function useCreateWorkItemState(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string; isDone?: boolean }) =>
      workItemStatesApi.createState(projectId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-item-states'] }),
  });
}

export function useUpdateWorkItemState(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorkItemState> }) =>
      workItemStatesApi.updateState(projectId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-item-states'] }),
  });
}

export function useDeleteWorkItemState(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workItemStatesApi.deleteState(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-item-states'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
}

export function useReorderWorkItemStates(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => workItemStatesApi.reorderStates(projectId, orderedIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'work-item-states'] }),
  });
}

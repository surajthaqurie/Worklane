import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iterationsApi } from '../api/iterationsApi';
import { Iteration, CreateIterationDto, UpdateIterationDto } from '@/shared/types/iterations';
import { SprintBoard } from '@/shared/types/boards';
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';

export function useIterations(projectId: string, teamId?: string | null) {
  return useQuery<Iteration[]>({
    queryKey: ['projects', projectId, 'iterations', { teamId: teamId ?? null }],
    queryFn: ({ signal }) => iterationsApi.getIterations(projectId, teamId, signal),
    enabled: !!projectId,
  });
}

export function useIteration(projectId: string, iterationId: string) {
  return useQuery<Iteration>({
    queryKey: ['projects', projectId, 'iterations', iterationId],
    queryFn: () => iterationsApi.getIteration(projectId, iterationId),
    enabled: !!projectId && !!iterationId,
  });
}

export function useCreateIteration(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateIterationDto) => iterationsApi.createIteration(projectId, data),
    onSuccess: (newIteration) => {
      toast.showSuccess('Iteration created', newIteration.name);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
    },
    onError: (err) => {
      toast.showError('Failed to create iteration', formatApiError(err));
    },
  });
}

export function useUpdateIteration(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ iterationId, data }: { iterationId: string; data: UpdateIterationDto }) =>
      iterationsApi.updateIteration(projectId, iterationId, data),
    onSuccess: () => {
      toast.showSuccess('Iteration updated');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
    },
    onError: (err) => {
      toast.showError('Failed to update iteration', formatApiError(err));
    },
  });
}

export function useDeleteIteration(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (iterationId: string) => iterationsApi.deleteIteration(projectId, iterationId),
    onSuccess: () => {
      toast.showSuccess('Iteration deleted');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
    },
    onError: (err) => {
      toast.showError('Failed to delete iteration', formatApiError(err));
    },
  });
}

export function useSprintBoard(projectId: string, iterationId: string) {
  return useQuery<SprintBoard>({
    queryKey: ['projects', projectId, 'iterations', iterationId, 'board'],
    queryFn: () => iterationsApi.getSprintBoard(projectId, iterationId),
    enabled: !!projectId && !!iterationId,
  });
}

export function useAddWorkItemToIteration(projectId: string, iterationId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (workItemId: string) => iterationsApi.addWorkItem(projectId, iterationId, workItemId),
    onSuccess: () => {
      toast.showSuccess('Work item added to sprint');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
    onError: (err) => {
      toast.showError('Failed to add work item to sprint', formatApiError(err));
    },
  });
}

export function useRemoveWorkItemFromIteration(projectId: string, iterationId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (workItemId: string) => iterationsApi.removeWorkItem(projectId, iterationId, workItemId),
    onSuccess: () => {
      toast.showSuccess('Work item removed from sprint');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
    onError: (err) => {
      toast.showError('Failed to remove work item from sprint', formatApiError(err));
    },
  });
}

export function useActivateIteration(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (iterationId: string) => iterationsApi.activateIteration(projectId, iterationId),
    onSuccess: () => {
      toast.showSuccess('Sprint activated!');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'iterations'] });
    },
    onError: (err) => {
      toast.showError('Failed to activate sprint', formatApiError(err));
    },
  });
}

export function useCompleteIteration(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      iterationId,
      moveRemainingToIterationId,
    }: {
      iterationId: string;
      moveRemainingToIterationId?: string | null;
    }) => iterationsApi.completeIteration(projectId, iterationId, moveRemainingToIterationId),
    onSuccess: () => {
      toast.showSuccess('Sprint completed!');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
    onError: (err) => {
      toast.showError('Failed to complete sprint', formatApiError(err));
    },
  });
}

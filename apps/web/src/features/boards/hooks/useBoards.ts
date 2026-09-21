import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boardsApi, FilterConfig } from '../api/boardsApi';
import { BoardConfig, BoardColumn, CardFields, SwimlaneType, WipBlockInfo } from '@/shared/types/boards';
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';
import { ApiError } from '@/shared/types/api';
import {
  updateWorkItemInCache,
  invalidateWorkItemScopes,
  cancelWorkItemScopes,
} from '@/features/work-items/hooks/useWorkItems';

/** Structured WIP rejection details, mirrored from the API's WipLimitExceededException. */
export interface WipBlockDetails extends WipBlockInfo {
  code: 'WIP_LIMIT_EXCEEDED';
}

interface WipLimitDetails {
  code: string;
  columnId?: string;
  columnName?: string;
  currentCount?: number;
  wipLimit?: number;
}

const WIP_CODE = 'WIP_LIMIT_EXCEEDED';

/** Extracts the structured WIP block info from an API error, when present. */
export function getWipBlockDetails(error: unknown): WipBlockDetails | null {
  if (!(error instanceof ApiError) || error.statusCode !== 409) return null;
  const details = error.details as
    | { details?: Partial<WipLimitDetails>; code?: string; columnId?: string; columnName?: string; currentCount?: number; wipLimit?: number }
    | undefined;
  const inner = details?.details ?? details;
  if (inner?.code !== WIP_CODE) return null;
  if (inner.columnName == null || inner.currentCount == null || inner.wipLimit == null) return null;
  return {
    code: WIP_CODE,
    columnId: inner.columnId ?? '',
    columnName: inner.columnName,
    currentCount: inner.currentCount,
    wipLimit: inner.wipLimit,
  };
}

/** Human-friendly message for a client- or server-side WIP block. */
export function wipBlockMessage(info: WipBlockInfo): string {
  return `"${info.columnName}" is at its WIP limit (${info.currentCount}/${info.wipLimit}). Move an item out of that column first, or use the override in the move.`;
}

export function useBoards(projectId: string, teamId?: string | null) {
  return useQuery<BoardConfig[]>({
    queryKey: ['projects', projectId, 'boards', { teamId: teamId ?? null }],
    queryFn: () => boardsApi.getBoards(projectId, teamId),
    enabled: !!projectId,
  });
}

export function useBoard(projectId: string, boardId: string | null) {
  return useQuery<BoardConfig>({
    queryKey: ['projects', projectId, 'boards', boardId],
    queryFn: () => boardsApi.getBoard(projectId, boardId!),
    enabled: !!projectId && !!boardId,
  });
}

export function useCreateBoard(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      teamId?: string | null;
      swimlane?: SwimlaneType;
      columns?: BoardColumn[];
      cardFields?: CardFields;
      filterConfig?: FilterConfig;
    }) => boardsApi.createBoard(projectId, data),
    onSuccess: (newBoard) => {
      toast.showSuccess('Board created', `Created "${newBoard.name}"`);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boards'] });
    },
    onError: (err) => {
      toast.showError('Failed to create board', formatApiError(err));
    },
  });
}

export function useUpdateBoard(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      boardId,
      data,
    }: {
      boardId: string;
      data: Partial<Omit<BoardConfig, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>;
    }) => boardsApi.updateBoard(projectId, boardId, data),
    onSuccess: (updated) => {
      toast.showSuccess('Board configuration saved', `Updated board "${updated.name}"`);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boards'] });
    },
    onError: (err) => {
      toast.showError('Failed to update board', formatApiError(err));
    },
  });
}

export function useDeleteBoard(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (boardId: string) => boardsApi.deleteBoard(projectId, boardId),
    onSuccess: () => {
      toast.showSuccess('Board deleted');
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boards'] });
    },
    onError: (err) => {
      toast.showError('Failed to delete board', formatApiError(err));
    },
  });
}

export interface BoardMoveInput {
  workItemId: string;
  state: string;
  /** The item's state before the optimistic update, used to roll back on failure. */
  previousState: string;
  expectedVersion?: number;
  bypassWip?: boolean;
}

/**
 * WIP-aware board move with optimistic UI: the item is moved to the target
 * state in every cached work-item scope immediately, then rolled back and
 * surfaced with structured feedback if the server rejects it (e.g. 409
 * WIP_LIMIT_EXCEEDED — never silently dropped).
 */
export function useBoardMoveWorkItem(projectId: string, boardId: string | null | undefined) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ workItemId, state, expectedVersion, bypassWip }: BoardMoveInput) => {
      if (!boardId) {
        throw new Error('No board selected — cannot move work item');
      }
      return boardsApi.moveWorkItem(projectId, boardId, workItemId, { state, expectedVersion, bypassWip });
    },
    onMutate: async ({ workItemId, state }) => {
      await cancelWorkItemScopes(queryClient, projectId);
      updateWorkItemInCache(queryClient, projectId, workItemId, (item) => ({ ...item, state }));
    },
    onError: (err, { workItemId, previousState }) => {
      const wip = getWipBlockDetails(err);
      if (wip) {
        toast.showError('Move blocked — WIP limit reached', wipBlockMessage(wip));
      } else {
        toast.showError('Move failed', formatApiError(err));
      }
      if (previousState) {
        updateWorkItemInCache(queryClient, projectId, workItemId, (item) => ({
          ...item,
          state: previousState,
        }));
      } else {
        invalidateWorkItemScopes(queryClient, projectId);
      }
    },
    onSettled: () => {
      invalidateWorkItemScopes(queryClient, projectId);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boards'] });
    },
  });
}

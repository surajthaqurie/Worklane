import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { csvImportApi } from '../api/csvImportApi';
import type { CsvImportMode } from '../types';

export function useParseCsv(projectId: string) {
  return useMutation({
    mutationFn: (fileOrContent: File | string) =>
      csvImportApi.parseCsv(projectId, fileOrContent),
  });
}

export function useValidateCsv(projectId: string) {
  return useMutation({
    mutationFn: ({
      rows,
      mapping,
    }: {
      rows: Record<string, string>[];
      mapping: Record<string, string>;
    }) => csvImportApi.validateCsv(projectId, rows, mapping),
  });
}

export function useExecuteImport(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rows,
      mapping,
      mode,
      isAsync,
    }: {
      rows: Record<string, string>[];
      mapping: Record<string, string>;
      mode: CsvImportMode;
      isAsync?: boolean;
    }) => csvImportApi.executeImport(projectId, rows, mapping, mode, isAsync),
    onSuccess: (result) => {
      if (!result.isAsync) {
        queryClient.invalidateQueries({ queryKey: ['work-items'] });
        queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      }
    },
  });
}

export function useImportJobStatus(jobId: string | null | undefined, enabled = true) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['import-job-status', jobId],
    queryFn: () => csvImportApi.getJobStatus(jobId!),
    enabled: Boolean(jobId) && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status;
      if (status === 'COMPLETED' || status === 'FAILED' || status === 'DEAD_LETTER') {
        if (status === 'COMPLETED') {
          queryClient.invalidateQueries({ queryKey: ['work-items'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
        }
        return false;
      }
      return 1000; // Poll every second while PROCESSING or PENDING
    },
  });
}

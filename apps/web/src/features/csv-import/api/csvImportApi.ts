import { apiClient } from '@/shared/utils/apiClient';
import type {
  CsvImportMode,
  CsvImportResult,
  CsvParseResult,
  CsvValidationResult,
} from '../types';

export const csvImportApi = {
  parseCsv: async (projectId: string, fileOrContent: File | string): Promise<CsvParseResult> => {
    if (typeof fileOrContent === 'string') {
      return apiClient.post<CsvParseResult>(
        `/projects/${projectId}/csv-import/parse`,
        { csvContent: fileOrContent },
      );
    }

    // Read file as text in browser
    const content = await fileOrContent.text();
    return apiClient.post<CsvParseResult>(
      `/projects/${projectId}/csv-import/parse`,
      { csvContent: content },
    );
  },

  validateCsv: (
    projectId: string,
    rows: Record<string, string>[],
    mapping: Record<string, string>,
  ): Promise<CsvValidationResult> => {
    return apiClient.post<CsvValidationResult>(
      `/projects/${projectId}/csv-import/validate`,
      { rows, mapping },
    );
  },

  executeImport: (
    projectId: string,
    rows: Record<string, string>[],
    mapping: Record<string, string>,
    mode: CsvImportMode = 'ALL_OR_NOTHING',
    isAsync = false,
  ): Promise<CsvImportResult> => {
    return apiClient.post<CsvImportResult>(
      `/projects/${projectId}/csv-import/execute`,
      { rows, mapping, mode, async: isAsync },
    );
  },

  getJobStatus: (jobId: string) => {
    return apiClient.get<{ job: import('../types').CsvJobStatus }>(`/background-jobs/${jobId}`);
  },
};

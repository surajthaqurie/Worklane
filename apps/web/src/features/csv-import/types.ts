export interface CsvRowError {
  row: number;
  field: string;
  message: string;
  rawValue?: string;
}

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  delimiter: string;
  sampleRows: Record<string, string>[];
  suggestedMapping: Record<string, string>;
}

export interface ValidatedRow {
  rowNumber: number;
  title: string;
  type: string;
  state: string;
  description: string | null;
  assignedTo: string | null;
  areaId: string;
  iterationId: string | null;
  parentId: string | null;
  parentRowNumber?: number | null;
  priority: string;
  severity: string | null;
  points: number | null;
  remainingWork: number | null;
  completedWork: number | null;
  startDate: string | null;
  targetDate: string | null;
  tags: string[];
}

export interface CsvValidationResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  validRows: ValidatedRow[];
  errors: CsvRowError[];
  canImport: boolean;
  headers: string[];
  suggestedMapping: Record<string, string>;
}

export type CsvImportMode = 'ALL_OR_NOTHING' | 'SKIP_INVALID';

export interface CsvImportResult {
  status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'PROCESSING';
  isAsync: boolean;
  jobId?: string;
  importedCount: number;
  failedCount: number;
  skippedCount: number;
  importedItems: Array<{ id: string; seqNo: number; title: string }>;
  errors: CsvRowError[];
  message?: string;
}

export interface CsvJobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
  progress: number;
  result?: CsvImportResult | null;
  errorMessage?: string | null;
}


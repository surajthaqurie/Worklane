import type { WorkItemTypeName } from '../work-items/work-item-types.registry.js';

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
  type: WorkItemTypeName;
  state: string;
  description: string | null;
  assignedTo: string | null;
  areaId: string;
  iterationId: string | null;
  parentId: string | null;
  parentRowNumber?: number | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
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
  status: 'COMPLETED' | 'FAILED';
  isAsync: boolean;
  jobId?: string;
  importedCount: number;
  failedCount: number;
  skippedCount: number;
  importedItems: Array<{ id: string; seqNo: number; title: string }>;
  errors: CsvRowError[];
  message?: string;
}

export interface ProjectDomainContext {
  projectId: string;
  states: Array<{ id: string; key: string; name: string; is_done: boolean; category: string }>;
  defaultStateKey: string;
  areas: Array<{ id: string; name: string }>;
  defaultAreaId: string;
  iterations: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string; email: string }>;
  existingWorkItems: Array<{ id: string; seq_no: number; title: string; type: WorkItemTypeName }>;
}

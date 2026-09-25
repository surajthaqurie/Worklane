import type { CsvRowError } from '../types';

export function downloadCsvFile(content: string, filename: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function escapeCsvCell(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatErrorReportCsv(
  errors: CsvRowError[],
  rawRows: Record<string, string>[],
): string {
  if (errors.length === 0) return '';

  const rawHeaders = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const headers = ['Row Number', 'Failed Field', 'Error Reason', 'Failed Value', ...rawHeaders];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const err of errors) {
    const rawRow = rawRows[err.row - 1] || {};
    const rowValues = rawHeaders.map((h) => rawRow[h] ?? '');
    const rowLine = [
      err.row,
      err.field,
      err.message,
      err.rawValue ?? '',
      ...rowValues,
    ];
    lines.push(rowLine.map(escapeCsvCell).join(','));
  }

  return lines.join('\r\n');
}

export function downloadErrorReport(
  errors: CsvRowError[],
  rawRows: Record<string, string>[],
) {
  const csvContent = formatErrorReportCsv(errors, rawRows);
  if (!csvContent) return;
  const filename = `worklane-import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsvFile(csvContent, filename);
}

export function getSampleTemplateCsv(): string {
  return `Title,Type,State,Priority,Points,Assignee,Area,Iteration,Parent,Tags,StartDate,TargetDate,Description
"Setup Authentication","STORY","To Do","HIGH",5,"","Frontend","Sprint 1","","auth, security","2026-10-01","2026-10-15","Implement OAuth and login flows"
"Fix mobile overflow bug","BUG","To Do","URGENT",2,"","Frontend","Sprint 1","Setup Authentication","bug, mobile","","","Horizontal scroll issue on iOS Safari"
"Database Indexing","TASK","To Do","MEDIUM",3,"","Backend","","","database, performance","","","Add index to work_items search vector"`;
}

export function downloadSampleTemplate() {
  downloadCsvFile(getSampleTemplateCsv(), 'worklane-import-template.csv');
}

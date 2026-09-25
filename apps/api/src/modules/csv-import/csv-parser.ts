import type { CsvParseResult } from './csv-import.types.js';

const FIELD_ALIASES: Record<string, string[]> = {
  title: ['title', 'name', 'summary', 'item title', 'task title', 'issue title', 'story title'],
  type: ['type', 'work item type', 'item type', 'issue type', 'kind', 'tracker'],
  description: ['description', 'desc', 'details', 'body', 'notes', 'summary description'],
  state: ['state', 'status', 'workflow state', 'stage'],
  priority: ['priority', 'prio', 'urgency'],
  severity: ['severity', 'impact', 'criticity'],
  assignedTo: ['assigned to', 'assigned_to', 'assignee', 'owner', 'assigned user', 'assigned email'],
  area: ['area', 'area path', 'component', 'module', 'team area'],
  iteration: ['iteration', 'iteration path', 'sprint', 'milestone', 'cycle'],
  parent: ['parent', 'parent id', 'parent seq', 'parent item', 'epic', 'parent work item'],
  points: ['points', 'story points', 'estimate', 'effort', 'story_points', 'sp'],
  remainingWork: ['remaining work', 'remaining_work', 'remaining', 'hours remaining'],
  completedWork: ['completed work', 'completed_work', 'completed', 'hours completed'],
  startDate: ['start date', 'start_date', 'start', 'begins'],
  targetDate: ['target date', 'target_date', 'due date', 'due_date', 'deadline', 'due'],
  tags: ['tags', 'labels', 'tag', 'label', 'categories'],
};

export function detectDelimiter(text: string): string {
  // Check the first line
  const firstLine = text.split(/\r\n|\r|\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

export function parseCsvRaw(content: string, customDelimiter?: string): string[][] {
  let text = content;
  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const delimiter = customDelimiter || detectDelimiter(text);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        // Escaped quote
        currentCell += '"';
        i += 2;
        continue;
      }
      // Toggle quotation state
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      i++;
      continue;
    }

    if ((char === '\r' || char === '\n') && !inQuotes) {
      // Handle CRLF or LF
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      // Skip empty blank lines
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      i++;
      continue;
    }

    currentCell += char;
    i++;
  }

  // Push final cell and row
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function suggestFieldMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const mappedTargets = new Set<string>();

  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    for (const [targetField, aliases] of Object.entries(FIELD_ALIASES)) {
      if (mappedTargets.has(targetField)) continue;

      if (aliases.includes(normalized) || aliases.some((a) => normalized === a.replace(/_/g, ' '))) {
        mapping[header] = targetField;
        mappedTargets.add(targetField);
        break;
      }
    }
  }

  return mapping;
}

export function parseCsv(content: string, customDelimiter?: string): CsvParseResult {
  const delimiter = customDelimiter || detectDelimiter(content);
  const rawGrid = parseCsvRaw(content, delimiter);

  if (rawGrid.length === 0) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      delimiter,
      sampleRows: [],
      suggestedMapping: {},
    };
  }

  const rawHeaders = rawGrid[0];
  const headers = rawHeaders.map((h, idx) => (h.trim() ? h.trim() : `Column_${idx + 1}`));
  const dataRows = rawGrid.slice(1);

  const rows: Record<string, string>[] = [];
  for (const dataRow of dataRows) {
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = dataRow[c] !== undefined ? dataRow[c] : '';
    }
    // Only include if at least one cell has content
    if (Object.values(obj).some((val) => val.trim() !== '')) {
      rows.push(obj);
    }
  }

  const suggestedMapping = suggestFieldMapping(headers);

  return {
    headers,
    rows,
    totalRows: rows.length,
    delimiter,
    sampleRows: rows.slice(0, 5),
    suggestedMapping,
  };
}

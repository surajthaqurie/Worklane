import type {
  CsvRowError,
  CsvValidationResult,
  ProjectDomainContext,
  ValidatedRow,
} from './csv-import.types.js';
import type { WorkItemTypeName } from '../work-items/work-item-types.registry.js';

const VALID_TYPES: WorkItemTypeName[] = ['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG'];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const ALLOWED_PARENT_TYPES: Record<WorkItemTypeName, WorkItemTypeName[]> = {
  EPIC: [],
  FEATURE: ['EPIC'],
  STORY: ['FEATURE', 'EPIC'],
  TASK: ['STORY', 'BUG', 'FEATURE'],
  BUG: ['FEATURE', 'EPIC'],
};

export function validateCsvRows(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  context: ProjectDomainContext,
): CsvValidationResult {
  const validRows: ValidatedRow[] = [];
  const errors: CsvRowError[] = [];

  // Invert mapping for quick lookup: targetField -> sourceHeader
  const targetToHeader: Record<string, string> = {};
  for (const [header, target] of Object.entries(mapping)) {
    if (target) {
      targetToHeader[target] = header;
    }
  }

  // Pre-index context lookups for O(1) performance
  const stateByNorm = new Map<string, string>(); // norm -> key
  for (const s of context.states) {
    stateByNorm.set(s.key.toLowerCase(), s.key);
    stateByNorm.set(s.name.toLowerCase(), s.key);
  }

  const areaByName = new Map<string, string>(); // norm -> id
  for (const a of context.areas) {
    areaByName.set(a.id.toLowerCase(), a.id);
    areaByName.set(a.name.toLowerCase(), a.id);
  }

  const iterationByName = new Map<string, string>(); // norm -> id
  for (const it of context.iterations) {
    iterationByName.set(it.id.toLowerCase(), it.id);
    iterationByName.set(it.name.toLowerCase(), it.id);
  }

  const memberByNorm = new Map<string, string>(); // norm -> id
  for (const m of context.members) {
    memberByNorm.set(m.id.toLowerCase(), m.id);
    memberByNorm.set(m.email.toLowerCase(), m.id);
    memberByNorm.set(m.name.toLowerCase(), m.id);
  }

  const itemById = new Map<string, { id: string; type: WorkItemTypeName; title: string }>();
  const itemBySeq = new Map<number, { id: string; type: WorkItemTypeName; title: string }>();
  const itemByTitle = new Map<string, { id: string; type: WorkItemTypeName; title: string }>();

  for (const item of context.existingWorkItems) {
    itemById.set(item.id.toLowerCase(), item);
    itemBySeq.set(item.seq_no, item);
    itemByTitle.set(item.title.toLowerCase().trim(), item);
  }

  // Track earlier rows in CSV for intra-file parent resolution
  const earlierRowMap = new Map<string, { rowNumber: number; type: WorkItemTypeName; title: string }>();

  for (let idx = 0; idx < rows.length; idx++) {
    const rawRow = rows[idx];
    const rowNumber = idx + 1; // 1-indexed for human readability
    const rowErrors: CsvRowError[] = [];

    const getVal = (targetField: string): string => {
      const header = targetToHeader[targetField];
      if (!header) return '';
      return (rawRow[header] ?? '').trim();
    };

    // 1. Required Field: Title
    const rawTitle = getVal('title');
    if (!rawTitle) {
      rowErrors.push({
        row: rowNumber,
        field: 'title',
        message: 'Title is required',
        rawValue: rawTitle,
      });
    } else if (rawTitle.length > 255) {
      rowErrors.push({
        row: rowNumber,
        field: 'title',
        message: 'Title must not exceed 255 characters',
        rawValue: rawTitle,
      });
    }

    // 2. Work-Item Type
    const rawType = getVal('type').toUpperCase();
    let type: WorkItemTypeName = 'TASK';
    if (!rawType) {
      // Default to TASK if omitted
      type = 'TASK';
    } else if (!VALID_TYPES.includes(rawType as WorkItemTypeName)) {
      rowErrors.push({
        row: rowNumber,
        field: 'type',
        message: `Invalid work item type '${rawType}'. Must be one of: ${VALID_TYPES.join(', ')}`,
        rawValue: rawType,
      });
    } else {
      type = rawType as WorkItemTypeName;
    }

    // 3. State
    const rawState = getVal('state');
    let state = context.defaultStateKey;
    if (rawState) {
      const resolvedState = stateByNorm.get(rawState.toLowerCase());
      if (resolvedState) {
        state = resolvedState;
      } else {
        rowErrors.push({
          row: rowNumber,
          field: 'state',
          message: `State '${rawState}' not found in project`,
          rawValue: rawState,
        });
      }
    }

    // 4. Description
    const rawDescription = getVal('description') || null;

    // 5. Users (Assigned To)
    const rawAssignee = getVal('assignedTo');
    let assignedTo: string | null = null;
    if (rawAssignee) {
      const resolvedUser = memberByNorm.get(rawAssignee.toLowerCase());
      if (resolvedUser) {
        assignedTo = resolvedUser;
      } else {
        rowErrors.push({
          row: rowNumber,
          field: 'assignedTo',
          message: `User '${rawAssignee}' is not a member of this project`,
          rawValue: rawAssignee,
        });
      }
    }

    // 6. Area
    const rawArea = getVal('area');
    let areaId = context.defaultAreaId;
    if (rawArea) {
      const resolvedArea = areaByName.get(rawArea.toLowerCase());
      if (resolvedArea) {
        areaId = resolvedArea;
      } else {
        rowErrors.push({
          row: rowNumber,
          field: 'area',
          message: `Area '${rawArea}' not found in project`,
          rawValue: rawArea,
        });
      }
    }

    // 7. Iteration
    const rawIteration = getVal('iteration');
    let iterationId: string | null = null;
    if (rawIteration && rawIteration.toLowerCase() !== 'backlog') {
      const resolvedIteration = iterationByName.get(rawIteration.toLowerCase());
      if (resolvedIteration) {
        iterationId = resolvedIteration;
      } else {
        rowErrors.push({
          row: rowNumber,
          field: 'iteration',
          message: `Iteration '${rawIteration}' not found in project`,
          rawValue: rawIteration,
        });
      }
    }

    // 8. Parent Relationship
    const rawParent = getVal('parent');
    let parentId: string | null = null;
    let parentRowNumber: number | null = null;
    let parentType: WorkItemTypeName | null = null;

    if (rawParent) {
      // Clean parent input (strip # or KEY- prefix if present)
      const cleanParent = rawParent.trim();
      const parentSeqMatch = cleanParent.match(/(?:[a-zA-Z]+-)?#?(\d+)/);

      // Check existing project items by UUID
      if (itemById.has(cleanParent.toLowerCase())) {
        const found = itemById.get(cleanParent.toLowerCase())!;
        parentId = found.id;
        parentType = found.type;
      } else if (parentSeqMatch && itemBySeq.has(parseInt(parentSeqMatch[1], 10))) {
        // Match by Seq No in existing items
        const found = itemBySeq.get(parseInt(parentSeqMatch[1], 10))!;
        parentId = found.id;
        parentType = found.type;
      } else if (itemByTitle.has(cleanParent.toLowerCase())) {
        // Match by existing item title
        const found = itemByTitle.get(cleanParent.toLowerCase())!;
        parentId = found.id;
        parentType = found.type;
      } else if (earlierRowMap.has(cleanParent.toLowerCase())) {
        // Match earlier row in the same CSV
        const earlier = earlierRowMap.get(cleanParent.toLowerCase())!;
        parentRowNumber = earlier.rowNumber;
        parentType = earlier.type;
      } else {
        rowErrors.push({
          row: rowNumber,
          field: 'parent',
          message: `Parent item '${rawParent}' could not be found in project or earlier CSV rows`,
          rawValue: rawParent,
        });
      }

      // Hierarchy validation if parent found
      if (parentType) {
        const allowedParents = ALLOWED_PARENT_TYPES[type];
        if (!allowedParents || !allowedParents.includes(parentType)) {
          rowErrors.push({
            row: rowNumber,
            field: 'parent',
            message: `Invalid parent hierarchy: ${type} cannot have a parent of type ${parentType}`,
            rawValue: rawParent,
          });
        }
      }
    } else {
      // No parent specified. Epic cannot have parent, but other types are valid without parent
    }

    // 9. Numeric Fields: Points
    const rawPoints = getVal('points');
    let points: number | null = null;
    if (rawPoints) {
      const parsedPoints = Number(rawPoints);
      if (isNaN(parsedPoints) || parsedPoints < 0 || parsedPoints > 1000) {
        rowErrors.push({
          row: rowNumber,
          field: 'points',
          message: `Story points must be a valid number between 0 and 1000`,
          rawValue: rawPoints,
        });
      } else {
        points = Math.round(parsedPoints * 100) / 100;
      }
    }

    // 10. Numeric Fields: Remaining & Completed Work
    const rawRemaining = getVal('remainingWork');
    let remainingWork: number | null = null;
    if (rawRemaining) {
      const parsed = Number(rawRemaining);
      if (isNaN(parsed) || parsed < 0) {
        rowErrors.push({
          row: rowNumber,
          field: 'remainingWork',
          message: `Remaining work must be a non-negative number`,
          rawValue: rawRemaining,
        });
      } else {
        remainingWork = parsed;
      }
    }

    const rawCompleted = getVal('completedWork');
    let completedWork: number | null = null;
    if (rawCompleted) {
      const parsed = Number(rawCompleted);
      if (isNaN(parsed) || parsed < 0) {
        rowErrors.push({
          row: rowNumber,
          field: 'completedWork',
          message: `Completed work must be a non-negative number`,
          rawValue: rawCompleted,
        });
      } else {
        completedWork = parsed;
      }
    }

    // 11. Priority
    const rawPriority = getVal('priority').toUpperCase();
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM';
    if (rawPriority) {
      if (VALID_PRIORITIES.includes(rawPriority as any)) {
        priority = rawPriority as any;
      } else {
        rowErrors.push({
          row: rowNumber,
          field: 'priority',
          message: `Priority '${rawPriority}' is invalid. Allowed: ${VALID_PRIORITIES.join(', ')}`,
          rawValue: rawPriority,
        });
      }
    }

    // 12. Severity
    const rawSeverity = getVal('severity').toUpperCase();
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null = null;
    if (rawSeverity) {
      if (VALID_SEVERITIES.includes(rawSeverity as any)) {
        severity = rawSeverity as any;
      } else {
        rowErrors.push({
          row: rowNumber,
          field: 'severity',
          message: `Severity '${rawSeverity}' is invalid. Allowed: ${VALID_SEVERITIES.join(', ')}`,
          rawValue: rawSeverity,
        });
      }
    }

    // 13. Dates
    const rawStartDate = getVal('startDate');
    let startDate: string | null = null;
    if (rawStartDate) {
      const d = new Date(rawStartDate);
      if (isNaN(d.getTime())) {
        rowErrors.push({
          row: rowNumber,
          field: 'startDate',
          message: `Invalid start date '${rawStartDate}'`,
          rawValue: rawStartDate,
        });
      } else {
        startDate = d.toISOString();
      }
    }

    const rawTargetDate = getVal('targetDate');
    let targetDate: string | null = null;
    if (rawTargetDate) {
      const d = new Date(rawTargetDate);
      if (isNaN(d.getTime())) {
        rowErrors.push({
          row: rowNumber,
          field: 'targetDate',
          message: `Invalid target date '${rawTargetDate}'`,
          rawValue: rawTargetDate,
        });
      } else {
        targetDate = d.toISOString();
      }
    }

    if (startDate && targetDate && new Date(targetDate) < new Date(startDate)) {
      rowErrors.push({
        row: rowNumber,
        field: 'targetDate',
        message: 'Target date must be on or after start date',
        rawValue: rawTargetDate,
      });
    }

    // 14. Tags
    const rawTags = getVal('tags');
    const tags: string[] = [];
    if (rawTags) {
      const splitTags = rawTags.split(/[,;]/).map((t) => t.trim()).filter((t) => t.length > 0);
      for (const tag of splitTags) {
        if (tag.length > 50) {
          rowErrors.push({
            row: rowNumber,
            field: 'tags',
            message: `Tag '${tag}' exceeds maximum length of 50 characters`,
            rawValue: tag,
          });
        } else {
          tags.push(tag);
        }
      }
    }

    // Record earlier row for subsequent parent resolution
    if (rawTitle) {
      earlierRowMap.set(rawTitle.toLowerCase(), { rowNumber, type, title: rawTitle });
      earlierRowMap.set(`row ${rowNumber}`, { rowNumber, type, title: rawTitle });
      earlierRowMap.set(`#${rowNumber}`, { rowNumber, type, title: rawTitle });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      validRows.push({
        rowNumber,
        title: rawTitle,
        type,
        state,
        description: rawDescription,
        assignedTo,
        areaId,
        iterationId,
        parentId,
        parentRowNumber,
        priority,
        severity,
        points,
        remainingWork,
        completedWork,
        startDate,
        targetDate,
        tags,
      });
    }
  }

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: rows.length - validRows.length,
    validRows,
    errors,
    canImport: validRows.length > 0,
    headers: Object.keys(rows[0] || {}),
    suggestedMapping: mapping,
  };
}

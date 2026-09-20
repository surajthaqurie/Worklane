import { z } from 'zod';
import { queryFieldSchema, queryOperatorSchema } from './queries.dto.js';

type QueryField = z.infer<typeof queryFieldSchema>;
type QueryOperator = z.infer<typeof queryOperatorSchema>;

const ENUM_VALUES: Record<string, ReadonlyArray<string>> = {
  type: ['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG'],
  priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  stateCategory: ['PROPOSED', 'IN_PROGRESS', 'RESOLVED', 'COMPLETED'],
};

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'completedAt', 'startDate', 'targetDate']);

export const QUERY_FIELD_OPERATORS: Record<QueryField, ReadonlyArray<QueryOperator>> = {
  key: ['equals', 'notEquals', 'contains', 'notContains', 'in', 'notIn', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'],
  type: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  title: ['equals', 'notEquals', 'contains', 'notContains'],
  description: ['equals', 'notEquals', 'contains', 'notContains'],
  state: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  priority: ['equals', 'notEquals', 'in', 'notIn', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'isEmpty', 'isNotEmpty'],
  points: ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'isEmpty', 'isNotEmpty'],
  severity: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  remainingWork: ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'isEmpty', 'isNotEmpty'],
  completedWork: ['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'isEmpty', 'isNotEmpty'],
  assignedTo: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  iterationId: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  areaId: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  parentId: ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  createdBy: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  createdAt: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty', 'equals', 'notEquals'],
  updatedAt: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty', 'equals', 'notEquals'],
  completedAt: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty', 'equals', 'notEquals'],
  startDate: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty', 'equals', 'notEquals'],
  targetDate: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty', 'equals', 'notEquals'],
  stateCategory: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  tags: ['equals', 'notEquals', 'contains', 'notContains', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
};

function isValidDate(value: string): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

function validateValue(field: string, value: string, errors: string[]) {
  const trimmed = value.trim();

  if (DATE_FIELDS.has(field)) {
    if (!isValidDate(trimmed)) {
      errors.push(`value "${trimmed}" for field "${field}" must be a valid date`);
    }
    return;
  }

  const enumValues = ENUM_VALUES[field];
  if (enumValues && trimmed && !enumValues.includes(trimmed)) {
    errors.push(
      `value "${trimmed}" for field "${field}" must be one of: ${enumValues.join(', ')}`,
    );
  }
}

function validateClauseNode(clause: any, path: string, errors: string[], depth = 0): void {
  if (depth > 5) {
    errors.push(`${path}: query AST depth exceeds maximum allowed limit (5)`);
    return;
  }

  if (!clause || typeof clause !== 'object') {
    errors.push(`${path}: clause must be an object`);
    return;
  }

  const nestedList = Array.isArray(clause.clauses)
    ? clause.clauses
    : Array.isArray(clause.filters)
      ? clause.filters
      : null;

  if (nestedList && nestedList.length > 0) {
    for (const [idx, child] of nestedList.entries()) {
      validateClauseNode(child, `${path}.clauses[${idx}]`, errors, depth + 1);
    }
    return;
  }

  const field = clause.field as QueryField;
  if (!queryFieldSchema.safeParse(field).success) {
    errors.push(`${path}: unknown field "${String(field)}"`);
    return;
  }

  const operator = clause.operator as QueryOperator;
  if (!queryOperatorSchema.safeParse(operator).success) {
    errors.push(`${path}: unknown operator "${String(operator)}"`);
    return;
  }

  const allowed = QUERY_FIELD_OPERATORS[field] ?? [];
  if (!allowed.includes(operator)) {
    errors.push(
      `${path}: operator "${operator}" is not supported for field "${field}"`,
    );
    return;
  }

  const rawValue: string = String(clause.value ?? '').trim();
  const valueLess = ['isEmpty', 'isNotEmpty'].includes(operator);

  if (valueLess) return;

  if (rawValue === '') return;

  switch (operator) {
    case 'between': {
      const parts = rawValue.split(',');
      if (parts.length < 2) {
        errors.push(
          `${path}: "between" on "${field}" requires two comma-separated values`,
        );
        break;
      }
      const [start, end] = parts.map((p) => p.trim());
      if (DATE_FIELDS.has(field) && !isValidDate(start) && !isValidDate(end)) {
        errors.push(
          `${path}: "between" on "${field}" requires at least one valid date`,
        );
      }
      break;
    }
    case 'in':
    case 'notIn':
      for (const part of rawValue.split(',')) {
        validateValue(field, part, errors);
      }
      break;
    default:
      validateValue(field, rawValue, errors);
  }
}

export function validateQueryDefinition(definition: any): void {
  const filters: Array<any> = Array.isArray(definition?.filters)
    ? definition.filters
    : [];
  const errors: string[] = [];

  for (const [index, clause] of filters.entries()) {
    validateClauseNode(clause, `filters[${index}]`, errors, 0);
  }

  if (errors.length > 0) {
    throw errors;
  }
}
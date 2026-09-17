import { z } from 'zod';
import { queryFieldSchema, queryOperatorSchema } from './queries.dto.js';

type QueryField = z.infer<typeof queryFieldSchema>;
type QueryOperator = z.infer<typeof queryOperatorSchema>;

const ENUM_VALUES: Record<string, ReadonlyArray<string>> = {
  type: ['EPIC', 'FEATURE', 'STORY', 'TASK', 'BUG'],
  priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
};

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'completedAt']);

export const QUERY_FIELD_OPERATORS: Record<QueryField, ReadonlyArray<QueryOperator>> = {
  key: ['equals', 'notEquals', 'contains', 'notContains', 'in', 'notIn'],
  type: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  title: ['equals', 'notEquals', 'contains', 'notContains'],
  description: ['equals', 'notEquals', 'contains', 'notContains'],
  state: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  priority: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  assignedTo: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  iterationId: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  areaId: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  parentId: ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'],
  createdBy: ['equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  createdAt: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty'],
  updatedAt: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty'],
  completedAt: ['after', 'before', 'between', 'isEmpty', 'isNotEmpty'],
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

export function validateQueryDefinition(definition: any): void {
  const filters: Array<any> = Array.isArray(definition?.filters)
    ? definition.filters
    : [];
  const errors: string[] = [];

  for (const [index, clause] of filters.entries()) {
    if (!clause || typeof clause !== 'object') {
      errors.push(`filters[${index}]: clause must be an object`);
      continue;
    }

    const field = clause.field as QueryField;
    if (!queryFieldSchema.safeParse(field).success) {
      errors.push(`filters[${index}]: unknown field "${String(field)}"`);
      continue;
    }

    const operator = clause.operator as QueryOperator;
    if (!queryOperatorSchema.safeParse(operator).success) {
      errors.push(`filters[${index}]: unknown operator "${String(operator)}"`);
      continue;
    }

    const allowed = QUERY_FIELD_OPERATORS[field] ?? [];
    if (!allowed.includes(operator)) {
      errors.push(
        `filters[${index}]: operator "${operator}" is not supported for field "${field}"`,
      );
      continue;
    }

    const rawValue: string = String(clause.value ?? '').trim();
    const valueLess = ['isEmpty', 'isNotEmpty'].includes(operator);

    if (valueLess) continue;

    if (rawValue === '') continue;

    switch (operator) {
      case 'between': {
        const parts = rawValue.split(',');
        if (parts.length < 2) {
          errors.push(
            `filters[${index}]: "between" on "${field}" requires two comma-separated dates`,
          );
          break;
        }
        const [start, end] = parts.map((p) => p.trim());
        if (DATE_FIELDS.has(field) && !isValidDate(start) && !isValidDate(end)) {
          errors.push(
            `filters[${index}]: "between" on "${field}" requires at least one valid date`,
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

  if (errors.length > 0) {
    throw errors;
  }
}
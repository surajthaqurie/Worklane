import { describe, it, expect } from 'vitest';
import { validateQueryDefinition } from './query-validation.js';

function rejectMessages(definition: any): string[] {
  try {
    validateQueryDefinition(definition);
    expect.unreachable('expected validation to throw');
  } catch (errors) {
    expect(Array.isArray(errors)).toBe(true);
    return errors as string[];
  }
}

describe('validateQueryDefinition', () => {
  it('accepts an empty definition', () => {
    expect(() => validateQueryDefinition({ filters: [] })).not.toThrow();
  });

  it('accepts a structurally valid multi-clause definition with AND/OR', () => {
    const definition = {
      filters: [
        { logicalOperator: 'AND', field: 'state', operator: 'equals', value: 'Active' },
        { logicalOperator: 'AND', field: 'assignedTo', operator: 'equals', value: '@me' },
        { logicalOperator: 'OR', field: 'priority', operator: 'equals', value: 'HIGH' },
      ],
      sortBy: 'key',
      sortOrder: 'asc',
    };
    expect(() => validateQueryDefinition(definition)).not.toThrow();
  });

  it('accepts tags and area clauses', () => {
    const definition = {
      filters: [
        { logicalOperator: 'AND', field: 'areaId', operator: 'equals', value: 'a1' },
        { logicalOperator: 'AND', field: 'tags', operator: 'in', value: 'bug,ui' },
        { logicalOperator: 'OR', field: 'tags', operator: 'isEmpty', value: '' },
      ],
    };
    expect(() => validateQueryDefinition(definition)).not.toThrow();
  });

  it('rejects an operator that is unsupported for the field', () => {
    const definition = {
      filters: [{ logicalOperator: 'AND', field: 'createdAt', operator: 'contains', value: 'foo' }],
    };
    const messages = rejectMessages(definition);
    expect(messages.join('\n')).toMatch('operator "contains" is not supported for field "createdAt"');
  });

  it('rejects an unknown field', () => {
    const definition = {
      filters: [{ logicalOperator: 'AND', field: 'dropTable', operator: 'equals', value: 'x' }],
    };
    const messages = rejectMessages(definition);
    expect(messages.join('\n')).toMatch('unknown field');
  });

  it('rejects an invalid type enum value', () => {
    const definition = {
      filters: [{ logicalOperator: 'AND', field: 'type', operator: 'equals', value: 'NOT_A_TYPE' }],
    };
    const messages = rejectMessages(definition);
    expect(messages.join('\n')).toMatch('must be one of: EPIC, FEATURE, STORY, TASK, BUG');
  });

  it('rejects an invalid priority enum value', () => {
    const definition = {
      filters: [{ logicalOperator: 'AND', field: 'priority', operator: 'in', value: 'HIGH,WHATEVER' }],
    };
    const messages = rejectMessages(definition);
    expect(messages.join('\n')).toMatch('must be one of: LOW, MEDIUM, HIGH, URGENT');
  });

  it('rejects a malformed date value', () => {
    const definition = {
      filters: [{ logicalOperator: 'AND', field: 'createdAt', operator: 'before', value: 'not-a-date' }],
    };
    const messages = rejectMessages(definition);
    expect(messages.join('\n')).toMatch('must be a valid date');
  });

  it('rejects a between clause without a comma separator', () => {
    const definition = {
      filters: [{ logicalOperator: 'AND', field: 'updatedAt', operator: 'between', value: '2026-01-01' }],
    };
    const messages = rejectMessages(definition);
    expect(messages.join('\n')).toMatch('"between" on "updatedAt" requires two comma-separated values');
  });

  it('allows a between clause with at least one valid bound', () => {
    const definition = {
      filters: [{ logicalOperator: 'AND', field: 'createdAt', operator: 'between', value: '2026-01-01,' }],
    };
    expect(() => validateQueryDefinition(definition)).not.toThrow();
  });

  it('ignores values for value-less operators like isEmpty', () => {
    const definition = {
      filters: [
        { logicalOperator: 'AND', field: 'type', operator: 'isEmpty', value: '' },
        { logicalOperator: 'OR', field: 'assignedTo', operator: 'isNotEmpty', value: '' },
      ],
    };
    expect(() => validateQueryDefinition(definition)).not.toThrow();
  });

  it('allows dates through the enum check untouched', () => {
    const definition = {
      filters: [
        { logicalOperator: 'AND', field: 'createdAt', operator: 'after', value: '2026-01-01T00:00:00Z' },
        { logicalOperator: 'OR', field: 'updatedAt', operator: 'between', value: '2026-01-01,2026-02-01' },
      ],
    };
    expect(() => validateQueryDefinition(definition)).not.toThrow();
  });

  it('collects multiple errors', () => {
    const definition = {
      filters: [
        { logicalOperator: 'AND', field: 'createdAt', operator: 'contains', value: 'x' },
        { logicalOperator: 'AND', field: 'type', operator: 'equals', value: 'NOPE' },
      ],
    };
    const messages = rejectMessages(definition);
    expect(messages.length).toBe(2);
  });

  it('accepts numeric operators on points and priority', () => {
    const definition = {
      filters: [
        { logicalOperator: 'AND', field: 'points', operator: 'greaterThanOrEqual', value: '3' },
        { logicalOperator: 'AND', field: 'priority', operator: 'lessThanOrEqual', value: 'HIGH' },
        { logicalOperator: 'AND', field: 'points', operator: 'between', value: '1,8' },
      ],
    };
    expect(() => validateQueryDefinition(definition)).not.toThrow();
  });

  it('accepts NOT logical operator and nested AST group structures', () => {
    const definition = {
      filters: [
        { logicalOperator: 'AND', field: 'state', operator: 'equals', value: 'IN_PROGRESS' },
        {
          logicalOperator: 'NOT',
          clauses: [
            { logicalOperator: 'AND', field: 'priority', operator: 'equals', value: 'LOW' },
            { logicalOperator: 'OR', field: 'points', operator: 'lessThan', value: '1' },
          ],
        },
      ],
    };
    expect(() => validateQueryDefinition(definition)).not.toThrow();
  });
});
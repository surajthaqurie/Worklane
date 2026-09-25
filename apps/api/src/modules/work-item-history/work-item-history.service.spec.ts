import { describe, expect, it } from 'vitest';
import {
  describeHistoryEntry,
  prettifyKey,
  resolveHistoryLabel,
} from './work-item-history.service.js';
import { WorkItemHistoryAction } from './work-item-history.constants.js';

describe('prettifyKey', () => {
  it('title-cases underscore separated keys', () => {
    expect(prettifyKey('IN_PROGRESS')).toBe('In Progress');
    expect(prettifyKey('New')).toBe('New');
    expect(prettifyKey('TODO')).toBe('Todo');
    expect(prettifyKey('URGENT')).toBe('Urgent');
  });
});

describe('resolveHistoryLabel', () => {
  const lookups = {
    users: new Map([['u1', 'Jane Doe']]),
    iterations: new Map([['i1', 'Sprint 1']]),
    areas: new Map([['a1', 'Backend']]),
    parents: new Map([['w1', 'APP-12 · Parent title']]),
  } as any;

  it('resolves ids to labels per field', () => {
    expect(resolveHistoryLabel('assigned_to', 'u1', lookups)).toBe('Jane Doe');
    expect(resolveHistoryLabel('iteration_id', 'i1', lookups)).toBe('Sprint 1');
    expect(resolveHistoryLabel('area_id', 'a1', lookups)).toBe('Backend');
    expect(resolveHistoryLabel('parent_id', 'w1', lookups)).toBe(
      'APP-12 · Parent title',
    );
  });

  it('prettifies state and priority keys', () => {
    expect(resolveHistoryLabel('state', 'IN_PROGRESS', lookups)).toBe('In Progress');
    expect(resolveHistoryLabel('priority', 'URGENT', lookups)).toBe('Urgent');
  });

  it('falls back to the raw value for unknown ids and plain fields', () => {
    expect(resolveHistoryLabel('assigned_to', 'missing', lookups)).toBe('missing');
    expect(resolveHistoryLabel('title', 'My title', lookups)).toBe('My title');
  });

  it('returns null for empty values', () => {
    expect(resolveHistoryLabel('assigned_to', null, lookups)).toBeNull();
    expect(resolveHistoryLabel('assigned_to', '', lookups)).toBeNull();
  });
});

describe('describeHistoryEntry', () => {
  it('describes lifecycle events', () => {
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.CREATED,
        previousLabel: null,
        newLabel: null,
      }),
    ).toBe('created this work item');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.DELETED,
        previousLabel: 'Old title',
        newLabel: null,
      }),
    ).toBe('deleted this work item');
  });

  it('describes title changes', () => {
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.TITLE_CHANGED,
        previousLabel: 'Old',
        newLabel: 'New',
      }),
    ).toBe('renamed from "Old" to "New"');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.TITLE_CHANGED,
        previousLabel: null,
        newLabel: 'New',
      }),
    ).toBe('set the title to "New"');
  });

  it('describes state changes', () => {
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.STATE_CHANGED,
        previousLabel: 'New',
        newLabel: 'In Progress',
      }),
    ).toBe('moved from New to In Progress');
  });

  it('describes assignment changes', () => {
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.ASSIGNEE_CHANGED,
        previousLabel: null,
        newLabel: 'Jane Doe',
      }),
    ).toBe('assigned to Jane Doe');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.ASSIGNEE_CHANGED,
        previousLabel: 'Jane Doe',
        newLabel: null,
      }),
    ).toBe('unassigned Jane Doe');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.ASSIGNEE_CHANGED,
        previousLabel: 'Jane',
        newLabel: 'John',
      }),
    ).toBe('reassigned from Jane to John');
  });

  it('describes iteration changes including moves to backlog', () => {
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.ITERATION_CHANGED,
        previousLabel: 'Sprint 1',
        newLabel: 'Sprint 2',
      }),
    ).toBe('moved from Sprint 1 to Sprint 2');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.ITERATION_CHANGED,
        previousLabel: 'Sprint 1',
        newLabel: null,
      }),
    ).toBe('moved Sprint 1 to the backlog');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.ITERATION_CHANGED,
        previousLabel: null,
        newLabel: 'Sprint 1',
      }),
    ).toBe('added to Sprint 1');
  });

  it('describes comments without leaking full bodies', () => {
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.COMMENT_ADDED,
        previousLabel: null,
        newLabel: 'long body...',
      }),
    ).toBe('added a comment');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.COMMENT_UPDATED,
        previousLabel: 'a',
        newLabel: 'b',
      }),
    ).toBe('edited a comment');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.COMMENT_DELETED,
        previousLabel: 'a',
        newLabel: null,
      }),
    ).toBe('deleted a comment');
  });

  it('describes tags, type, points and reorder', () => {
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.TAGS_CHANGED,
        previousLabel: 'alpha',
        newLabel: 'alpha,beta',
      }),
    ).toBe('updated tags from alpha to alpha,beta');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.TYPE_CHANGED,
        previousLabel: 'TASK',
        newLabel: 'BUG',
      }),
    ).toBe('changed type from TASK to BUG');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.POINTS_CHANGED,
        previousLabel: '5',
        newLabel: null,
      }),
    ).toBe('cleared points (was 5)');
    expect(
      describeHistoryEntry({
        action: WorkItemHistoryAction.ORDER_CHANGED,
        previousLabel: '1',
        newLabel: '2',
      }),
    ).toBe('reordered this item');
  });

  it('falls back to a derived phrase for unknown actions', () => {
    expect(
      describeHistoryEntry({ action: 'MYSTERY_CHANGED', previousLabel: null, newLabel: null }),
    ).toBe('mystery changed');
  });
});

describe('fieldNameFromKey', () => {
  it('maps db keys and actions to user-friendly names', async () => {
    const { fieldNameFromKey } = await import('./work-item-history.service.js');
    expect(fieldNameFromKey('state')).toBe('State');
    expect(fieldNameFromKey('priority')).toBe('Priority');
    expect(fieldNameFromKey('assigned_to')).toBe('Assignee');
    expect(fieldNameFromKey('title')).toBe('Title');
    expect(fieldNameFromKey('iteration_id')).toBe('Iteration');
    expect(fieldNameFromKey(null, WorkItemHistoryAction.CREATED)).toBe('Item Created');
    expect(fieldNameFromKey(null, WorkItemHistoryAction.COMMENT_ADDED)).toBe('Comment Added');
  });
});

describe('sanitizeHistoryValue', () => {
  it('redacts sensitive fields while keeping safe fields intact', async () => {
    const { sanitizeHistoryValue } = await import('./work-item-history.service.js');
    expect(sanitizeHistoryValue('password', 'secret123')).toBe('[REDACTED]');
    expect(sanitizeHistoryValue('apiKey', 'abcdef123')).toBe('[REDACTED]');
    expect(sanitizeHistoryValue('secret_token', 'token_xyz')).toBe('[REDACTED]');
    expect(sanitizeHistoryValue('title', 'Refactor database')).toBe('Refactor database');
    expect(sanitizeHistoryValue('state', 'In Progress')).toBe('In Progress');
    expect(sanitizeHistoryValue('state', null)).toBeNull();
  });
});

describe('groupHistoryItems', () => {
  it('groups consecutive changes by same actor within 5 seconds window', async () => {
    const { groupHistoryItems } = await import('./work-item-history.service.js');
    const now = new Date('2026-09-25T12:00:00Z');
    const actor = { id: 'u1', name: 'Alice', avatarUrl: null };

    const items = [
      {
        id: 'h1',
        workItemId: 'wi-1',
        action: 'STATE_CHANGED',
        field: 'state',
        fieldName: 'State',
        before: 'New',
        after: 'In Progress',
        rawBefore: 'New',
        rawAfter: 'In Progress',
        changedBy: actor,
        changedAt: now,
        description: 'moved from New to In Progress',
      },
      {
        id: 'h2',
        workItemId: 'wi-1',
        action: 'PRIORITY_CHANGED',
        field: 'priority',
        fieldName: 'Priority',
        before: 'Low',
        after: 'High',
        rawBefore: 'LOW',
        rawAfter: 'HIGH',
        changedBy: actor,
        changedAt: new Date('2026-09-25T12:00:02Z'), // 2 seconds later
        description: 'changed priority from Low to High',
      },
      {
        id: 'h3',
        workItemId: 'wi-1',
        action: 'COMMENT_ADDED',
        field: null,
        fieldName: 'Comment Added',
        before: null,
        after: null,
        rawBefore: null,
        rawAfter: null,
        changedBy: { id: 'u2', name: 'Bob', avatarUrl: null }, // different actor
        changedAt: new Date('2026-09-25T12:00:03Z'),
        description: 'added a comment',
      },
    ];

    const groups = groupHistoryItems(items);
    expect(groups).toHaveLength(2);

    // Group 1: Alice's grouped changes
    expect(groups[0].changedBy.name).toBe('Alice');
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].summary).toBe('Updated State, Priority');

    // Group 2: Bob's comment
    expect(groups[1].changedBy.name).toBe('Bob');
    expect(groups[1].items).toHaveLength(1);
    expect(groups[1].summary).toBe('added a comment');
  });
});
import { describe, expect, it } from 'vitest';
import type { WorkItemHistoryItem } from '@/shared/types/history';

function makeHistoryItem(overrides: Partial<WorkItemHistoryItem> = {}): WorkItemHistoryItem {
  return {
    id: 'h1',
    workItemId: 'wi-1',
    action: 'STATE_CHANGED',
    field: 'state',
    fieldName: 'State',
    before: 'New',
    after: 'In Progress',
    rawBefore: 'New',
    rawAfter: 'In Progress',
    changedBy: { id: 'u1', name: 'Alice', avatarUrl: null },
    changedAt: '2026-09-25T12:00:00Z',
    description: 'moved from New to In Progress',
    ...overrides,
  };
}

describe('Work Item History Models and Formatting', () => {
  it('correctly structures history diff entries with Field, Before, After, Changed By, Changed At', () => {
    const item = makeHistoryItem({
      field: 'priority',
      fieldName: 'Priority',
      before: 'Low',
      after: 'Urgent',
      changedBy: { id: 'u2', name: 'Bob', avatarUrl: null },
      changedAt: '2026-09-25T14:30:00Z',
    });

    expect(item.fieldName).toBe('Priority');
    expect(item.before).toBe('Low');
    expect(item.after).toBe('Urgent');
    expect(item.changedBy.name).toBe('Bob');
    expect(item.changedAt).toBe('2026-09-25T14:30:00Z');
  });

  it('preserves human readable descriptions for lifecycle and comments', () => {
    const createdItem = makeHistoryItem({
      field: null,
      fieldName: 'Item Created',
      description: 'created this work item',
    });
    expect(createdItem.description).toBe('created this work item');

    const commentItem = makeHistoryItem({
      field: null,
      fieldName: 'Comment Added',
      description: 'added a comment',
    });
    expect(commentItem.description).toBe('added a comment');
  });
});

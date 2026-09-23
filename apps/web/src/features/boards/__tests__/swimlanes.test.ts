import { describe, expect, it } from 'vitest';
import { getSwimlaneMode, groupIntoSwimlanes, SWIMLANE_OPTIONS } from '../swimlanes';
import type { ProjectMember } from '@/shared/types/projects';
import type { WorkItem } from '@/shared/types/work-items';

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'item-1',
    key: 'PRJ-1',
    projectId: 'proj-1',
    type: 'STORY',
    title: 'Story',
    description: null,
    state: 'TODO',
    priority: 'MEDIUM',
    points: null,
    assignedTo: null,
    createdBy: 'u-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    completedAt: null,
    parentId: null,
    areaId: 'area-1',
    ...overrides,
  };
}

const members: ProjectMember[] = [
  { id: 'm1', projectId: 'proj-1', userId: 'u-1', userName: 'Ada', role: 'ADMIN' },
  { id: 'm2', projectId: 'proj-1', userId: 'u-2', userName: 'Lin', role: 'MEMBER' },
];

describe('SWIMLANE_OPTIONS', () => {
  it('registers every swimlane mode in a stable order', () => {
    expect(SWIMLANE_OPTIONS.map((mode) => mode.type)).toEqual(['none', 'assignee', 'priority', 'epic']);
  });

  it('falls back to the flat board for unknown swimlane modes', () => {
    expect(getSwimlaneMode('bogus' as never).type).toBe('none');
    expect(getSwimlaneMode(undefined).type).toBe('none');
  });
});

describe('groupIntoSwimlanes', () => {
  it('groups everything into a single flat lane for "none"', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
    const lanes = groupIntoSwimlanes('none', items, { members });
    expect(lanes).toHaveLength(1);
    expect(lanes[0].group.id).toBe('all');
    expect(lanes[0].items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('creates one lane per priority in Urgent -> Low order, merging duplicates', () => {
    const items = [
      makeItem({ id: 'high', priority: 'HIGH' }),
      makeItem({ id: 'med1', priority: 'MEDIUM' }),
      makeItem({ id: 'urgent', priority: 'URGENT' }),
      makeItem({ id: 'low', priority: 'LOW' }),
      makeItem({ id: 'med2', priority: 'MEDIUM' }),
    ];
    const lanes = groupIntoSwimlanes('priority', items, { members });
    expect(lanes.map((lane) => lane.group.id)).toEqual([
      'priority:URGENT',
      'priority:HIGH',
      'priority:MEDIUM',
      'priority:LOW',
    ]);
    expect(lanes[0].group.title).toBe('Urgent');
    expect(lanes[2].items.map((item) => item.id)).toEqual(['med1', 'med2']);
  });

  it('sorts assignee lanes by member order with Unassigned last', () => {
    const items = [
      makeItem({ id: 'lin', assignedTo: 'u-2' }),
      makeItem({ id: 'un', assignedTo: null }),
      makeItem({ id: 'ada', assignedTo: 'u-1' }),
    ];
    const lanes = groupIntoSwimlanes('assignee', items, { members });
    expect(lanes.map((lane) => lane.group.id)).toEqual([
      'assignee:u-1',
      'assignee:u-2',
      'unassigned',
    ]);
    expect(lanes[0].group.title).toBe('Ada');
    expect(lanes[1].group.title).toBe('Lin');
    expect(lanes[2].group.subtitle).toBe('No assignee set');
  });

  it('labels unknown assignees generically', () => {
    const lanes = groupIntoSwimlanes('assignee', [makeItem({ id: 'x', assignedTo: 'u-99' })], { members });
    expect(lanes[0].group.title).toBe('Assignee');
  });

  it('orders unknown lanes before empty preferred lanes by first appearance', () => {
    const membersWith = members;
    const items = [
      makeItem({ id: 'un', assignedTo: null }),
      makeItem({ id: 'lin', assignedTo: 'u-2' }),
    ];
    const lanes = groupIntoSwimlanes('assignee', items, { members: membersWith });
    // u-1 has no items, so it must be dropped; remaining order is member then unassigned.
    expect(lanes.map((lane) => lane.group.id)).toEqual(['assignee:u-2', 'unassigned']);
  });

  it('groups epics by resolved parent and puts parentless items in No Epic', () => {
    const resolveParent = (parentId: string) =>
      parentId === 'epic-1' ? { key: 'PRJ-7', title: 'Platform' } : undefined;
    const items = [
      makeItem({ id: 'child', parentId: 'epic-1' }),
      makeItem({ id: 'lonely' }),
      makeItem({ id: 'other-child', parentId: 'epic-2' }),
    ];
    const lanes = groupIntoSwimlanes(
      'epic',
      items,
      { members, resolveParent }
    );
    expect(lanes.map((lane) => lane.group.id)).toEqual(['epic:epic-1', 'no-epic', 'epic:epic-2']);
    expect(lanes[0].group.title).toBe('[PRJ-7] Platform');
    expect(lanes[1].group.id).toBe('no-epic');
    expect(lanes[1].group.subtitle).toBe('Items without a parent epic');
    expect(lanes[1].items.map((item) => item.id)).toEqual(['lonely']);
    expect(lanes[2].group.id).toBe('epic:epic-2');
    expect(lanes[2].group.title).toBe('Epic');
  });
});
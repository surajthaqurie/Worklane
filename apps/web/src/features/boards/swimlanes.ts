'use client';

import { WorkItem, WorkItemPriority } from '@/shared/types/work-items';
import { SwimlaneType } from '@/shared/types/boards';
import { ProjectMember } from '@/shared/types/projects';

/**
 * Swimlane grouping registry.
 *
 * Each board can be grouped by one of the registered modes (`none`, `assignee`,
 * `priority`, `epic`). The grouper here is a plain function per mode, so future
 * custom groupings (e.g. by area, iteration, or custom field) only need to
 * register a new mode + `group` implementation and select it from the same
 * board-config control — no changes to Board/BoardColumn are required.
 */

export interface SwimlaneGroup {
  id: string;
  title: string;
  subtitle?: string;
}

export interface SwimlaneContext {
  members: ProjectMember[];
  /** Resolves a parent (epic) work item's key/title when available. */
  resolveParent?: (parentId: string) => { key: string; title: string } | undefined;
}

export interface SwimlaneMode {
  type: SwimlaneType;
  label: string;
  description: string;
  /** Which lane an item belongs to. */
  group: (item: WorkItem, ctx: SwimlaneContext) => SwimlaneGroup;
  /**
   * Preferred lane order, when the mode has a natural one (priorities, members).
   * Group ids not listed fall back to first-appearance order. A function form
   * lets member-relative modes resolve ordering from the swimlane context.
   */
  preferredOrder?: string[] | ((ctx: SwimlaneContext) => string[]);
}

const NO_EPIC_GROUP: SwimlaneGroup = {
  id: 'no-epic',
  title: 'No Epic',
  subtitle: 'Items without a parent epic',
};

const UNASSIGNED_GROUP: SwimlaneGroup = {
  id: 'unassigned',
  title: 'Unassigned',
  subtitle: 'No assignee set',
};

function memberName(ctx: SwimlaneContext, userId: string): string {
  const member = ctx.members.find((m) => m.userId === userId);
  if (member?.userName) return member.userName;
  return 'Assignee';
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const PRIORITY_LABELS: Record<WorkItemPriority, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const SWIMLANE_MODES: Record<SwimlaneType, SwimlaneMode> = {
  none: {
    type: 'none',
    label: 'No Swimlanes',
    description: 'Single flat board — every item in one lane.',
    group: () => ({ id: 'all', title: '' }),
  },
  assignee: {
    type: 'assignee',
    label: 'Assignee',
    description: 'One lane per assignee, plus an Unassigned lane.',
    group: (item, ctx) => {
      if (!item.assignedTo) return UNASSIGNED_GROUP;
      return {
        id: `assignee:${item.assignedTo}`,
        title: memberName(ctx, item.assignedTo),
        subtitle: 'Assigned work',
      };
    },
    preferredOrder: (ctx: SwimlaneContext) => {
      const memberOrder = ctx.members.map((m) => `assignee:${m.userId}`);
      return [...memberOrder, UNASSIGNED_GROUP.id];
    },
  },
  priority: {
    type: 'priority',
    label: 'Priority',
    description: 'One lane per priority, from Urgent down to Low.',
    group: (item) => ({
      id: `priority:${item.priority}`,
      title: PRIORITY_LABELS[item.priority] ?? capitalize(item.priority),
      subtitle: `${PRIORITY_LABELS[item.priority] ?? item.priority} priority`,
    }),
    preferredOrder: ['priority:URGENT', 'priority:HIGH', 'priority:MEDIUM', 'priority:LOW'],
  },
  epic: {
    type: 'epic',
    label: 'Epic',
    description: 'One lane per parent epic, plus a No Epic lane.',
    group: (item, ctx) => {
      if (!item.parentId) return NO_EPIC_GROUP;
      const parent = ctx.resolveParent ? ctx.resolveParent(item.parentId) : undefined;
      return {
        id: `epic:${item.parentId}`,
        title: parent ? `[${parent.key}] ${parent.title}` : 'Epic',
        subtitle: 'Parent epic',
      };
    },
  },
};

export function getSwimlaneMode(type?: SwimlaneType): SwimlaneMode {
  return SWIMLANE_MODES[type ?? 'none'] ?? SWIMLANE_MODES.none;
}

export const SWIMLANE_OPTIONS: SwimlaneMode[] = [
  SWIMLANE_MODES.none,
  SWIMLANE_MODES.assignee,
  SWIMLANE_MODES.priority,
  SWIMLANE_MODES.epic,
];

/**
 * Groups the visible items into ordered lanes. `preferredOrder` (when defined)
 * sorts lanes first; otherwise lanes keep their first-appearance order.
 */
export function groupIntoSwimlanes(
  mode: SwimlaneType,
  items: WorkItem[],
  ctx: SwimlaneContext,
): { group: SwimlaneGroup; items: WorkItem[] }[] {
  const byId = new Map<string, { group: SwimlaneGroup; items: WorkItem[] }>();
  const seenIds = new Set<string>();

  for (const item of items) {
    const group = mode === 'none' ? { id: 'all', title: '' } : SWIMLANE_MODES[mode]?.group(item, ctx) ?? { id: 'all', title: '' };
    let entry = byId.get(group.id);
    if (!entry) {
      entry = { group, items: [] };
      byId.set(group.id, entry);
      seenIds.add(group.id);
    }
    entry.items.push(item);
  }

  const order = SWIMLANE_MODES[mode]?.preferredOrder;
  const ordered = typeof order === 'function' ? order(ctx) : order;
  let orderedIds: string[];
  if (ordered && ordered.length > 0) {
    const rank = new Map(ordered.map((id, idx) => [id, idx]));
    orderedIds = [...seenIds].sort((a, b) => {
      const ra = rank.get(a);
      const rb = rank.get(b);
      if (ra != null && rb != null) return ra - rb;
      if (ra != null) return -1;
      if (rb != null) return 1;
      return a.localeCompare(b);
    });
  } else {
    orderedIds = [...seenIds];
  }

  return orderedIds
    .map((id) => byId.get(id)!)
    .map((entry) => ({ group: entry.group, items: entry.items }));
}
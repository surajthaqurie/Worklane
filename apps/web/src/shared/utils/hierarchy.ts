import { WorkItemType, WorkItemPriority } from '../types/work-items';

export const PARENT_TYPES: Record<WorkItemType, WorkItemType[]> = {
  EPIC: [],
  FEATURE: ['EPIC'],
  STORY: ['FEATURE'],
  TASK: ['STORY', 'BUG'],
  BUG: ['STORY'],
};

export const DEFAULT_CHILD_TYPE: Record<WorkItemType, WorkItemType | null> = {
  EPIC: 'FEATURE',
  FEATURE: 'STORY',
  STORY: 'TASK',
  TASK: null,
  BUG: null,
};

export const TYPE_LABELS: Record<WorkItemType, string> = {
  EPIC: 'Epic',
  FEATURE: 'Feature',
  STORY: 'User Story',
  TASK: 'Task',
  BUG: 'Bug',
};

export const TYPE_COLORS: Record<WorkItemType, string> = {
  EPIC: 'var(--type-epic, #8b5cf6)',
  FEATURE: 'var(--type-feature, #3b82f6)',
  STORY: 'var(--type-story, #10b981)',
  TASK: 'var(--type-task, #f59e0b)',
  BUG: 'var(--type-bug, #ef4444)',
};

export const TYPE_BG_CLASSES: Record<WorkItemType, string> = {
  EPIC: 'bg-[#9333ea]/10 text-[#9333ea]',
  FEATURE: 'bg-[#ea580c]/10 text-[#ea580c]',
  STORY: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]',
  TASK: 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]',
  BUG: 'bg-[var(--priority-high)]/10 text-[var(--priority-high)]',
};

export const PRIORITY_LABELS: Record<WorkItemPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const PRIORITY_COLORS: Record<WorkItemPriority, string> = {
  LOW: 'text-gray-500 bg-gray-500/10',
  MEDIUM: 'text-blue-500 bg-blue-500/10',
  HIGH: 'text-orange-500 bg-orange-500/10',
  URGENT: 'text-red-500 bg-red-500/10',
};

export function computeRank(prevRank: number | null, nextRank: number | null): number {
  const lo = prevRank ?? 0;
  const hi = nextRank ?? lo + 2000;
  return (lo + hi) / 2;
}

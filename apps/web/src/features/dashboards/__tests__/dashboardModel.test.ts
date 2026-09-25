import { describe, expect, it } from 'vitest';
import type { WidgetLayout } from '@/shared/types/dashboard';

describe('Dashboard Layout Model', () => {
  const sampleLayout: WidgetLayout[] = [
    { id: 'w1', type: 'SPRINT_SUMMARY', position: 0, colSpan: 2, rowSpan: 1, visible: true },
    { id: 'w2', type: 'BURNDOWN', position: 1, colSpan: 1, rowSpan: 1, visible: true },
    { id: 'w3', type: 'MY_WORK_ITEMS', position: 2, colSpan: 2, rowSpan: 1, visible: true },
    { id: 'w4', type: 'BLOCKED_ITEMS', position: 3, colSpan: 1, rowSpan: 1, visible: false },
  ];

  it('filters visible widgets correctly', () => {
    const visible = sampleLayout.filter((w) => w.visible);
    expect(visible).toHaveLength(3);
    expect(visible.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
  });

  it('updates widget sizing (colSpan) cleanly', () => {
    const resized = sampleLayout.map((w) =>
      w.id === 'w2' ? { ...w, colSpan: 2 } : w,
    );
    const target = resized.find((w) => w.id === 'w2');
    expect(target?.colSpan).toBe(2);
    // Others remain unchanged
    expect(resized.find((w) => w.id === 'w1')?.colSpan).toBe(2);
  });

  it('toggles widget visibility', () => {
    const toggled = sampleLayout.map((w) =>
      w.id === 'w4' ? { ...w, visible: !w.visible } : w,
    );
    expect(toggled.find((w) => w.id === 'w4')?.visible).toBe(true);

    const reToggled = toggled.map((w) =>
      w.id === 'w4' ? { ...w, visible: !w.visible } : w,
    );
    expect(reToggled.find((w) => w.id === 'w4')?.visible).toBe(false);
  });

  it('sorts widgets by position', () => {
    const unordered: WidgetLayout[] = [
      { id: 'w3', type: 'MY_WORK_ITEMS', position: 5, colSpan: 1, visible: true },
      { id: 'w1', type: 'SPRINT_SUMMARY', position: 1, colSpan: 2, visible: true },
      { id: 'w2', type: 'BURNDOWN', position: 3, colSpan: 1, visible: true },
    ];

    const sorted = [...unordered].sort((a, b) => a.position - b.position);
    expect(sorted.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  WIDGET_REGISTRY,
  getAllWidgetDefinitions,
  getWidgetDefinition,
} from '../registry';
import type { WidgetType } from '@/shared/types/dashboard';

describe('Widget Registry', () => {
  const expectedWidgetTypes: WidgetType[] = [
    'SPRINT_SUMMARY',
    'BURNDOWN',
    'VELOCITY',
    'MY_WORK_ITEMS',
    'BLOCKED_ITEMS',
    'ACTIVITY',
    'TEAM_PROGRESS',
  ];

  it('contains all required typed widgets', () => {
    for (const type of expectedWidgetTypes) {
      expect(WIDGET_REGISTRY[type]).toBeDefined();
      expect(WIDGET_REGISTRY[type].type).toBe(type);
      expect(WIDGET_REGISTRY[type].name).toBeTruthy();
      expect(WIDGET_REGISTRY[type].description).toBeTruthy();
      expect(WIDGET_REGISTRY[type].icon).toBeDefined();
      expect(WIDGET_REGISTRY[type].component).toBeDefined();
      expect(WIDGET_REGISTRY[type].defaultColSpan).toBeGreaterThanOrEqual(1);
      expect(WIDGET_REGISTRY[type].defaultColSpan).toBeLessThanOrEqual(3);
      expect(WIDGET_REGISTRY[type].minColSpan).toBe(1);
      expect(WIDGET_REGISTRY[type].maxColSpan).toBe(3);
    }
  });

  it('matches human readable titles for standard widgets', () => {
    expect(WIDGET_REGISTRY.SPRINT_SUMMARY.name).toBe('Sprint Summary');
    expect(WIDGET_REGISTRY.BURNDOWN.name).toBe('Burndown');
    expect(WIDGET_REGISTRY.VELOCITY.name).toBe('Velocity');
    expect(WIDGET_REGISTRY.MY_WORK_ITEMS.name).toBe('My Work Items');
    expect(WIDGET_REGISTRY.BLOCKED_ITEMS.name).toBe('Blocked Items');
    expect(WIDGET_REGISTRY.ACTIVITY.name).toBe('Activity');
    expect(WIDGET_REGISTRY.TEAM_PROGRESS.name).toBe('Team Progress');
  });

  it('getAllWidgetDefinitions returns all registered definitions', () => {
    const all = getAllWidgetDefinitions();
    expect(all).toHaveLength(expectedWidgetTypes.length);
  });

  it('getWidgetDefinition returns definition for valid type and undefined otherwise', () => {
    expect(getWidgetDefinition('BURNDOWN')?.name).toBe('Burndown');
    expect(getWidgetDefinition('NON_EXISTENT' as any)).toBeUndefined();
  });
});

'use client';

import React from 'react';
import {
  Clock,
  TrendingDown,
  BarChart3,
  ListTodo,
  AlertTriangle,
  Activity,
  Users,
} from 'lucide-react';
import type { WidgetLayout, WidgetType } from '@/shared/types/dashboard';
import { SprintSummaryWidget } from './components/widgets/SprintSummaryWidget';
import { BurndownWidget } from './components/widgets/BurndownWidget';
import { VelocityWidget } from './components/widgets/VelocityWidget';
import { MyWorkItemsWidget } from './components/widgets/MyWorkItemsWidget';
import { BlockedItemsWidget } from './components/widgets/BlockedItemsWidget';
import { ActivityWidget } from './components/widgets/ActivityWidget';
import { TeamProgressWidget } from './components/widgets/TeamProgressWidget';

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultColSpan: number;
  minColSpan: number;
  maxColSpan: number;
  component: React.ComponentType<{ widget: WidgetLayout }>;
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  SPRINT_SUMMARY: {
    type: 'SPRINT_SUMMARY',
    name: 'Sprint Summary',
    description: 'Active iteration progress, effort, and countdown',
    icon: Clock,
    defaultColSpan: 2,
    minColSpan: 1,
    maxColSpan: 3,
    component: SprintSummaryWidget,
  },
  BURNDOWN: {
    type: 'BURNDOWN',
    name: 'Burndown',
    description: 'Sprint burndown curve vs ideal trend',
    icon: TrendingDown,
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 3,
    component: BurndownWidget,
  },
  VELOCITY: {
    type: 'VELOCITY',
    name: 'Velocity',
    description: 'Committed vs completed points over recent sprints',
    icon: BarChart3,
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 3,
    component: VelocityWidget,
  },
  MY_WORK_ITEMS: {
    type: 'MY_WORK_ITEMS',
    name: 'My Work Items',
    description: 'Tasks and stories currently assigned to you',
    icon: ListTodo,
    defaultColSpan: 2,
    minColSpan: 1,
    maxColSpan: 3,
    component: MyWorkItemsWidget,
  },
  BLOCKED_ITEMS: {
    type: 'BLOCKED_ITEMS',
    name: 'Blocked Items',
    description: 'Work items blocked by dependencies or critical bugs',
    icon: AlertTriangle,
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 3,
    component: BlockedItemsWidget,
  },
  ACTIVITY: {
    type: 'ACTIVITY',
    name: 'Activity',
    description: 'Audit feed of recent work item updates',
    icon: Activity,
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 3,
    component: ActivityWidget,
  },
  TEAM_PROGRESS: {
    type: 'TEAM_PROGRESS',
    name: 'Team Progress',
    description: 'Throughput and task completion across team members',
    icon: Users,
    defaultColSpan: 1,
    minColSpan: 1,
    maxColSpan: 3,
    component: TeamProgressWidget,
  },
};

export function getWidgetDefinition(type: WidgetType): WidgetDefinition | undefined {
  return WIDGET_REGISTRY[type];
}

export function getAllWidgetDefinitions(): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY);
}

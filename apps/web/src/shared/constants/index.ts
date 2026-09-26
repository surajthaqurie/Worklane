/**
 * Central UI and domain constants for the Worklane Web Application.
 * Single source of truth for metadata, UI presets, localStorage keys, and API paths.
 */

import { WorkItemPriority, WorkItemType, StateCategory, SeverityLevel } from '../types/work-items';

export const WORK_ITEM_TYPE_METADATA: Record<
  WorkItemType,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  EPIC: { label: 'Epic', color: '#9333ea', bgColor: '#f3e8ff', borderColor: '#d8b4fe' },
  FEATURE: { label: 'Feature', color: '#0284c7', bgColor: '#e0f2fe', borderColor: '#7dd3fc' },
  STORY: { label: 'User Story', color: '#16a34a', bgColor: '#dcfce7', borderColor: '#86efac' },
  TASK: { label: 'Task', color: '#2563eb', bgColor: '#dbeafe', borderColor: '#93c5fd' },
  BUG: { label: 'Bug', color: '#dc2626', bgColor: '#fee2e2', borderColor: '#fca5a5' },
};

export const WORK_ITEM_PRIORITY_METADATA: Record<
  WorkItemPriority,
  { label: string; color: string; badgeVariant: 'secondary' | 'warning' | 'destructive' | 'default' }
> = {
  LOW: { label: 'Low', color: '#64748b', badgeVariant: 'secondary' },
  MEDIUM: { label: 'Medium', color: '#0284c7', badgeVariant: 'default' },
  HIGH: { label: 'High', color: '#d97706', badgeVariant: 'warning' },
  URGENT: { label: 'Urgent', color: '#dc2626', badgeVariant: 'destructive' },
};

export const SEVERITY_LEVEL_METADATA: Record<
  SeverityLevel,
  { label: string; color: string }
> = {
  LOW: { label: 'Low', color: '#64748b' },
  MEDIUM: { label: 'Medium', color: '#0284c7' },
  HIGH: { label: 'High', color: '#d97706' },
  CRITICAL: { label: 'Critical', color: '#dc2626' },
};

export const STATE_CATEGORY_METADATA: Record<
  StateCategory,
  { label: string; badgeColor: string }
> = {
  PROPOSED: { label: 'Proposed', badgeColor: '#64748b' },
  IN_PROGRESS: { label: 'In Progress', badgeColor: '#0284c7' },
  RESOLVED: { label: 'Resolved', badgeColor: '#d97706' },
  COMPLETED: { label: 'Completed', badgeColor: '#16a34a' },
};

export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;

export const LOCAL_STORAGE_KEYS = {
  THEME: 'worklane_theme',
  ACCESS_TOKEN: 'worklane_access_token',
  REFRESH_TOKEN: 'worklane_refresh_token',
  SELECTED_ORG: 'worklane_selected_org_id',
  SIDEBAR_COLLAPSED: 'worklane_sidebar_collapsed',
} as const;

export const DATE_FORMATS = {
  DISPLAY_DATE: 'MMM d, yyyy',
  DISPLAY_DATE_TIME: 'MMM d, yyyy h:mm a',
  ISO_SHORT: 'yyyy-MM-dd',
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    REFRESH: '/api/auth/refresh',
    ME: '/api/auth/me',
    LOGOUT: '/api/auth/logout',
  },
  PROJECTS: '/api/projects',
  WORK_ITEMS: '/api/work-items',
  ORGANIZATIONS: '/api/organizations',
  TEAMS: '/api/teams',
  BOARDS: '/api/boards',
  ITERATIONS: '/api/iterations',
  NOTIFICATIONS: '/api/notifications',
  AUDIT_LOGS: '/api/audit-logs',
  ANALYTICS: '/api/analytics',
} as const;

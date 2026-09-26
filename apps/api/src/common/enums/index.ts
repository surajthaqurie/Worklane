/**
 * Central domain enums for the Worklane API application.
 * Defines canonical string literal unions and const objects for core domain entities.
 */

export const WorkItemTypeEnum = {
  EPIC: 'EPIC',
  FEATURE: 'FEATURE',
  STORY: 'STORY',
  TASK: 'TASK',
  BUG: 'BUG',
} as const;

export type WorkItemTypeEnum = (typeof WorkItemTypeEnum)[keyof typeof WorkItemTypeEnum];

export const WorkItemPriorityEnum = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type WorkItemPriorityEnum = (typeof WorkItemPriorityEnum)[keyof typeof WorkItemPriorityEnum];

export const SeverityLevelEnum = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type SeverityLevelEnum = (typeof SeverityLevelEnum)[keyof typeof SeverityLevelEnum];

export const StateCategoryEnum = {
  PROPOSED: 'PROPOSED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  COMPLETED: 'COMPLETED',
} as const;

export type StateCategoryEnum = (typeof StateCategoryEnum)[keyof typeof StateCategoryEnum];

export const ProjectRoleEnum = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;

export type ProjectRoleEnum = (typeof ProjectRoleEnum)[keyof typeof ProjectRoleEnum];

export const OrganizationRoleEnum = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  GUEST: 'GUEST',
} as const;

export type OrganizationRoleEnum = (typeof OrganizationRoleEnum)[keyof typeof OrganizationRoleEnum];

export const BackgroundJobStatusEnum = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  DEAD_LETTER: 'DEAD_LETTER',
} as const;

export type BackgroundJobStatusEnum = (typeof BackgroundJobStatusEnum)[keyof typeof BackgroundJobStatusEnum];

export const AuditActionEnum = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ACCESS: 'ACCESS',
  EXPORT: 'EXPORT',
} as const;

export type AuditActionEnum = (typeof AuditActionEnum)[keyof typeof AuditActionEnum];

'use client';

import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { PermissionValue } from '@/config/permissions';

/**
 * Returns the project-scoped `can()` helper from the nearest ProjectContext.
 *
 * Usage:
 * ```ts
 * const { can, canAll, canAny, role } = usePermission();
 * if (can('work_item:create')) { ... }
 * ```
 */
export function usePermission() {
  const { can, canAll, canAny, projectRole } = useProjectContext();
  return { can, canAll, canAny, role: projectRole };
}

/** Convenience: returns whether the user has a specific permission. */
export function useCanDo(permission: PermissionValue): boolean {
  const { can } = usePermission();
  return can(permission);
}

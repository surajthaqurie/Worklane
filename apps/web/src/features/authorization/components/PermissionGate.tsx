'use client';

import React from 'react';
import { usePermission } from '../hooks/usePermission';
import { PermissionValue } from '@/config/permissions';

export interface PermissionGateProps {
  /** Render children only when the user has this single permission. */
  permission?: PermissionValue;
  /** Render children only when the user has ALL of these permissions. */
  all?: PermissionValue[];
  /** Render children when the user has ANY of these permissions. */
  any?: PermissionValue[];
  /** What to render when access is denied (default: null). */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's project permissions.
 * Priority: `permission` -> `all` -> `any`.
 */
export function PermissionGate({
  permission,
  all,
  any,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAll, canAny } = usePermission();

  let hasAccess: boolean;

  if (permission !== undefined) {
    hasAccess = can(permission);
  } else if (all !== undefined && all.length > 0) {
    hasAccess = canAll(...all);
  } else if (any !== undefined && any.length > 0) {
    hasAccess = canAny(...any);
  } else {
    hasAccess = true;
  }

  return <>{hasAccess ? children : fallback}</>;
}

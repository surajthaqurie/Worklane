'use client';

import React from 'react';
import { usePermission } from '../hooks/usePermission';
import { AccessDenied } from './AccessDenied';
import { PermissionValue } from '@/config/permissions';

export interface RoutePermissionGuardProps {
  /** The permission required to access this route */
  permission: PermissionValue;
  /** Human-readable description of what the user cannot do */
  message?: string;
  /** Where to navigate back */
  backHref?: string;
  children: React.ReactNode;
}

/**
 * Wraps an entire page/route behind a permission check.
 */
export function RoutePermissionGuard({
  permission,
  message,
  backHref,
  children,
}: RoutePermissionGuardProps) {
  const { can } = usePermission();

  if (!can(permission)) {
    return (
      <AccessDenied
        title="Permission Required"
        message={
          message ??
          `You need the "${permission}" permission to access this page.`
        }
        backHref={backHref}
        showBack
      />
    );
  }

  return <>{children}</>;
}

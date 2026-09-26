'use client';

import React from 'react';
import { usePermission } from '../hooks/usePermission';
import { PermissionValue } from '@/config/permissions';

export interface CanProps {
  do: PermissionValue;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Render-prop / expressive wrapper around PermissionGate using a `do` prop.
 */
export function Can({ do: permission, fallback = null, children }: CanProps) {
  const { can } = usePermission();
  return <>{can(permission) ? children : fallback}</>;
}

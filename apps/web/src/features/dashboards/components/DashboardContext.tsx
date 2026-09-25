'use client';

import React, { createContext, useContext } from 'react';
import type { DashboardData, WidgetLayout } from '@/shared/types/dashboard';

export interface DashboardContextValue {
  data?: DashboardData;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  projectId?: string | null;
  teamId?: string | null;
  layout: WidgetLayout[];
  onOpenWorkItem?: (id: string) => void;
  onResizeWidget: (widgetId: string, colSpan: number) => void;
  onToggleWidgetVisibility: (widgetId: string) => void;
  onResetLayout: () => void;
  isCustomizing: boolean;
  setIsCustomizing: (val: boolean) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return ctx;
}

export const DashboardProvider = DashboardContext.Provider;

'use client';

import React from 'react';
import {
  FolderOpen,
  CheckCircle2,
  ShieldAlert,
  WifiOff,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Spinner } from './Spinner';
import { ErrorState } from './ErrorState';
import { Button } from '../ui/Button';

export type FeedbackStatus =
  | 'loading'
  | 'empty'
  | 'error'
  | 'success'
  | 'permission-denied'
  | 'offline'
  | 'syncing'
  | 'sync-failed';

export interface FeedbackStateProps {
  status: FeedbackStatus;
  title?: string;
  description?: string;
  error?: unknown;
  action?: React.ReactNode;
  onRetry?: () => void;
  onReload?: () => void;
  onGoBack?: () => void;
  className?: string;
}

export function FeedbackState({
  status,
  title,
  description,
  error,
  action,
  onRetry,
  onReload,
  onGoBack,
  className = '',
}: FeedbackStateProps) {
  if (status === 'error') {
    return (
      <ErrorState
        error={error}
        title={title || 'An error occurred'}
        onRetry={onRetry}
        onReload={onReload}
        onGoBack={onGoBack}
        className={className}
      />
    );
  }

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-col items-center justify-center p-10 text-center gap-3 ${className}`}
      >
        <Spinner size="lg" />
        <h4 className="text-[14px] font-medium text-[var(--text-primary)]">
          {title || 'Loading...'}
        </h4>
        <p className="text-[12px] text-[var(--text-secondary)] max-w-sm">
          {description || 'Please wait while we retrieve the latest information.'}
        </p>
      </div>
    );
  }

  const stateConfigs: Record<
    Exclude<FeedbackStatus, 'error' | 'loading'>,
    {
      icon: React.ReactNode;
      defaultTitle: string;
      defaultDesc: string;
      container: string;
      iconBg: string;
      titleColor: string;
      descColor: string;
      role?: string;
    }
  > = {
    empty: {
      icon: <FolderOpen className="w-6 h-6 text-[var(--text-muted)]" />,
      defaultTitle: 'No items found',
      defaultDesc: 'There are no items to display at this time.',
      container: 'border-dashed border-[var(--border-default)] bg-[var(--bg-surface-subtle)]',
      iconBg: 'bg-[var(--bg-surface)] border-[var(--border-subtle)]',
      titleColor: 'text-[var(--text-primary)]',
      descColor: 'text-[var(--text-secondary)]',
      role: 'status',
    },
    success: {
      icon: <CheckCircle2 className="w-6 h-6 text-[var(--semantic-success-icon)]" />,
      defaultTitle: 'Completed successfully',
      defaultDesc: 'Your changes have been saved.',
      container: 'border-[var(--semantic-success-border)] bg-[var(--semantic-success-bg)]',
      iconBg: 'bg-[var(--bg-surface)] border-[var(--semantic-success-border)]',
      titleColor: 'text-[var(--semantic-success-text)]',
      descColor: 'text-[var(--semantic-success-text)]/90',
      role: 'status',
    },
    'permission-denied': {
      icon: <ShieldAlert className="w-6 h-6 text-[var(--semantic-denied-icon)]" />,
      defaultTitle: 'Permission Denied',
      defaultDesc: 'You do not have permission to view or modify this resource.',
      container: 'border-[var(--semantic-denied-border)] bg-[var(--semantic-denied-bg)]',
      iconBg: 'bg-[var(--bg-surface)] border-[var(--semantic-denied-border)]',
      titleColor: 'text-[var(--semantic-denied-text)]',
      descColor: 'text-[var(--semantic-denied-text)]/90',
      role: 'alert',
    },
    offline: {
      icon: <WifiOff className="w-6 h-6 text-[var(--semantic-offline-icon)]" />,
      defaultTitle: 'You are offline',
      defaultDesc: 'Please check your internet connection. Changes will sync once back online.',
      container: 'border-[var(--semantic-offline-border)] bg-[var(--semantic-offline-bg)]',
      iconBg: 'bg-[var(--bg-surface)] border-[var(--semantic-offline-border)]',
      titleColor: 'text-[var(--semantic-offline-text)]',
      descColor: 'text-[var(--semantic-offline-text)]/90',
      role: 'status',
    },
    syncing: {
      icon: <RefreshCw className="w-6 h-6 text-[var(--semantic-syncing-icon)] animate-spin" />,
      defaultTitle: 'Syncing changes...',
      defaultDesc: 'Uploading your latest modifications to the server.',
      container: 'border-[var(--semantic-syncing-border)] bg-[var(--semantic-syncing-bg)]',
      iconBg: 'bg-[var(--bg-surface)] border-[var(--semantic-syncing-border)]',
      titleColor: 'text-[var(--semantic-syncing-text)]',
      descColor: 'text-[var(--semantic-syncing-text)]/90',
      role: 'status',
    },
    'sync-failed': {
      icon: <AlertCircle className="w-6 h-6 text-[var(--semantic-danger-icon)]" />,
      defaultTitle: 'Sync failed',
      defaultDesc: 'Failed to synchronize local changes with the server.',
      container: 'border-[var(--semantic-danger-border)] bg-[var(--semantic-danger-bg)]',
      iconBg: 'bg-[var(--bg-surface)] border-[var(--semantic-danger-border)]',
      titleColor: 'text-[var(--semantic-danger-text)]',
      descColor: 'text-[var(--semantic-danger-text)]/90',
      role: 'alert',
    },
  };

  const config = stateConfigs[status];

  return (
    <div
      role={config.role || 'status'}
      aria-live={config.role === 'alert' ? 'assertive' : 'polite'}
      className={`
        flex flex-col items-center justify-center p-8 text-center border rounded-[var(--radius-card)]
        ${config.container}
        ${className}
      `}
    >
      <div className={`p-3 rounded-full border mb-3 shadow-xs ${config.iconBg}`}>
        {config.icon}
      </div>

      <h3 className={`text-[14px] font-semibold ${config.titleColor}`}>
        {title || config.defaultTitle}
      </h3>
      <p className={`text-[12px] mt-1 max-w-sm leading-relaxed ${config.descColor}`}>
        {description || config.defaultDesc}
      </p>

      {action ? (
        <div className="mt-4">{action}</div>
      ) : (
        (onRetry || onReload || onGoBack) && (
          <div className="mt-4 flex items-center gap-2">
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            )}
            {onReload && (
              <Button size="sm" variant="outline" onClick={onReload}>
                Reload
              </Button>
            )}
            {onGoBack && (
              <Button size="sm" variant="ghost" onClick={onGoBack}>
                Go Back
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}

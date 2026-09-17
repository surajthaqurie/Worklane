import React from 'react';
import { FolderOpen } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'No items found',
  description = 'There are no items to display at this time.',
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] ${className}`}>
      <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full text-[var(--text-muted)] mb-3">
        {icon || <FolderOpen className="w-6 h-6" />}
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      {description && <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

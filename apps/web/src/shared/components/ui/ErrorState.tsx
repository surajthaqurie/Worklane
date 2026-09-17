import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { formatApiError } from '../../utils/error';

export interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  error,
  title = 'Failed to load data',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center border border-rose-200 dark:border-rose-900/50 rounded-[var(--radius-card)] bg-rose-50/50 dark:bg-rose-950/20 ${className}`}>
      <div className="p-3 bg-rose-100 dark:bg-rose-900/40 rounded-full text-rose-600 dark:text-rose-400 mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">{title}</h3>
      <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-md">
        {formatApiError(error)}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 rounded-[var(--radius-button)] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
}

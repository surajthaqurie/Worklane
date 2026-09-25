'use client';

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { formatApiError } from '@/shared/utils/error';
import { Button } from '../ui/Button';

export interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  onReload?: () => void;
  onGoBack?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  onReload,
  onGoBack,
  showDetails = true,
  className = '',
}: ErrorStateProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const errorMessage = formatApiError(error);

  const errorStack =
    error instanceof Error ? error.stack : typeof error === 'object' ? JSON.stringify(error, null, 2) : null;

  return (
    <div
      role="alert"
      className={`
        flex flex-col items-center justify-center p-8 text-center
        border border-[var(--semantic-danger-border)] rounded-[var(--radius-card)]
        bg-[var(--semantic-danger-bg)] ${className}
      `}
    >
      <div className="p-3 bg-[var(--bg-surface)] border border-[var(--semantic-danger-border)] rounded-full text-[var(--semantic-danger-icon)] mb-3 shadow-xs">
        <AlertTriangle className="w-6 h-6" aria-hidden="true" />
      </div>

      <h3 className="text-[14px] font-semibold text-[var(--semantic-danger-text)]">
        {title}
      </h3>
      <p className="text-[12px] text-[var(--semantic-danger-text)]/90 mt-1 max-w-md leading-relaxed">
        {errorMessage}
      </p>

      {/* Recovery Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button
            size="sm"
            variant="danger"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={onRetry}
          >
            Try Again
          </Button>
        )}
        {onReload && (
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={onReload}
          >
            Reload Page
          </Button>
        )}
        {onGoBack && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={onGoBack}
          >
            Go Back
          </Button>
        )}
      </div>

      {/* Technical details toggle */}
      {showDetails && errorStack && (
        <div className="mt-4 w-full max-w-lg text-left">
          <button
            type="button"
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            className="flex items-center gap-1 text-[11px] text-[var(--semantic-danger-text)]/80 hover:text-[var(--semantic-danger-text)] font-medium outline-none"
          >
            {isDetailsOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <span>Technical details</span>
          </button>
          {isDetailsOpen && (
            <pre className="mt-2 p-3 bg-black/10 dark:bg-black/40 rounded-[var(--radius-xs)] text-[11px] font-mono text-[var(--semantic-danger-text)] overflow-x-auto max-h-36 whitespace-pre-wrap text-left">
              {errorStack}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

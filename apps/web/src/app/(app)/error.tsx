'use client';

import React from 'react';
import { RotateCcw, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-[var(--bg-app)] min-h-[400px]">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6 text-center shadow-lg">
        <div className="w-10 h-10 rounded-full bg-[var(--semantic-danger-bg)] text-[var(--semantic-danger-icon)] flex items-center justify-center mx-auto mb-3 border border-[var(--semantic-danger-border)]">
          <AlertCircle className="w-5 h-5" />
        </div>

        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Failed to load workspace view
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
          {error.message || 'An error occurred while loading this section of the project.'}
        </p>

        <div className="mt-5 flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => reset()}
          >
            Try Again
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

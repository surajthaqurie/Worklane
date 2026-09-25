'use client';

import React from 'react';
import { RotateCcw, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-8 text-center shadow-xl">
        <div className="w-12 h-12 rounded-full bg-[var(--semantic-danger-bg)] text-[var(--semantic-danger-icon)] flex items-center justify-center mx-auto mb-4 border border-[var(--semantic-danger-border)]">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          Something went wrong
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
          {error.message || 'An unexpected application error occurred. You can retry or reload.'}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => reset()}
            className="px-4 py-2 text-xs font-medium bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] rounded-[var(--radius-button)] transition-colors cursor-pointer"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] rounded-[var(--radius-button)] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reload
          </button>
          <Link
            href="/projects"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}

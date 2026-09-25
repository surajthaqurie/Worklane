import React from 'react';
import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-8 shadow-lg flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--brand-primary)] mb-4">
          <Compass className="w-6 h-6" />
        </div>

        <h1 className="text-xl font-bold text-[var(--text-primary)]">404 - Page Not Found</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed max-w-xs">
          The page or workspace you requested does not exist or has been moved.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}

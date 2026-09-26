'use client';

import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export interface AccessDeniedProps {
  /** Title for the error panel */
  title?: string;
  /** Human-readable message explaining what the user cannot do */
  message?: string;
  /** If provided, render a link back to this path */
  backHref?: string;
  /** If provided, render a "Go back" button using router.back() */
  showBack?: boolean;
  /** Compact inline mode */
  inline?: boolean;
}

/**
 * Rendered when the user lacks permission to view a resource or section.
 */
export function AccessDenied({
  title = 'Access Denied',
  message = "You don't have permission to view this page. Contact your project administrator if you believe this is a mistake.",
  backHref,
  showBack = true,
  inline = false,
}: AccessDeniedProps) {
  const router = useRouter();

  const inner = (
    <div
      className={`flex flex-col items-center text-center ${
        inline ? 'py-8 px-4' : 'p-8'
      } max-w-sm mx-auto`}
    >
      <div className="w-12 h-12 rounded-full bg-[var(--semantic-warning-bg)] border border-[var(--semantic-warning-border)] flex items-center justify-center mb-4">
        <ShieldAlert className="w-6 h-6 text-[var(--semantic-warning-icon)]" aria-hidden />
      </div>
      <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1.5">{title}</h2>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-5">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {showBack && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={() => router.back()}
          >
            Go back
          </Button>
        )}
        {backHref && (
          <Link href={backHref}>
            <Button variant="ghost" size="sm">
              Back to safety
            </Button>
          </Link>
        )}
      </div>
    </div>
  );

  if (inline) return inner;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] shadow-sm">
        {inner}
      </div>
    </div>
  );
}

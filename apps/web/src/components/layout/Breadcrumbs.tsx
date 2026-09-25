'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Breadcrumb } from '@/shared/hooks/useBreadcrumbs';

interface BreadcrumbsProps {
  crumbs: Breadcrumb[];
}

/**
 * Renders an accessible breadcrumb trail.
 * The last item is rendered as plain text (current page) while all prior items
 * are clickable links.
 */
export function Breadcrumbs({ crumbs }: BreadcrumbsProps) {
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center min-w-0">
      <ol className="flex items-center gap-1 text-[13px] text-[var(--text-muted)] min-w-0">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li key={crumb.href} className="flex items-center gap-1 min-w-0">
              {index > 0 && (
                <ChevronRight
                  className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0"
                  aria-hidden
                />
              )}
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-medium text-[var(--text-primary)] truncate"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-[var(--text-primary)] transition-colors truncate focus-ring rounded"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { IconButton } from '../ui/IconButton';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className = '',
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  // Generate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('ellipsis');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(safeTotalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < safeTotalPages - 2) pages.push('ellipsis');
      pages.push(safeTotalPages);
    }
    return pages;
  };

  const startItem = totalItems !== undefined && pageSize ? (safePage - 1) * pageSize + 1 : undefined;
  const endItem =
    totalItems !== undefined && pageSize
      ? Math.min(safePage * pageSize, totalItems)
      : undefined;

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-[var(--text-secondary)] select-none ${className}`}
    >
      {/* Information text */}
      <div className="flex items-center gap-3">
        {totalItems !== undefined && startItem !== undefined && endItem !== undefined ? (
          <span>
            Showing <strong className="text-[var(--text-primary)]">{startItem}</strong> to{' '}
            <strong className="text-[var(--text-primary)]">{endItem}</strong> of{' '}
            <strong className="text-[var(--text-primary)]">{totalItems}</strong> results
          </span>
        ) : (
          <span>
            Page <strong className="text-[var(--text-primary)]">{safePage}</strong> of{' '}
            <strong className="text-[var(--text-primary)]">{safeTotalPages}</strong>
          </span>
        )}

        {pageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[12px] text-[var(--text-muted)]">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Items per page"
              className="px-2 py-1 text-[12px] border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <IconButton
          icon={<ChevronsLeft className="w-4 h-4" />}
          aria-label="Go to first page"
          size="sm"
          variant="outline"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
        />
        <IconButton
          icon={<ChevronLeft className="w-4 h-4" />}
          aria-label="Go to previous page"
          size="sm"
          variant="outline"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        />

        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((p, idx) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-[var(--text-muted)]">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === safePage ? 'page' : undefined}
                onClick={() => onPageChange(p)}
                className={`
                  w-8 h-8 rounded-[var(--radius-button)] text-[12px] font-medium transition-colors cursor-pointer outline-none
                  focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]
                  ${
                    p === safePage
                      ? 'bg-[var(--brand-primary)] text-white font-semibold'
                      : 'border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)]'
                  }
                `}
              >
                {p}
              </button>
            )
          )}
        </div>

        <IconButton
          icon={<ChevronRight className="w-4 h-4" />}
          aria-label="Go to next page"
          size="sm"
          variant="outline"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
        />
        <IconButton
          icon={<ChevronsRight className="w-4 h-4" />}
          aria-label="Go to last page"
          size="sm"
          variant="outline"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
        />
      </div>
    </nav>
  );
}

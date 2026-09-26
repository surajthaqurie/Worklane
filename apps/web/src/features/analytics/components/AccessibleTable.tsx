'use client';

import React, { useState } from 'react';
import { ArrowUpDown, Download, Table as TableIcon } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}

interface AccessibleTableProps<T> {
  title?: string;
  caption?: string;
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function AccessibleTable<T>({
  title,
  caption,
  columns,
  data,
  keyExtractor,
  pageSize = 20,
  emptyMessage = 'No data available in this report view.',
  onRowClick,
}: AccessibleTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortValue) return 0;
    const valA = col.sortValue(a);
    const valB = col.sortValue(b);
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize);

  const exportTableCsv = () => {
    const headers = columns.map((c) => `"${c.header}"`).join(',');
    const rows = sortedData.map((row) =>
      columns
        .map((c) => {
          const val = c.sortValue ? c.sortValue(row) : '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'report'}-table-data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-[var(--text-muted)]" aria-hidden />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {title || 'Report Data Table'}
          </h3>
          <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-surface-hover)] px-2 py-0.5 rounded-full">
            {data.length} records
          </span>
        </div>

        <button
          onClick={exportTableCsv}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] px-2 py-1 rounded transition-colors focus-ring"
        >
          <Download className="w-3 h-3" aria-hidden />
          <span>CSV</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px] border-collapse" aria-label={caption || title || 'Report Data'}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-muted)] font-medium">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col)}
                  className={`p-2.5 ${col.sortable ? 'cursor-pointer select-none hover:text-[var(--text-primary)]' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.header}</span>
                    {col.sortable && <ArrowUpDown className="w-3 h-3 shrink-0 text-[var(--text-muted)]" aria-hidden />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-[var(--text-muted)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-[var(--bg-surface-hover)] transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="p-2.5 text-[var(--text-primary)]">
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded bg-[var(--bg-surface-hover)] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded bg-[var(--bg-surface-hover)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

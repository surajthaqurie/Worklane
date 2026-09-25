'use client';

import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { SkeletonTable } from '../ui/Skeleton';
import { EmptyState } from '../feedback/EmptyState';
import { Pagination, PaginationProps } from '../navigation/Pagination';
import { Checkbox } from '../forms/Checkbox';

export interface ColumnDef<T> {
  id: string;
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  hideOnMobile?: boolean;
}

export type SortDirection = 'asc' | 'desc';

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId?: (row: T, index: number) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  sortColumn?: string;
  sortDirection?: SortDirection;
  onSortChange?: (columnId: string, direction: SortDirection) => void;
  selectedRowIds?: Set<string>;
  onSelectRow?: (id: string) => void;
  onSelectAll?: () => void;
  onRowClick?: (row: T) => void;
  pagination?: Omit<PaginationProps, 'className'>;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  getRowId = (_row, idx) => String(idx),
  isLoading = false,
  emptyTitle = 'No data available',
  emptyDescription = 'There are no records to display.',
  emptyAction,
  sortColumn,
  sortDirection,
  onSortChange,
  selectedRowIds,
  onSelectRow,
  onSelectAll,
  onRowClick,
  pagination,
  className = '',
}: DataTableProps<T>) {
  const isSelectable = !!selectedRowIds && !!onSelectRow;
  const isAllSelected =
    isSelectable &&
    data.length > 0 &&
    data.every((row, idx) => selectedRowIds.has(getRowId(row, idx)));

  const handleHeaderSort = (col: ColumnDef<T>) => {
    if (!col.sortable || !onSortChange) return;
    if (sortColumn === col.id) {
      onSortChange(col.id, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(col.id, 'asc');
    }
  };

  if (isLoading) {
    return <SkeletonTable rows={5} cols={columns.length + (isSelectable ? 1 : 0)} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className={`flex flex-col gap-3 w-full ${className}`}>
      {/* Table container with responsive horizontal scroll */}
      <div className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] overflow-x-auto bg-[var(--bg-surface)] shadow-xs">
        <table className="w-full text-left text-[13px] border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] select-none">
              {isSelectable && (
                <th className="p-3 w-10 text-center">
                  <Checkbox
                    checked={isAllSelected}
                    onChange={onSelectAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}

              {columns.map((col) => {
                const isSorted = sortColumn === col.id;
                const alignClass =
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                    ? 'text-right'
                    : 'text-left';

                return (
                  <th
                    key={col.id}
                    style={{ width: col.width }}
                    onClick={() => handleHeaderSort(col)}
                    className={`
                      p-3 font-semibold text-[var(--text-secondary)] text-[12px] uppercase tracking-wider
                      ${alignClass}
                      ${col.sortable ? 'cursor-pointer hover:text-[var(--text-primary)] transition-colors' : ''}
                      ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}
                    `}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        col.align === 'center'
                          ? 'justify-center'
                          : col.align === 'right'
                          ? 'justify-end'
                          : 'justify-start'
                      }`}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-[var(--text-muted)]">
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-60" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)]">
            {data.map((row, rowIdx) => {
              const rowId = getRowId(row, rowIdx);
              const isSelected = selectedRowIds?.has(rowId);

              return (
                <tr
                  key={rowId}
                  onClick={() => onRowClick?.(row)}
                  className={`
                    transition-colors
                    ${
                      isSelected
                        ? 'bg-[var(--bg-surface-selected)]'
                        : 'hover:bg-[var(--bg-surface-hover)]'
                    }
                    ${onRowClick ? 'cursor-pointer' : ''}
                  `}
                >
                  {isSelectable && (
                    <td
                      className="p-3 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRow?.(rowId);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => onSelectRow?.(rowId)}
                        aria-label={`Select row ${rowIdx + 1}`}
                      />
                    </td>
                  )}

                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                        ? 'text-right'
                        : 'text-left';

                    const content = col.cell
                      ? col.cell(row, rowIdx)
                      : col.accessorKey
                      ? (row[col.accessorKey] as React.ReactNode)
                      : null;

                    return (
                      <td
                        key={col.id}
                        className={`
                          p-3 align-middle text-[13px]
                          ${alignClass}
                          ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}
                        `}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination integration */}
      {pagination && <Pagination {...pagination} className="px-1" />}
    </div>
  );
}

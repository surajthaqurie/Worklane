'use client';

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  UserMinus,
  UserCheck,
  LogIn,
  LogOut,
  FolderPlus,
  Settings,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User as UserIcon,
  Globe,
  ArrowRight,
} from 'lucide-react';
import { useProjectAuditLogs } from '../hooks/useAuditLogs';
import { useProjectPermissions } from '@/shared/hooks/useProjectPermissions';
import { useProjectMembers } from '@/features/projects/hooks/useProjects';
import type { AuditRecord } from '@/shared/types/audit';

export interface AuditLogViewProps {
  projectId: string;
}

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All Event Types' },
  { value: 'ROLE_CHANGED', label: 'Role Changed' },
  { value: 'MEMBER_ADDED', label: 'Member Added' },
  { value: 'MEMBER_REMOVED', label: 'Member Removed' },
  { value: 'PERMISSION_DENIED', label: 'Permission Denied' },
  { value: 'PROJECT_CREATED', label: 'Project Created' },
  { value: 'PROJECT_UPDATED', label: 'Project Updated' },
  { value: 'LOGIN', label: 'User Login' },
  { value: 'LOGOUT', label: 'User Logout' },
];

function getEventBadge(eventType: string) {
  switch (eventType) {
    case 'ROLE_CHANGED':
      return {
        icon: UserCheck,
        label: 'Role Changed',
        bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
        ring: 'ring-blue-500/20',
      };
    case 'MEMBER_ADDED':
      return {
        icon: UserPlus,
        label: 'Member Added',
        bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        ring: 'ring-emerald-500/20',
      };
    case 'MEMBER_REMOVED':
      return {
        icon: UserMinus,
        label: 'Member Removed',
        bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
        ring: 'ring-rose-500/20',
      };
    case 'PERMISSION_DENIED':
      return {
        icon: ShieldAlert,
        label: 'Permission Denied',
        bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        ring: 'ring-amber-500/20',
      };
    case 'PROJECT_CREATED':
      return {
        icon: FolderPlus,
        label: 'Project Created',
        bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
        ring: 'ring-purple-500/20',
      };
    case 'PROJECT_UPDATED':
      return {
        icon: Settings,
        label: 'Project Updated',
        bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
        ring: 'ring-slate-500/20',
      };
    case 'LOGIN':
      return {
        icon: LogIn,
        label: 'Login',
        bg: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
        ring: 'ring-cyan-500/20',
      };
    case 'LOGOUT':
      return {
        icon: LogOut,
        label: 'Logout',
        bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
        ring: 'ring-slate-500/20',
      };
    default:
      return {
        icon: Shield,
        label: eventType.replace(/_/g, ' '),
        bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
        ring: 'ring-slate-500/20',
      };
  }
}

export function AuditLogView({ projectId }: AuditLogViewProps) {
  const { can, role, isLoading: isLoadingAuth } = useProjectPermissions(projectId);
  const { data: members = [] } = useProjectMembers(projectId);

  const [selectedActor, setSelectedActor] = useState<string>('');
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  const isAuthorized = can('audit_log:view') || role === 'ADMIN' || role === 'OWNER';

  const queryParams = useMemo(() => {
    return {
      page,
      limit,
      actorId: selectedActor || undefined,
      eventType: selectedEventType || undefined,
      from: startDate ? new Date(startDate).toISOString() : undefined,
      to: endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined,
    };
  }, [page, limit, selectedActor, selectedEventType, startDate, endDate]);

  const { data, isLoading, isError, error } = useProjectAuditLogs(
    projectId,
    queryParams,
    isAuthorized,
  );

  const hasActiveFilters = Boolean(selectedActor || selectedEventType || startDate || endDate);

  const handleClearFilters = () => {
    setSelectedActor('');
    setSelectedEventType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  if (isLoadingAuth) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-[var(--radius-card)] flex flex-col items-center text-center gap-3">
          <ShieldAlert className="w-12 h-12 text-rose-600 dark:text-rose-400" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Access Restricted</h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-md">
            Security and administrative audit logs are strictly restricted to authorized project
            administrators and owners. You do not have permission to view audit records for this workspace.
          </p>
        </div>
      </div>
    );
  }

  const items: AuditRecord[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[var(--brand-primary)]" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Audit Log</h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Immutable administrative and security events trail. Tracks member permissions, role updates, and authentication safeguards.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-xs text-[var(--text-primary)]">
            <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
            <span>Filter Audit Records</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 text-xs text-[var(--brand-primary)] hover:underline font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Actor Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
              Actor
            </label>
            <select
              value={selectedActor}
              onChange={(e) => {
                setSelectedActor(e.target.value);
                setPage(1);
              }}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="">All Actors</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userName} ({m.userEmail || m.role})
                </option>
              ))}
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
              Event Type
            </label>
            <select
              value={selectedEventType}
              onChange={(e) => {
                setSelectedEventType(e.target.value);
                setPage(1);
              }}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          {/* Date Range: To */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3 py-8">
          <div className="h-20 bg-[var(--bg-surface-subtle)] rounded-[var(--radius-card)] animate-pulse" />
          <div className="h-20 bg-[var(--bg-surface-subtle)] rounded-[var(--radius-card)] animate-pulse" />
          <div className="h-20 bg-[var(--bg-surface-subtle)] rounded-[var(--radius-card)] animate-pulse" />
        </div>
      ) : isError ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-[var(--radius-card)] text-rose-700 dark:text-rose-400 text-xs">
          Failed to load audit records: {(error as Error)?.message || 'Unknown error'}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col items-center justify-center gap-2">
          <Shield className="w-10 h-10 text-[var(--text-muted)] opacity-40" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">No audit records found</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {hasActiveFilters
              ? 'No security or administrative events matched your filter criteria.'
              : 'Security actions, membership updates, and administrative events will appear here.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-2 text-xs text-[var(--brand-primary)] hover:underline font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        /* Timeline of Administrative Events */
        <div className="relative border-l-2 border-[var(--border-subtle)] ml-4 pl-6 space-y-6">
          {items.map((entry) => {
            const badge = getEventBadge(entry.eventType);
            const Icon = badge.icon;
            const eventDate = new Date(entry.createdAt);
            const formattedDate = !isNaN(eventDate.getTime())
              ? format(eventDate, 'MMM d, yyyy · h:mm:ss a')
              : 'Unknown date';

            return (
              <div key={entry.id} className="relative group/audit">
                {/* Node icon */}
                <div
                  className={`absolute -left-[35px] top-1.5 w-6 h-6 rounded-full border-2 border-[var(--bg-surface)] flex items-center justify-center ${badge.bg}`}
                >
                  <Icon className="w-3 h-3" />
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-4 shadow-xs hover:border-[var(--border-default)] transition-colors space-y-3">
                  {/* Top Bar: Event Badge, Actor, Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.bg}`}
                      >
                        <Icon className="w-3 h-3" />
                        {badge.label}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {entry.summary}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] font-mono">
                      {entry.ipAddress && (
                        <span className="flex items-center gap-1" title="IP Address">
                          <Globe className="w-3 h-3 text-[var(--text-muted)]" />
                          <span>{entry.ipAddress}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{formattedDate}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actor details */}
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <UserIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span className="font-medium text-[var(--text-primary)]">
                      {entry.actor.name}
                    </span>
                    {entry.actor.email && (
                      <span className="text-[var(--text-muted)]">({entry.actor.email})</span>
                    )}
                  </div>

                  {/* Structured Diff (if applicable: Role Changed, Member Added, etc.) */}
                  {entry.diff && (
                    <div className="bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded p-2.5 text-xs flex flex-wrap items-center gap-3">
                      <span className="font-semibold text-[var(--text-secondary)] uppercase text-[10px] tracking-wide">
                        {entry.diff.field}:
                      </span>
                      {entry.diff.target && (
                        <span className="font-medium text-[var(--text-primary)]">
                          Target: {entry.diff.target}
                        </span>
                      )}
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        {entry.diff.before ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 line-through">
                            {entry.diff.before}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] italic text-[10px]">None</span>
                        )}
                        <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                        {entry.diff.after ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">
                            {entry.diff.after}
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 italic text-[10px]">
                            Removed
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Safe Details JSON viewer if there are non-empty details */}
                  {entry.details && Object.keys(entry.details).length > 0 && !entry.diff && (
                    <div className="bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded p-2.5 text-[11px] font-mono text-[var(--text-secondary)] overflow-x-auto">
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border-subtle)] text-xs">
          <div className="text-[var(--text-secondary)]">
            Showing <span className="font-semibold text-[var(--text-primary)]">{(page - 1) * limit + 1}</span>–
            <span className="font-semibold text-[var(--text-primary)]">
              {Math.min(page * limit, total)}
            </span>{' '}
            of <span className="font-semibold text-[var(--text-primary)]">{total}</span> records
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span>Show:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Page Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="p-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium text-[var(--text-primary)] px-2">
                Page {page} of {Math.max(1, totalPages)}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages || isLoading}
                className="p-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Bookmark,
  X,
  ChevronDown,
  Check,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { useAnalyticsFilters } from '../hooks/useAnalytics';
import { analyticsApi } from '../api/analyticsApi';

interface ReportFilterBarProps {
  projectId: string;
  teams?: Array<{ id: string; name: string }>;
  iterations?: Array<{ id: string; name: string }>;
  savedReportsCount?: number;
  onOpenSavedReports?: () => void;
  onRefresh?: () => void;
  lastUpdated?: string | null;
}

const DATE_PRESETS = [
  { label: 'Today', value: 'today', days: 0 },
  { label: 'This Week', value: 'week', days: 7 },
  { label: 'This Month', value: 'month', days: 30 },
  { label: 'Last 30 Days', value: '30d', days: 30 },
  { label: 'Last 90 Days', value: '90d', days: 90 },
  { label: 'Last 180 Days', value: '180d', days: 180 },
  { label: 'Custom Range', value: 'custom', days: null },
];

const WORK_ITEM_TYPES = [
  { label: 'Epic', value: 'EPIC' },
  { label: 'Feature', value: 'FEATURE' },
  { label: 'Story', value: 'STORY' },
  { label: 'Task', value: 'TASK' },
  { label: 'Bug', value: 'BUG' },
];

const PRIORITIES = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' },
];

export function ReportFilterBar({
  projectId,
  teams = [],
  iterations = [],
  onOpenSavedReports,
  onRefresh,
  lastUpdated,
}: ReportFilterBarProps) {
  const { filters, updateFilters, clearFilters } = useAnalyticsFilters();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const selectedPreset = filters.rangePreset || '30d';

  const handlePresetChange = (presetValue: string) => {
    if (presetValue === 'custom') {
      updateFilters({ range: 'custom' });
      return;
    }
    const preset = DATE_PRESETS.find((p) => p.value === presetValue);
    if (!preset) return;

    const toDate = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(Date.now() - (preset.days ?? 30) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    updateFilters({ range: presetValue, from: fromDate, to: toDate });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportUrl = analyticsApi.getExportUrl(projectId, {
        from: filters.from,
        to: filters.to,
        teamId: filters.teamId,
        iterationId: filters.iterationId,
        workItemTypes: filters.workItemTypes,
        states: filters.states,
        priorities: filters.priorities,
        assignedTo: filters.assignedTo,
        reportType: filters.view,
      });

      const a = document.createElement('a');
      a.href = exportUrl;
      a.download = `report-export-${filters.view || 'analytics'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // Export fallback
    } finally {
      setIsExporting(false);
    }
  };

  const hasActiveFilters = Boolean(
    filters.teamId ||
      filters.iterationId ||
      filters.areaId ||
      (filters.workItemTypes && filters.workItemTypes.length > 0) ||
      (filters.states && filters.states.length > 0) ||
      (filters.priorities && filters.priorities.length > 0) ||
      (filters.assignedTo && filters.assignedTo.length > 0) ||
      filters.from ||
      filters.to,
  );

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-3 mb-6 space-y-3 shadow-xs">
      {/* Top bar controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Date Range Selector */}
          <div className="relative inline-flex items-center">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 pointer-events-none" aria-hidden />
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="pl-8 pr-7 py-1.5 text-[12px] font-medium bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] appearance-none cursor-pointer"
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[var(--text-muted)] absolute right-2 pointer-events-none" aria-hidden />
          </div>

          {/* Custom Date Inputs if Custom selected */}
          {selectedPreset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={filters.from || ''}
                onChange={(e) => updateFilters({ from: e.target.value })}
                className="px-2 py-1 text-[12px] bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus-ring"
              />
              <span className="text-[12px] text-[var(--text-muted)]">to</span>
              <input
                type="date"
                value={filters.to || ''}
                onChange={(e) => updateFilters({ to: e.target.value })}
                className="px-2 py-1 text-[12px] bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus-ring"
              />
            </div>
          )}

          {/* Team Scope Selector */}
          {teams.length > 0 && (
            <select
              value={filters.teamId || ''}
              onChange={(e) => updateFilters({ team: e.target.value || null })}
              className="px-2.5 py-1.5 text-[12px] font-medium bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus-ring cursor-pointer"
            >
              <option value="">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  Team: {t.name}
                </option>
              ))}
            </select>
          )}

          {/* Iteration Scope Selector */}
          {iterations.length > 0 && (
            <select
              value={filters.iterationId || ''}
              onChange={(e) => updateFilters({ iteration: e.target.value || null })}
              className="px-2.5 py-1.5 text-[12px] font-medium bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus-ring cursor-pointer"
            >
              <option value="">All Iterations</option>
              {iterations.map((it) => (
                <option key={it.id} value={it.id}>
                  Iteration: {it.name}
                </option>
              ))}
            </select>
          )}

          {/* Toggle Advanced Filters */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-[var(--radius-button)] border transition-colors focus-ring ${
              showAdvanced || hasActiveFilters
                ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/30'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden />
            <span>Filter</span>
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]" />
            )}
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-rose-600 transition-colors"
            >
              <RotateCcw className="w-3 h-3" aria-hidden />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="text-[11px] text-[var(--text-muted)] hidden md:inline">
              Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh Analytics Data"
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors focus-ring"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden />
            </button>
          )}

          {onOpenSavedReports && (
            <button
              onClick={onOpenSavedReports}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] hover:opacity-90 transition-opacity focus-ring"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-500" aria-hidden />
              <span>Saved Reports</span>
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-opacity disabled:opacity-50 focus-ring shadow-xs"
          >
            <Download className="w-3.5 h-3.5" aria-hidden />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Drawer / Row */}
      {showAdvanced && (
        <div className="pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
          {/* Work Item Type */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
              Work Item Type
            </label>
            <div className="flex flex-wrap gap-1">
              {WORK_ITEM_TYPES.map((t) => {
                const isSelected = filters.workItemTypes?.includes(t.value);
                return (
                  <button
                    key={t.value}
                    onClick={() => {
                      const cur = filters.workItemTypes || [];
                      const next = isSelected
                        ? cur.filter((v) => v !== t.value)
                        : [...cur, t.value];
                      updateFilters({ types: next });
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                      isSelected
                        ? 'bg-[var(--brand-primary)] text-white border-transparent'
                        : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
              Priority
            </label>
            <div className="flex flex-wrap gap-1">
              {PRIORITIES.map((p) => {
                const isSelected = filters.priorities?.includes(p.value);
                return (
                  <button
                    key={p.value}
                    onClick={() => {
                      const cur = filters.priorities || [];
                      const next = isSelected
                        ? cur.filter((v) => v !== p.value)
                        : [...cur, p.value];
                      updateFilters({ priorities: next });
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                      isSelected
                        ? 'bg-[var(--brand-primary)] text-white border-transparent'
                        : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Work Item Status */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
              Status Filter
            </label>
            <select
              value={filters.status || 'all'}
              onChange={(e) => updateFilters({ status: e.target.value === 'all' ? null : e.target.value })}
              className="w-full px-2 py-1 bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="completed">Completed Only</option>
              <option value="overdue">Overdue Work Only</option>
              <option value="blocked">Blocked Work Only</option>
            </select>
          </div>

          {/* Quick Active Chips */}
          <div className="flex flex-col justify-end">
            <span className="text-[11px] text-[var(--text-muted)]">
              {hasActiveFilters ? 'Filters applied on PostgreSQL query' : 'Showing all project scope'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

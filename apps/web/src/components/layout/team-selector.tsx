'use client';

import React from 'react';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { Users } from 'lucide-react';

export function TeamSelector() {
  const { teams, selectedTeamId, setSelectedTeamId } = useProjectContext();

  return (
    <div className="px-3 pt-3">
      <div className="relative">
        <Users className="pointer-events-none absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <select
          value={selectedTeamId ?? ''}
          onChange={(e) => setSelectedTeamId(e.target.value || null)}
          className="w-full appearance-none border border-[var(--border-subtle)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] pl-8 pr-8 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors cursor-pointer"
          aria-label="Switch team"
        >
          <option value="">All work</option>
          {(teams ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
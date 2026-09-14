'use client';
import { use } from 'react';

export default function MembersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);
  
  return (
    <div className="w-full flex flex-col h-full max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-[var(--border-subtle)] shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">
            Members
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            People with access to this project.
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
          <button className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] font-medium rounded-[var(--radius-button)] transition-colors">
            Invite Member
          </button>
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4 p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors">
          <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center font-medium text-[14px]">
            SC
          </div>
          <div className="flex-1 flex justify-between items-center">
            <div>
              <div className="font-medium text-[14px] text-[var(--text-primary)]">Suraj Chand</div>
              <div className="text-[13px] text-[var(--text-secondary)]">suraj@example.com</div>
            </div>
            <div className="text-[12px] text-[var(--text-muted)]">
              Joined Sep 10, 2026
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center font-medium text-[14px]">
            AL
          </div>
          <div className="flex-1 flex justify-between items-center">
            <div>
              <div className="font-medium text-[14px] text-[var(--text-primary)]">Alex Lee</div>
              <div className="text-[13px] text-[var(--text-secondary)]">alex@example.com</div>
            </div>
            <div className="text-[12px] text-[var(--text-muted)]">
              Joined Sep 12, 2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganizationContext } from '@/features/organizations';
import { CreateOrganizationModal } from '@/features/organizations';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

export default function OrgsRootPage() {
  const router = useRouter();
  const { activeOrgId, isNoOrganizations, isLoading } = useOrganizationContext();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && activeOrgId) {
      router.replace(`/orgs/${activeOrgId}/projects`);
    }
  }, [isLoading, activeOrgId, router]);

  if (isLoading || activeOrgId) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-8 text-center shadow-lg">
          <div className="w-14 h-14 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border-subtle)]">
            <Building2 className="w-7 h-7" />
          </div>
          <h2 className="text-[20px] font-semibold text-[var(--text-primary)] mb-2">
            No Organizations
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mb-6 leading-relaxed">
            You are not a member of any organization yet. Create your first organization to start organizing projects, managing teams, and tracking work.
          </p>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Organization</span>
          </button>
        </div>

        <CreateOrganizationModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />
      </div>
    </AppShell>
  );
}

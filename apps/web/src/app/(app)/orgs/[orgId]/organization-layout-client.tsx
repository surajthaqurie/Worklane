'use client';

import React from 'react';
import { useOrganizationContext } from '@/features/organizations';
import { UnauthorizedOrgCard } from '@/features/organizations';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

export function OrganizationLayoutClient({
  children,
}: {
  children: React.ReactNode;
  orgId: string;
}) {
  const { isLoading, isUnauthorized } = useOrganizationContext();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
            <p className="text-[13px] text-[var(--text-secondary)]">Loading organization...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (isUnauthorized) {
    return (
      <AppShell>
        <UnauthorizedOrgCard />
      </AppShell>
    );
  }

  return <>{children}</>;
}

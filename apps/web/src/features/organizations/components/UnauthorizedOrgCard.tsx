'use client';

import React from 'react';
import Link from 'next/link';
import { useOrganizationContext } from '../context/OrganizationContext';
import { ShieldAlert, ArrowRight, Building2 } from 'lucide-react';

export function UnauthorizedOrgCard() {
  const { organizations, switchOrganization } = useOrganizationContext();

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-8 text-center shadow-lg">
        <div className="w-14 h-14 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-2">
          Organization Access Denied
        </h2>

        <p className="text-[13px] text-[var(--text-secondary)] mb-6 leading-relaxed">
          You do not have permission to access this organization, or this organization does not exist.
          Direct URL manipulation across unauthorized organization boundaries is restricted.
        </p>

        {organizations.length > 0 ? (
          <div className="text-left mb-6 bg-[var(--bg-surface-elevated)] p-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)]">
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Your Accessible Organizations
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => switchOrganization(org.id)}
                  className="w-full flex items-center justify-between p-2 rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)] text-[13px] text-[var(--text-primary)] transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[var(--brand-primary)]" />
                    <span className="font-medium truncate max-w-[180px]">{org.name}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <Link
              href="/projects"
              className="inline-flex items-center justify-center px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity shadow-xs"
            >
              Go to Projects
            </Link>
          </div>
        )}

        <div className="text-[12px] text-[var(--text-muted)]">
          Need access? Contact an administrator of that organization to receive an invitation.
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useOrganizationContext } from '../context/OrganizationContext';
import { CreateOrganizationModal } from './CreateOrganizationModal';
import {
  Building2,
  ChevronDown,
  Check,
  Plus,
  Settings,
  ShieldAlert,
  Loader2,
  Search,
} from 'lucide-react';

interface OrganizationSwitcherProps {
  compact?: boolean;
}

export function OrganizationSwitcher({ compact = false }: OrganizationSwitcherProps) {
  const {
    organizations,
    activeOrg,
    activeOrgId,
    activeRole,
    isLoading,
    isUnauthorized,
    isNoOrganizations,
    switchOrganization,
  } = useOrganizationContext();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(search.toLowerCase()),
  );

  const getInitials = (name?: string) => {
    if (!name) return 'O';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getRoleBadgeColor = (role?: string | null) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'ADMIN':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        {/* Switcher Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer text-left ${
            compact ? 'w-auto' : 'w-full max-w-[220px]'
          }`}
          title={activeOrg?.name || 'Organization Switcher'}
        >
          {isLoading ? (
            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[12px]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--brand-primary)]" />
              {!compact && <span>Loading org...</span>}
            </div>
          ) : isUnauthorized ? (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[12px] font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {!compact && <span className="truncate">Unauthorized Org</span>}
            </div>
          ) : isNoOrganizations ? (
            <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[12px]">
              <Building2 className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
              {!compact && <span>No Organizations</span>}
            </div>
          ) : (
            <div className="flex items-center justify-between w-full min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-[var(--radius-button)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center text-[10px] font-bold shrink-0">
                  {getInitials(activeOrg?.name)}
                </div>
                {!compact && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate max-w-[120px]">
                      {activeOrg?.name || 'Select Org'}
                    </span>
                    {activeRole && (
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">
                        {activeRole}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 ml-1.5" />
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 mt-1 w-64 rounded-[var(--radius-card)] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] shadow-xl z-50 overflow-hidden animate-in fade-in-50 duration-100">
            {/* Header / Search */}
            <div className="p-2 border-b border-[var(--border-subtle)]">
              {organizations.length > 3 && (
                <div className="relative mb-1.5">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Find organization..."
                    className="w-full pl-8 pr-3 py-1 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--brand-primary)]"
                  />
                </div>
              )}
              <div className="px-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Organizations ({organizations.length})
              </div>
            </div>

            {/* Organizations List */}
            <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
              {isNoOrganizations ? (
                <div className="p-3 text-center text-[12px] text-[var(--text-muted)]">
                  You are not a member of any organization.
                </div>
              ) : filteredOrgs.length === 0 ? (
                <div className="p-3 text-center text-[12px] text-[var(--text-muted)]">
                  No organization matching &quot;{search}&quot;
                </div>
              ) : (
                filteredOrgs.map((org) => {
                  const isSelected = org.id === activeOrgId;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        switchOrganization(org.id);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-[var(--radius-button)] text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--bg-surface-selected)] text-[var(--text-primary)] font-medium'
                          : 'hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-bold text-[var(--brand-primary)] shrink-0">
                          {getInitials(org.name)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] truncate max-w-[130px]">{org.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {org.projectCount} {org.projectCount === 1 ? 'project' : 'projects'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {org.role && (
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border uppercase ${getRoleBadgeColor(
                              org.role,
                            )}`}
                          >
                            {org.role}
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-[var(--brand-primary)]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Actions footer */}
            <div className="p-1 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              {activeOrgId && (
                <Link
                  href={`/orgs/${activeOrgId}/settings`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Organization Settings</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsCreateModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--brand-primary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors cursor-pointer font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Organization</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateOrganizationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </>
  );
}

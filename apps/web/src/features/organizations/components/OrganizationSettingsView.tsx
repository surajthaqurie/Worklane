'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  useOrganization,
  useOrgMembers,
  useOrgProjects,
  useUpdateOrganization,
  useAddOrgMember,
  useUpdateOrgMemberRole,
  useRemoveOrgMember,
} from '../hooks/useOrganizations';
import { useAuth } from '@/shared/context/AuthContext';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import type { OrganizationRole } from '../types';
import {
  Users,
  Folder,
  Settings as SettingsIcon,
  UserPlus,
  Trash2,
  Check,
  Loader2,
  Copy,
} from 'lucide-react';

interface OrganizationSettingsViewProps {
  organizationId: string;
}

export function OrganizationSettingsView({ organizationId }: OrganizationSettingsViewProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'settings' | 'members' | 'projects'>('settings');

  // Queries
  const { data: organization, isLoading: isOrgLoading } = useOrganization(organizationId);
  const { data: members = [] } = useOrgMembers(organizationId);
  const { data: projects = [] } = useOrgProjects(organizationId);

  // Mutations
  const updateOrgMutation = useUpdateOrganization(organizationId);
  const addMemberMutation = useAddOrgMember(organizationId);
  const updateRoleMutation = useUpdateOrgMemberRole(organizationId);
  const removeMemberMutation = useRemoveOrgMember(organizationId);

  // Form states
  const [prevOrgId, setPrevOrgId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Sync form when org data loads (pure state adjustment pattern)
  if (organization && organization.id !== prevOrgId) {
    setPrevOrgId(organization.id);
    setName(organization.name);
    setDescription(organization.description || '');
  }

  // Add member modal state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('MEMBER');
  const [addMemberError, setAddMemberError] = useState('');

  // Create project modal state
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const isOwner = organization?.role === 'OWNER';
  const isAdmin = organization?.role === 'ADMIN' || isOwner;

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaveError('');
      setSaveSuccess(false);
      await updateOrgMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setSaveError(errorObj?.message || 'Failed to update organization');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setAddMemberError('');
      await addMemberMutation.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail('');
      setInviteRole('MEMBER');
      setIsAddMemberOpen(false);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setAddMemberError(errorObj?.message || 'Failed to add member');
    }
  };

  const handleRoleChange = async (memberUserId: string, newRole: OrganizationRole) => {
    try {
      await updateRoleMutation.mutateAsync({ userId: memberUserId, role: newRole });
    } catch (err: unknown) {
      const errorObj = err as Error;
      alert(errorObj?.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    const isSelf = memberUserId === user?.id;
    const confirmMsg = isSelf
      ? 'Are you sure you want to leave this organization?'
      : `Are you sure you want to remove ${memberName} from this organization?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await removeMemberMutation.mutateAsync(memberUserId);
    } catch (err: unknown) {
      const errorObj = err as Error;
      alert(errorObj?.message || 'Failed to remove member');
    }
  };

  if (isOrgLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)]">
        Organization not found.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[var(--border-subtle)] gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[var(--radius-button)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold text-lg">
              {organization.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-bold text-[var(--text-primary)]">
                  {organization.name}
                </h1>
                {organization.role && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase bg-[var(--bg-surface-selected)] text-[var(--brand-primary)] border-[var(--border-subtle)]">
                    {organization.role}
                  </span>
                )}
              </div>
              <p className="text-[13px] text-[var(--text-secondary)]">
                Organization Settings & Management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/orgs/${organizationId}/projects`}
            className="px-3.5 py-1.5 text-[13px] font-medium border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] text-[var(--text-primary)] transition-colors shadow-xs"
          >
            Back to Projects
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-subtle)] space-x-6 text-[14px]">
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`pb-3 font-medium transition-colors flex items-center gap-2 cursor-pointer border-b-2 -mb-px ${
            activeTab === 'settings'
              ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>General Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`pb-3 font-medium transition-colors flex items-center gap-2 cursor-pointer border-b-2 -mb-px ${
            activeTab === 'members'
              ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Members & Roles ({members.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`pb-3 font-medium transition-colors flex items-center gap-2 cursor-pointer border-b-2 -mb-px ${
            activeTab === 'projects'
              ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>Projects ({projects.length})</span>
        </button>
      </div>

      {/* TAB 1: General Settings */}
      {activeTab === 'settings' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6 space-y-6 shadow-xs">
          <form onSubmit={handleSaveGeneral} className="space-y-4 max-w-xl">
            {saveSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[13px] rounded-[var(--radius-button)] flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Organization settings updated successfully.</span>
              </div>
            )}

            {saveError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[13px] rounded-[var(--radius-button)]">
                {saveError}
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Organization Name
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] disabled:opacity-60 text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--brand-primary)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Description
              </label>
              <textarea
                rows={3}
                disabled={!isAdmin}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A description of this organization..."
                className="w-full px-3 py-2 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] disabled:opacity-60 text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--brand-primary)] resize-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Organization ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={organization.id}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] font-mono text-[var(--text-secondary)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(organization.id);
                  }}
                  title="Copy ID"
                  className="p-2 border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Created
              </label>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {new Date(organization.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {isAdmin && (
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={updateOrgMutation.isPending || !name.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-xs cursor-pointer"
                >
                  {updateOrgMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: Members & Roles */}
      {activeTab === 'members' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                Organization Members
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Manage who has access to this organization and their governance roles
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Member</span>
              </button>
            )}
          </div>

          {/* Members Table */}
          <div className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[12px] font-semibold text-[var(--text-muted)]">
                  <th className="py-2.5 px-4">Member</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Joined</th>
                  {isAdmin && <th className="py-2.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
                {members.map((m) => {
                  const isCurrent = m.userId === user?.id;
                  return (
                    <tr key={m.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-selected)] text-[var(--brand-primary)] flex items-center justify-center font-bold text-[11px] border border-[var(--border-subtle)]">
                            {m.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-[var(--text-primary)]">
                            {m.name} {isCurrent && <span className="text-[11px] text-[var(--text-muted)]">(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">{m.email}</td>
                      <td className="py-3 px-4">
                        {isOwner ? (
                          <select
                            value={m.role}
                            onChange={(e) =>
                              handleRoleChange(m.userId, e.target.value as OrganizationRole)
                            }
                            className="px-2 py-1 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)] focus:outline-hidden"
                          >
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                            <option value="OWNER">Owner</option>
                          </select>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded border uppercase bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border-[var(--border-subtle)]">
                            {m.role}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)] text-[12px]">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          {(isOwner || (!isOwner && m.role === 'MEMBER')) && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.userId, m.name)}
                              title={isCurrent ? 'Leave organization' : 'Remove member'}
                              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-[var(--radius-button)] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Projects */}
      {activeTab === 'projects' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                Organization Projects
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                All projects and work trackers configured under this organization
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateProjectOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
            >
              <Folder className="w-4 h-4" />
              <span>+ New Project</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => (
              <Link
                key={proj.id}
                href={`/orgs/${organizationId}/projects/${proj.id}`}
                className="p-4 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] hover:border-[var(--brand-primary)] hover:bg-[var(--bg-surface-hover)] transition-all flex flex-col justify-between group shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-surface-selected)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                      {proj.key}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {new Date(proj.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors mb-1">
                    {proj.name}
                  </h3>
                  <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2">
                    {proj.description || 'No description.'}
                  </p>
                </div>
              </Link>
            ))}

            {projects.length === 0 && (
              <div className="col-span-full p-8 text-center border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-card)] text-[var(--text-secondary)]">
                No projects yet in this organization. Create one to get started!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
              Add Organization Member
            </h3>

            {addMemberError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 text-[13px] rounded-[var(--radius-button)]">
                {addMemberError}
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  User Email or User ID
                </label>
                <input
                  type="text"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--brand-primary)]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-[var(--text-primary)] focus:outline-hidden"
                >
                  <option value="MEMBER">Member (can participate in projects)</option>
                  <option value="ADMIN">Admin (can manage members & settings)</option>
                  {isOwner && <option value="OWNER">Owner (full governance access)</option>}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-3.5 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending || !inviteEmail.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:opacity-90 disabled:opacity-50"
                >
                  {addMemberMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Project Dialog */}
      <CreateProjectDialog
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        defaultOrganizationId={organizationId}
      />
    </div>
  );
}

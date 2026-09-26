'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useTeamMembers,
  useAddTeamMember,
  useUpdateTeamMemberRole,
  useRemoveTeamMember,
  useTeamSettings,
  useUpdateTeamSettings,
} from '@/features/teams';
import { useAreas, useProjectMembers } from '@/features/projects';
import { useIterations } from '@/features/iterations';
import { Team, TeamRole, TeamMember, TeamSettings, Iteration } from '@/shared/types';
import { Users, Plus, ShieldCheck, UserCircle2, Trash2, Save, X, Check } from 'lucide-react';
import { ConfirmationDialog } from '@/components/feedback/ConfirmationDialog';
import { useDisclosure } from '@/shared/hooks/useDisclosure';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { AccessDenied } from '@/features/authorization/components/AccessDenied';

export default function TeamSettingsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { can } = useProjectContext();

  const { data: teams = [], isLoading: teamsLoading } = useTeams(projectId);
  const [pickedTeamId, setPickedTeamId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const selectedTeamId = pickedTeamId ?? teams[0]?.id ?? null;
  const selectedTeam = teams.find((t: Team) => t.id === selectedTeamId) ?? null;
  const createTeam = useCreateTeam(projectId);

  if (!can('project:manage_teams')) {
    return (
      <AccessDenied
        title="Team Management Required"
        message="You do not have permission to manage teams for this project."
        backHref={`/projects/${projectId}`}
      />
    );
  }

  const handleCreate = () => {
    if (!newTeamName.trim()) return;
    createTeam.mutate(
      { name: newTeamName.trim() },
      {
        onSuccess: (team: Team) => {
          setNewTeamName('');
          setShowCreate(false);
          setPickedTeamId(team.id);
        },
      },
    );
  };

  return (
    <div className="p-6 max-w-6xl w-full">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] text-[var(--brand-primary)] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Teams</h1>
        </div>
        <p className="text-[14px] text-[var(--text-secondary)]">
          Teams let you group project members and scope boards, backlogs, and sprints to a subset of work.
        </p>
      </div>

      {teamsLoading ? (
        <div className="text-[13px] text-[var(--text-muted)]">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="max-w-xl border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-8 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">No teams yet</h2>
          <p className="text-[13px] text-[var(--text-secondary)] mb-5">
            Create your first team to start scoping work to a group of members.
          </p>
          {showCreate ? (
            <div className="flex items-center justify-center gap-2">
              <input
                autoFocus
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
                placeholder="Team name"
                className="px-3 py-2 text-[13px] border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
              />
              <button
                onClick={handleCreate}
                disabled={createTeam.isPending}
                className="px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] disabled:opacity-50 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
            >
              <Plus className="w-4 h-4" /> New Team
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] text-[var(--text-secondary)]">
              {teams.length} {teams.length === 1 ? 'team' : 'teams'}{' '}
              {teams.some((t: Team) => t.userRole === 'ADMIN') ? '· you administer at least one' : ''}
            </div>
            {showCreate ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                  placeholder="Team name"
                  className="px-3 py-1.5 text-[13px] border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                />
                <button
                  onClick={handleCreate}
                  disabled={createTeam.isPending}
                  className="px-3 py-1.5 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] disabled:opacity-50 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  aria-label="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New Team
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-start">
            <TeamList
              teams={teams}
              selectedTeamId={selectedTeamId}
              onSelect={setPickedTeamId}
            />
            {selectedTeam ? (
              <TeamDetail projectId={projectId} team={selectedTeam} />
            ) : (
              <div className="text-[13px] text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-8 text-center">
                Select a team to manage it.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Team list (left column) ─────────────────────────────────────────────────

function TeamList({
  teams,
  selectedTeamId,
  onSelect,
}: {
  teams: Team[];
  selectedTeamId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] overflow-hidden">
      {teams.map((team) => {
        const active = team.id === selectedTeamId;
        return (
          <button
            key={team.id}
            onClick={() => onSelect(team.id)}
            className={`w-full flex flex-col items-start gap-0.5 px-4 py-3 text-left border-b border-[var(--border-subtle)] last:border-b-0 transition-colors ${
              active
                ? 'bg-[var(--bg-surface-selected)]'
                : 'hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <span
              className={`text-[14px] font-medium ${
                active ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]'
              }`}
            >
              {team.name}
            </span>
            <span className="text-[12px] text-[var(--text-secondary)]">
              {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
            </span>
            {team.userRole && (
              <span className="mt-1 text-[11px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]">
                {team.userRole === 'ADMIN' ? <ShieldCheck className="w-3 h-3" /> : <UserCircle2 className="w-3 h-3" />}
                {team.userRole === 'ADMIN' ? 'Admin' : 'Member'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Team detail (right column) ─────────────────────────────────────────────

function TeamDetail({ projectId, team }: { projectId: string; team: Team }) {
  const isAdmin = team.userRole === 'ADMIN';

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {!isAdmin && (
        <div className="text-[13px] px-4 py-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]">
          You are not a member of this team, so you can view it but not modify it. Ask a team admin for access.
        </div>
      )}

      <TeamInfoCard key={team.id} projectId={projectId} team={team} canEdit={isAdmin} />
      <MembersCard projectId={projectId} teamId={team.id} canEdit={isAdmin} />
      <ScopeCard projectId={projectId} team={team} canEdit={isAdmin} />
      {isAdmin && <DangerCard projectId={projectId} team={team} />}
    </div>
  );
}

function TeamInfoCard({
  projectId,
  team,
  canEdit,
}: {
  projectId: string;
  team: Team;
  canEdit: boolean;
}) {
  const updateTeam = useUpdateTeam(projectId);
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [dirty, setDirty] = useState(false);

  const save = () => {
    updateTeam.mutate(
      { teamId: team.id, data: { name: name.trim() || team.name, description: description.trim() || null } },
      { onSuccess: () => setDirty(false) },
    );
  };

  return (
    <section className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-5">
      <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Team details</h2>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">Name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            disabled={!canEdit}
            className="w-full max-w-sm px-3 py-2 text-[13px] border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors disabled:opacity-60"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">Description</label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setDirty(true);
            }}
            disabled={!canEdit}
            rows={2}
            className="w-full max-w-lg px-3 py-2 text-[13px] border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors disabled:opacity-60"
          />
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={!dirty || updateTeam.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> {updateTeam.isPending ? 'Saving...' : 'Save'}
            </button>
            {updateTeam.isError && (
              <span className="text-[12px] text-[var(--priority-high)]">
                {(updateTeam.error as Error).message}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MembersCard({
  projectId,
  teamId,
  canEdit,
}: {
  projectId: string;
  teamId: string;
  canEdit: boolean;
}) {
  const { data: members = [], isLoading } = useTeamMembers(projectId, teamId);
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const addMember = useAddTeamMember(projectId, teamId);
  const updateRole = useUpdateTeamMemberRole(projectId, teamId);
  const removeMember = useRemoveTeamMember(projectId, teamId);

  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<TeamRole>('MEMBER');
  const removeDialog = useDisclosure();
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const existingIds = useMemo(() => new Set(members.map((m: TeamMember) => m.userId)), [members]);
  const candidates = (projectMembers as ProjectMemberLite[]).filter(
    (m: ProjectMemberLite) => !existingIds.has(m.userId),
  );

  const handleAdd = () => {
    if (!newUserId) return;
    addMember.mutate(
      { userId: newUserId, role: newRole },
      { onSuccess: () => setNewUserId('') },
    );
  };

  const handlePromptRemove = (m: TeamMember) => {
    setMemberToRemove(m);
    removeDialog.onOpen();
  };

  const confirmRemoveMember = () => {
    if (memberToRemove) {
      removeMember.mutate(memberToRemove.userId);
      setMemberToRemove(null);
    }
    removeDialog.onClose();
  };

  return (
    <section className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-5">
      <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">
        Members · <span className="text-[var(--text-secondary)] font-medium">{members.length}</span>
      </h2>

      {isLoading ? (
        <div className="text-[13px] text-[var(--text-muted)]">Loading members...</div>
      ) : (
        <div className="flex flex-col">
          {members.map((m: TeamMember) => (
            <div
              key={m.userId}
              className="flex items-center gap-3 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[11px] text-[var(--text-primary)]">
                {m.name ? m.name.slice(0, 2).toUpperCase() : '??'}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{m.name}</span>
                <span className="text-[12px] text-[var(--text-secondary)] truncate">{m.email}</span>
              </div>
              {canEdit ? (
                <div className="flex items-center gap-1.5">
                  <select
                    value={m.role}
                    onChange={(e) =>
                      updateRole.mutate({ userId: m.userId, role: e.target.value as TeamRole })
                    }
                    disabled={updateRole.isPending}
                    className="border border-[var(--border-subtle)] rounded-[var(--radius-input)] px-2 py-1 text-[12px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button
                    onClick={() => handlePromptRemove(m)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--priority-high)] rounded-[var(--radius-button)] transition-colors"
                    aria-label="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <span className="text-[11px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]">
                  <ShieldCheck className="w-3 h-3" />
                  {m.role === 'ADMIN' ? 'Admin' : 'Member'}
                </span>
              )}
            </div>
          ))}

          {canEdit && (
            <div className="flex items-center gap-2 mt-3">
              <select
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                className="flex-1 max-w-xs px-3 py-1.5 text-[13px] border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
              >
                <option value="">Add a project member...</option>
                {candidates.map((m: ProjectMemberLite) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name || m.email || m.userId}
                  </option>
                ))}
              </select>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as TeamRole)}
                className="px-2 py-1.5 text-[13px] border border-[var(--border-subtle)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)]"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button
                onClick={handleAdd}
                disabled={!newUserId || addMember.isPending}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-selected)] text-[var(--text-primary)] text-[13px] font-medium rounded-[var(--radius-button)] disabled:opacity-50 transition-colors border border-[var(--border-subtle)]"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          )}

          {(addMember.isError || updateRole.isError || removeMember.isError) && (
            <p className="mt-2 text-[12px] text-[var(--priority-high)]">
              {(addMember.error?.message || updateRole.error?.message || removeMember.error?.message) as string}
            </p>
          )}

          <ConfirmationDialog
            isOpen={removeDialog.isOpen}
            onClose={removeDialog.onClose}
            onConfirm={confirmRemoveMember}
            title="Remove Team Member"
            description={memberToRemove ? `Remove ${memberToRemove.name ?? 'this member'} from the team?` : ''}
            confirmText="Remove"
            variant="danger"
            isLoading={removeMember.isPending}
          />
        </div>
      )}
    </section>
  );
}

type ProjectMemberLite = { userId: string; name?: string; email?: string; avatarUrl?: string | null };
type AreaLite = { id: string; name: string };

function ScopeCard({
  projectId,
  team,
  canEdit,
}: {
  projectId: string;
  team: Team;
  canEdit: boolean;
}) {
  const { data: settings, isLoading } = useTeamSettings(projectId, team.id);
  const { data: areaRows = [] } = useAreas(projectId);
  const { data: iterations = [] } = useIterations(projectId);
  const areas = areaRows as AreaLite[];

  if (isLoading || !settings) {
    return (
      <section className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-5">
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Scope</h2>
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">Loading...</p>
      </section>
    );
  }

  return (
    <ScopeForm
      key={team.id}
      projectId={projectId}
      teamId={team.id}
      settings={settings}
      areas={areas}
      iterations={iterations}
      canEdit={canEdit}
    />
  );
}

function ScopeForm({
  projectId,
  teamId,
  settings,
  areas,
  iterations,
  canEdit,
}: {
  projectId: string;
  teamId: string;
  settings: TeamSettings;
  areas: AreaLite[];
  iterations: Iteration[];
  canEdit: boolean;
}) {
  const updateSettings = useUpdateTeamSettings(projectId, teamId);

  const [defaultIterationId, setDefaultIterationId] = useState<string | null>(
    settings.defaultIterationId ?? null,
  );
  const [defaultAreaId, setDefaultAreaId] = useState<string | null>(settings.defaultAreaId ?? null);
  const [areaIds, setAreaIds] = useState<string[]>(settings.areas ?? []);
  const [iterationIds, setIterationIds] = useState<string[]>(settings.iterations ?? []);
  const [dirty, setDirty] = useState(false);

  const toggle = (id: string, list: string[], updater: (next: string[]) => void) => {
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    updater(next);
    setDirty(true);
  };

  const save = () => {
    updateSettings.mutate(
      { defaultIterationId, defaultAreaId, areaIds, iterationIds },
      { onSuccess: () => setDirty(false) },
    );
  };

  return (
    <section className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-5">
      <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Scope</h2>
      <p className="text-[12px] text-[var(--text-secondary)] mb-4">
        The team&apos;s boards, backlogs, and sprints only show work in the selected areas and
        iterations.
        {areaIds.length === 0 && iterationIds.length === 0
          ? ' With nothing selected the team sees all project work.'
          : ''}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">Default area for new items</label>
            <select
              value={defaultAreaId ?? ''}
              onChange={(e) => {
                setDefaultAreaId(e.target.value || null);
                setDirty(true);
              }}
              disabled={!canEdit}
              className="w-full px-3 py-1.5 text-[13px] border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] disabled:opacity-60"
            >
              <option value="">None</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">
              Areas ({areaIds.length} of {areas.length})
            </label>
            <div className="border border-[var(--border-subtle)] rounded-[var(--radius-input)] p-2 max-h-48 overflow-y-auto flex flex-col gap-1">
              {areas.length === 0 && (
                <span className="text-[12px] text-[var(--text-muted)] px-2 py-1">No areas in this project.</span>
              )}
              {areas.map((a) => {
                const checked = areaIds.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-[13px] cursor-pointer transition-colors ${
                      checked ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canEdit}
                      onChange={() => toggle(a.id, areaIds, setAreaIds)}
                      className="accent-[var(--brand-primary)]"
                    />
                    {a.name}
                    {checked && <Check className="w-3.5 h-3.5 ml-auto" />}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">
              Default iteration for new items
            </label>
            <select
              value={defaultIterationId ?? ''}
              onChange={(e) => {
                setDefaultIterationId(e.target.value || null);
                setDirty(true);
              }}
              disabled={!canEdit}
              className="w-full px-3 py-1.5 text-[13px] border border-[var(--border-default)] rounded-[var(--radius-input)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] disabled:opacity-60"
            >
              <option value="">None</option>
              {iterations.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">
              Iterations ({iterationIds.length} of {iterations.length})
            </label>
            <div className="border border-[var(--border-subtle)] rounded-[var(--radius-input)] p-2 max-h-48 overflow-y-auto flex flex-col gap-1">
              {iterations.length === 0 && (
                <span className="text-[12px] text-[var(--text-muted)] px-2 py-1">No iterations in this project.</span>
              )}
              {iterations.map((it) => {
                const checked = iterationIds.includes(it.id);
                return (
                  <label
                    key={it.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-[13px] cursor-pointer transition-colors ${
                      checked ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canEdit}
                      onChange={() => toggle(it.id, iterationIds, setIterationIds)}
                      className="accent-[var(--brand-primary)]"
                    />
                    {it.name}
                    {checked && <Check className="w-3.5 h-3.5 ml-auto" />}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={save}
            disabled={!dirty || updateSettings.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" /> {updateSettings.isPending ? 'Saving...' : 'Save scope'}
          </button>
          {updateSettings.isError && (
            <span className="text-[12px] text-[var(--priority-high)]">
              {(updateSettings.error as Error).message}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function DangerCard({ projectId, team }: { projectId: string; team: Team }) {
  const deleteTeam = useDeleteTeam(projectId);
  const deleteDialog = useDisclosure();

  const confirmDeleteTeam = () => {
    deleteTeam.mutate(team.id);
    deleteDialog.onClose();
  };

  return (
    <section className="border border-[var(--priority-high)]/30 rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-5">
      <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Delete team</h2>
      <p className="text-[12px] text-[var(--text-secondary)] mb-4">
        Deleting a team removes its members and scope configuration. Work items are not deleted.
      </p>
      <button
        onClick={() => deleteDialog.onOpen()}
        disabled={deleteTeam.isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--priority-high)]/10 hover:bg-[var(--priority-high)]/20 text-[var(--priority-high)] text-[13px] font-medium rounded-[var(--radius-button)] disabled:opacity-50 transition-colors border border-[var(--priority-high)]/30"
      >
        <Trash2 className="w-3.5 h-3.5" /> {deleteTeam.isPending ? 'Deleting...' : 'Delete team'}
      </button>
      {deleteTeam.isError && (
        <span className="ml-3 text-[12px] text-[var(--priority-high)]">
          {(deleteTeam.error as Error).message}
        </span>
      )}

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={deleteDialog.onClose}
        onConfirm={confirmDeleteTeam}
        title="Delete Team"
        description={`Delete team "${team.name}"? This removes all members and scope configuration. Work items are not deleted. This cannot be undone.`}
        confirmText="Delete Team"
        variant="danger"
        isLoading={deleteTeam.isPending}
      />
    </section>
  );
}
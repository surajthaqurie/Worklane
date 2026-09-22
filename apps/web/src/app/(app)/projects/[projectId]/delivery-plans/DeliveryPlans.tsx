'use client';

import React, { useMemo, useState } from 'react';
import { CalendarRange, Plus, Pencil, Trash2, Users } from 'lucide-react';
import {
  useDeliveryPlans,
  useDeliveryPlanTimeline,
  useDeliveryPlanTeams,
  useCreateDeliveryPlan,
  useUpdateDeliveryPlan,
  useDeleteDeliveryPlan,
  useSetPlanTeams,
} from '@/features/delivery-plans/hooks/useDeliveryPlans';
import { DeliveryPlanTimeline as DeliveryPlanTimelineView } from '@/features/delivery-plans/components/DeliveryPlanTimeline';
import { DependencyPanel } from '@/features/delivery-plans/components/DependencyPanel';
import {
  DeliveryPlan,
  TimelineQueryParams,
  TimelineWorkItem,
} from '@/shared/types/delivery-plans';
import { WorkItem } from '@/shared/types/work-items';
import { WorkItemDrawer } from '@/features/work-items/components/WorkItemDrawer';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { useProjectPermissions } from '@/shared/hooks/useProjectPermissions';
import { Modal, EmptyState, ErrorState, LoadingScreen, Spinner } from '@/shared/components/ui';

const INITIAL_LIMIT = 300;
const LIMIT_STEP = 300;
const LIMIT_MAX = 500;

/**
 * Timeline items are lean API rows (no description/created dates/etc). The
 * drawer only uses `item.id` to pre-fetch the full row via `useWorkItemDetail`,
 * so a mapped skeleton is safe — the moment the detail query resolves it
 * replaces this object entirely.
 */
function toDrawerWorkItem(item: TimelineWorkItem): WorkItem {
  const fallback = item.completedAt ?? new Date(0).toISOString();
  return {
    id: item.id,
    key: item.key,
    projectId: item.projectId,
    type: item.type as WorkItem['type'],
    title: item.title,
    description: null,
    state: item.state,
    priority: item.priority as WorkItem['priority'],
    points: item.points,
    startDate: item.startDate ?? undefined,
    targetDate: item.targetDate ?? undefined,
    assignedTo: item.assignedTo,
    assignedToName: item.assignedToName ?? undefined,
    assignedToAvatar: item.assignedToAvatar ?? undefined,
    createdBy: '',
    createdAt: fallback,
    updatedAt: fallback,
    completedAt: item.completedAt,
    parentId: item.parentId,
    iterationId: item.iterationId,
    areaId: item.areaId,
    backlogRank: item.backlogRank,
  };
}

// ─── Plan create / edit modal ────────────────────────────────────────────────

function PlanFormModal({
  projectId,
  plan,
  onCreated,
  onClose,
}: {
  projectId: string;
  /** null = create a new plan. */
  plan: DeliveryPlan | null;
  onCreated: (plan: DeliveryPlan) => void;
  onClose: () => void;
}) {
  const createPlan = useCreateDeliveryPlan(projectId);
  const updatePlan = useUpdateDeliveryPlan(projectId);
  const { data: projectTeams = [], isLoading: teamsLoading } = useTeams(projectId);
  const { data: planTeams = [] } = useDeliveryPlanTeams(projectId, plan?.id ?? '');

  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  // null → selection still derived from the plan's current teams (edit).
  const [teamIds, setTeamIds] = useState<string[] | null>(null);
  const effectiveTeamIds = teamIds ?? (plan ? planTeams.map((t) => t.id) : []);

  const saving = createPlan.isPending || updatePlan.isPending;
  const canSave = name.trim().length > 0 && !saving;

  const toggleTeam = (id: string, checked: boolean) => {
    setTeamIds((prev) => {
      const base = prev ?? (plan ? planTeams.map((t) => t.id) : []);
      return checked ? [...base, id] : base.filter((x) => x !== id);
    });
  };

  const handleSave = () => {
    if (!canSave) return;
    const data = {
      name: name.trim(),
      description: description.trim() || null,
      teamIds: effectiveTeamIds,
    };
    if (plan) {
      updatePlan.mutate({ planId: plan.id, data }, { onSuccess: () => onClose() });
    } else {
      createPlan.mutate(data, {
        onSuccess: (created) => {
          onCreated(created);
          onClose();
        },
      });
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={plan ? `Edit "${plan.name}"` : 'Create delivery plan'}
      maxWidthClass="max-w-md"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-button)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : plan ? 'Save changes' : 'Create plan'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-[var(--text-muted)]">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q4 Platform Delivery"
            autoFocus
            className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-[var(--text-muted)]">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — what does this plan deliver?"
            rows={3}
            className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] resize-y"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[var(--text-muted)]">
            Teams on this plan
          </label>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-2">
            {teamsLoading ? (
              <div className="flex justify-center py-2">
                <Spinner size="sm" />
              </div>
            ) : projectTeams.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic px-1 py-1">
                No teams in this project yet — create teams in Project Settings &gt; Teams.
              </p>
            ) : (
              projectTeams.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-xs text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={effectiveTeamIds.includes(t.id)}
                    onChange={(e) => toggleTeam(t.id, e.target.checked)}
                    className="rounded border-[var(--border-default)] accent-[var(--brand-primary)]"
                  />
                  <span className="truncate">{t.name}</span>
                  {typeof t.memberCount === 'number' && (
                    <span className="ml-auto shrink-0 text-[10px] text-[var(--text-muted)]">
                      {t.memberCount}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Manage teams modal (existing plan) ──────────────────────────────────────

function PlanTeamsModal({
  projectId,
  plan,
  onClose,
}: {
  projectId: string;
  plan: DeliveryPlan;
  onClose: () => void;
}) {
  const { data: planTeams = [], isLoading } = useDeliveryPlanTeams(projectId, plan.id);
  const { data: projectTeams = [], isLoading: teamsLoading } = useTeams(projectId);
  const setTeams = useSetPlanTeams(projectId);

  const [selected, setSelected] = useState<string[] | null>(null);
  const effective = selected ?? planTeams.map((t) => t.id);

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const base = prev ?? planTeams.map((t) => t.id);
      return checked ? [...base, id] : base.filter((x) => x !== id);
    });
  };

  const handleSave = () => {
    setTeams.mutate({ planId: plan.id, data: { teamIds: effective } }, { onSuccess: () => onClose() });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Manage teams · ${plan.name}`}
      maxWidthClass="max-w-md"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-button)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={setTeams.isPending}
            className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {setTeams.isPending ? 'Saving…' : 'Save teams'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-[11px] text-[var(--text-muted)]">
          Teams scope the timeline. You only see teams you&apos;re a member of.
        </p>
        {isLoading || teamsLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : projectTeams.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] italic">No teams in this project yet.</p>
        ) : (
          <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
            {projectTeams.map((t) => {
              const planTeam = planTeams.find((pt) => pt.id === t.id);
              return (
                <label
                  key={t.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-xs text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={effective.includes(t.id)}
                    onChange={(e) => toggle(t.id, e.target.checked)}
                    className="rounded border-[var(--border-default)] accent-[var(--brand-primary)]"
                  />
                  <span className="truncate">{t.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-[var(--text-muted)]">
                    {planTeam?.memberCount ?? t.memberCount ?? 0} members
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type PlanModalState = { mode: 'create' } | { mode: 'edit'; plan: DeliveryPlan } | null;

export function DeliveryPlans({ projectId }: { projectId: string }) {
  const {
    data: plans = [],
    isLoading: plansLoading,
    isError: plansError,
    error: plansErrorObj,
    refetch: refetchPlans,
  } = useDeliveryPlans(projectId);
  const { can } = useProjectPermissions(projectId);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const [planModal, setPlanModal] = useState<PlanModalState>(null);
  const [manageTeamsPlan, setManageTeamsPlan] = useState<DeliveryPlan | null>(null);
  const [depsItem, setDepsItem] = useState<TimelineWorkItem | null>(null);
  const [drawerItem, setDrawerItem] = useState<WorkItem | null>(null);

  const deletePlan = useDeleteDeliveryPlan(projectId);

  // Fall back to the first plan when the selection is stale (deleted/absent).
  const effectivePlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null,
    [plans, selectedPlanId],
  );

  const timelineParams = useMemo<TimelineQueryParams>(
    () => ({ ...(teamFilter ? { teamId: teamFilter } : {}), limit }),
    [teamFilter, limit],
  );

  const timelineQuery = useDeliveryPlanTimeline(projectId, effectivePlan?.id ?? '', timelineParams);

  const canCreate = can('delivery_plan:create');
  const canEdit = can('delivery_plan:edit');
  const canDelete = can('delivery_plan:delete');

  const handleSelectPlan = (plan: DeliveryPlan) => {
    setSelectedPlanId(plan.id);
    setTeamFilter(null);
    setLimit(INITIAL_LIMIT);
  };

  const handleDelete = (plan: DeliveryPlan) => {
    if (!confirm(`Delete delivery plan "${plan.name}"? This cannot be undone.`)) return;
    deletePlan.mutate(plan.id, { onSuccess: () => setSelectedPlanId(null) });
  };

  const openDependencyPanel = (item: TimelineWorkItem) => setDepsItem(item);

  const openDetails = (item: TimelineWorkItem) => {
    setDepsItem(null);
    setDrawerItem(toDrawerWorkItem(item));
  };

  // ─── Whole-page loading / error / empty ─────────────────────────────────

  if (plansLoading) {
    return <LoadingScreen message="Loading delivery plans..." />;
  }

  if (plansError && plans.length === 0) {
    return (
      <ErrorState
        error={plansErrorObj}
        title="Failed to load delivery plans"
        onRetry={() => refetchPlans()}
      />
    );
  }

  if (plans.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<CalendarRange className="w-6 h-6" />}
          title="No delivery plans yet"
          description="Create a delivery plan to aggregate teams, iterations, and work items onto one cross-team timeline."
          action={
            canCreate ? (
              <button
                onClick={() => setPlanModal({ mode: 'create' })}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create delivery plan
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[600px] gap-6 p-6">
      {/* ── Sidebar: plans list ─────────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col gap-4 border-r border-[var(--border-subtle)] pr-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Delivery Plans</h2>
          {canCreate && (
            <button
              onClick={() => setPlanModal({ mode: 'create' })}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-colors"
              title="New plan"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1 overflow-y-auto">
          {plans.map((plan) => {
            const active = plan.id === effectivePlan?.id;
            return (
              <div
                key={plan.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectPlan(plan)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectPlan(plan);
                  }
                }}
                className={`flex items-center py-2 px-3 text-xs rounded-[var(--radius-button)] cursor-pointer transition-colors text-left ${
                  active
                    ? 'bg-[var(--bg-surface-selected)] text-[var(--brand-primary)] font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate">{plan.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-normal">
                    {plan.teamCount} team(s) · {plan.userTeamCount} on yours
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main: selected plan + timeline ──────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">
        {effectivePlan && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarRange className="w-5 h-5 text-[var(--brand-primary)] shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {effectivePlan.name}
                  </h2>
                  {effectivePlan.description && (
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {effectivePlan.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {canEdit && (
                  <button
                    onClick={() => setManageTeamsPlan(effectivePlan)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Teams
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => setPlanModal({ mode: 'edit', plan: effectivePlan })}
                    className="p-1.5 text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] hover:text-[var(--text-primary)] transition-colors"
                    title="Edit plan"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(effectivePlan)}
                    className="p-1.5 text-rose-500 border border-[var(--border-subtle)] rounded-[var(--radius-button)] hover:bg-rose-500/10 transition-colors"
                    title="Delete plan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <DeliveryPlanTimelineView
              timeline={timelineQuery.data}
              isLoading={timelineQuery.isLoading}
              isError={timelineQuery.isError}
              error={timelineQuery.error}
              onRetry={() => timelineQuery.refetch()}
              teamId={teamFilter}
              onTeamFilterChange={setTeamFilter}
              onLoadMore={() => setLimit((l) => Math.min(l + LIMIT_STEP, LIMIT_MAX))}
              onSelectItem={openDetails}
              onOpenDependencies={openDependencyPanel}
            />
          </>
        )}
      </div>

      {/* ── Drawers & modals ────────────────────────────────────────────── */}
      {depsItem && (
        <DependencyPanel
          projectId={projectId}
          item={depsItem}
          candidates={timelineQuery.data?.workItems ?? []}
          onClose={() => setDepsItem(null)}
          onOpenDetails={openDetails}
        />
      )}

      {drawerItem && (
        <WorkItemDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />
      )}

      {planModal && (
        <PlanFormModal
          projectId={projectId}
          plan={planModal.mode === 'edit' ? planModal.plan : null}
          onCreated={(created) => setSelectedPlanId(created.id)}
          onClose={() => setPlanModal(null)}
        />
      )}

      {manageTeamsPlan && (
        <PlanTeamsModal
          projectId={projectId}
          plan={manageTeamsPlan}
          onClose={() => setManageTeamsPlan(null)}
        />
      )}
    </div>
  );
}
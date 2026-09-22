'use client';

import React, { useMemo, useState } from 'react';
import { Link2, Plus, Trash2, ArrowRight, ArrowLeft, ExternalLink, GitBranch } from 'lucide-react';
import {
  TimelineWorkItem,
  WorkItemLink,
  WorkItemLinkType,
} from '@/shared/types/delivery-plans';
import {
  useDependencies,
  useCreateDependency,
  useRemoveDependency,
} from '../hooks/useDeliveryPlans';
import { Modal } from '@/shared/components/ui/Modal';
import { Spinner } from '@/shared/components/ui/Spinner';

export interface DependencyPanelProps {
  projectId: string;
  /** The work item whose dependencies are being managed. */
  item: TimelineWorkItem;
  /** The timeline's work items, used as the pool of linkable candidates. */
  candidates: TimelineWorkItem[];
  onClose: () => void;
  /** Open another item (from the candidates pool) in the drawer. */
  onOpenDetails: (item: TimelineWorkItem) => void;
}

function linkTypeBadge(type: WorkItemLinkType) {
  return type === 'DEPENDS_ON' ? (
    <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 text-[var(--brand-primary)] text-[10px] font-semibold">
      <GitBranch className="w-2.5 h-2.5" />
      depends on
    </span>
  ) : (
    <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[10px] font-semibold">
      <Link2 className="w-2.5 h-2.5" />
      related
    </span>
  );
}

export function DependencyPanel({
  projectId,
  item,
  candidates,
  onClose,
  onOpenDetails,
}: DependencyPanelProps) {
  const { data: links, isLoading } = useDependencies(projectId, item.id);
  const createDep = useCreateDependency(projectId);
  const removeDep = useRemoveDependency(projectId);

  const [targetId, setTargetId] = useState('');
  const [linkType, setLinkType] = useState<WorkItemLinkType>('DEPENDS_ON');

  // Index of the timeline candidates by id so we can resolve keys → titles.
  const candidateById = useMemo(() => {
    const map = new Map<string, TimelineWorkItem>();
    for (const c of candidates) map.set(c.id, c);
    return map;
  }, [candidates]);

  // A candidate cannot be linked if it's already linked in either direction.
  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of links?.outgoing ?? []) ids.add(l.targetWorkItemId);
    for (const l of links?.incoming ?? []) ids.add(l.sourceWorkItemId);
    return ids;
  }, [links]);

  const available = useMemo(
    () => candidates.filter((c) => c.id !== item.id && !linkedIds.has(c.id)),
    [candidates, item.id, linkedIds],
  );

  const handleAdd = () => {
    if (!targetId) return;
    createDep.mutate(
      {
        workItemId: item.id,
        data: { targetWorkItemId: targetId, linkType },
      },
      {
        onSuccess: () => {
          setTargetId('');
          setLinkType('DEPENDS_ON');
        },
      },
    );
  };

  const handleRemoveOutgoing = (link: WorkItemLink) => {
    removeDep.mutate({ workItemId: item.id, targetWorkItemId: link.targetWorkItemId });
  };

  const handleRemoveIncoming = (link: WorkItemLink) => {
    // Incoming edges belong to their source item; remove there so the
    // source-item cache (and the timeline) is invalidated correctly.
    removeDep.mutate({ workItemId: link.sourceWorkItemId, targetWorkItemId: item.id });
  };

  const openCandidate = (candidate: TimelineWorkItem | undefined) => {
    if (!candidate) return;
    onOpenDetails(candidate);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[var(--brand-primary)]" />
          <span>Dependencies · {item.key}</span>
        </div>
      }
      maxWidthClass="max-w-xl"
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          <span className="font-medium text-[var(--text-primary)]">{item.title}</span>
          <br />
          {item.key} · {item.type}
        </p>

        {isLoading ? (
          <div className="flex justify-center p-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <>
            {/* ── Outgoing: items this item depends on ─────────────────────── */}
            <section className="flex flex-col gap-2">
              <h4 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                This item depends on ({links?.outgoing.length ?? 0})
              </h4>
              {!links || links.outgoing.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-card)] px-3 py-2.5">
                  No outgoing dependencies. {item.key} blocks nothing yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {links.outgoing.map((link) => {
                    const target = candidateById.get(link.targetWorkItemId);
                    return (
                      <li
                        key={link.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs"
                      >
                        {linkTypeBadge(link.linkType)}
                        <ArrowRight className="w-3 h-3 shrink-0 text-[var(--text-muted)]" />
                        <button
                          onClick={() => openCandidate(target)}
                          className="flex items-center gap-1 min-w-0 text-left font-medium text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-colors truncate"
                          title={target ? target.title : link.targetKey}
                        >
                          <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">
                            {link.targetKey}
                          </span>
                          <span className="truncate">{target ? target.title : '(not on this plan timeline)'}</span>
                          {target && <ExternalLink className="w-2.5 h-2.5 shrink-0" />}
                        </button>
                        <button
                          onClick={() => handleRemoveOutgoing(link)}
                          disabled={removeDep.isPending}
                          className="ml-auto shrink-0 p-1 text-[var(--text-muted)] hover:text-rose-500 transition-colors disabled:opacity-40"
                          title="Remove dependency"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ── Incoming: items that depend on this item ─────────────────── */}
            <section className="flex flex-col gap-2">
              <h4 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Depends on this item ({links?.incoming.length ?? 0})
              </h4>
              {!links || links.incoming.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-card)] px-3 py-2.5">
                  Nothing depends on {item.key} yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {links.incoming.map((link) => {
                    const source = candidateById.get(link.sourceWorkItemId);
                    return (
                      <li
                        key={link.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs"
                      >
                        <ArrowLeft className="w-3 h-3 shrink-0 text-[var(--text-muted)]" />
                        {linkTypeBadge(link.linkType)}
                        <button
                          onClick={() => openCandidate(source)}
                          className="flex items-center gap-1 min-w-0 text-left font-medium text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-colors truncate"
                          title={source ? source.title : link.sourceKey}
                        >
                          <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">
                            {link.sourceKey}
                          </span>
                          <span className="truncate">{source ? source.title : '(not on this plan timeline)'}</span>
                          {source && <ExternalLink className="w-2.5 h-2.5 shrink-0" />}
                        </button>
                        <button
                          onClick={() => handleRemoveIncoming(link)}
                          disabled={removeDep.isPending}
                          className="ml-auto shrink-0 p-1 text-[var(--text-muted)] hover:text-rose-500 transition-colors disabled:opacity-40"
                          title="Remove dependency"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ── Add a dependency ─────────────────────────────────────────── */}
            <section className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-3">
              <h4 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Add dependency
              </h4>
              {available.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">
                  All timeline items are already linked to {item.key}.
                </p>
              ) : (
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-stretch">
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="min-w-0 border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">Select an item…</option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.key}] {c.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={linkType}
                    onChange={(e) => setLinkType(e.target.value as WorkItemLinkType)}
                    className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                    title="Link type"
                  >
                    <option value="DEPENDS_ON">depends on</option>
                    <option value="RELATED">related to</option>
                  </select>
                  <button
                    onClick={handleAdd}
                    disabled={!targetId || createDep.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              )}
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                &quot;Depends on&quot; blocks the source item until the target ships; cycles are rejected by the server.
              </p>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
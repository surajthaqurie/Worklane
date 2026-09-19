'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Copy, Check, Pencil } from 'lucide-react';
import {
  useWorkItemComments,
  useWorkItemActivity,
  useWorkItemDetail,
  useAddComment,
  useUpdateComment,
  useDeleteComment,
  useUpdateWorkItem,
  useDeleteWorkItem,
  useWorkItems,
  useTransitionWorkItemState,
} from '../hooks/useWorkItems';
import { WorkItem } from '@/shared/types';
import { useProjectMembers } from '@/features/projects/hooks/useProjects';
import { useIterations } from '@/features/iterations/hooks/useIterations';
import { useWorkItemStates } from '../hooks/useWorkItemStates';
import { Drawer } from '@/shared/components/ui/Drawer';
import { Spinner } from '@/shared/components/ui/Spinner';
import { WorkItemTypeBadge } from './WorkItemBadge';
import { CreateWorkItemModal } from './CreateWorkItemModal';

export interface WorkItemDrawerProps {
  item: WorkItem | null;
  onClose: () => void;
}

export function WorkItemDrawer({ item, onClose }: WorkItemDrawerProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isCreateChildModalOpen, setIsCreateChildModalOpen] = useState(false);

  const itemId = item?.id ?? '';
  const projectId = item?.projectId ?? '';

  const { data: commentPages, isLoading: isLoadingComments } = useWorkItemComments(itemId);
  const comments = commentPages?.pages.flatMap((p) => p.items) ?? [];
  const { data: activity = [], isLoading: isLoadingActivity } = useWorkItemActivity(itemId);
  // Lean list responses (board, backlog, grid) omit `description`/`points`;
  // fetch the full row so editing never clobbers fields we didn't receive.
  const { data: detail } = useWorkItemDetail(itemId);

  const addComment = useAddComment(itemId);
  const updateComment = useUpdateComment(itemId);
  const deleteComment = useDeleteComment(itemId);
  const updateWorkItem = useUpdateWorkItem(projectId);
  const deleteWorkItem = useDeleteWorkItem(projectId);
  const transitionWorkItem = useTransitionWorkItemState(projectId);

  const { data: members = [] } = useProjectMembers(projectId);
  const { data: iterations = [] } = useIterations(projectId);
  const { data: allWorkItems = [] } = useWorkItems(projectId, undefined, { limit: '300' });
  const { data: states = [] } = useWorkItemStates(projectId);

  const current = detail ?? item;

  const [titleInput, setTitleInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');

  useEffect(() => {
    if (current) {
      setTitleInput(current.title || '');
      setDescriptionInput(current.description || '');
    }
  }, [current?.id, current?.title, current?.description]);

  if (!item || !current) return null;

  const handleDeleteWorkItem = () => {
    if (confirm('Are you sure you want to delete this work item?')) {
      deleteWorkItem.mutate(item.id, {
        onSuccess: () => onClose(),
      });
    }
  };

  const handleUpdate = (field: keyof WorkItem, value: unknown) => {
    if (field === 'state' && typeof value === 'string') {
      transitionWorkItem.mutate({ id: item.id, state: value });
    } else {
      updateWorkItem.mutate({
        id: item.id,
        data: { [field]: value },
      });
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const existingTags = current.tags || [];
      if (!existingTags.includes(tagInput.trim())) {
        handleUpdate('tags', [...existingTags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const existingTags = current.tags || [];
    handleUpdate('tags', existingTags.filter((t: string) => t !== tagToRemove));
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate(newComment, {
      onSuccess: () => setNewComment(''),
    });
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editingCommentContent.trim()) return;
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    updateComment.mutate(
      { commentId, content: editingCommentContent, version: comment.version },
      {
        onSuccess: () => setEditingCommentId(null),
      },
    );
  };

  const handleDeleteComment = (commentId: string) => {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    if (confirm('Are you sure you want to delete this comment?')) {
      deleteComment.mutate({ commentId, version: comment.version });
    }
  };

  return (
    <Drawer
      isOpen={!!item}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between gap-3 w-full pr-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] shrink-0">
              {current.key}
            </span>
            <WorkItemTypeBadge type={current.type} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (current?.key) {
                  navigator.clipboard.writeText(current.key);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }
              }}
              title="Copy Item ID"
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {copiedKey ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500 font-medium">Copied ID</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (current?.title) {
                  navigator.clipboard.writeText(current.title);
                  setCopiedTitle(true);
                  setTimeout(() => setCopiedTitle(false), 2000);
                }
              }}
              title="Copy Title"
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {copiedTitle ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500 font-medium">Copied Title</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Title</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
      subtitle={
        <div className="text-xs font-medium text-[var(--text-secondary)] line-clamp-2 break-words whitespace-pre-wrap mt-0.5" title={current.title}>
          {current.title}
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] px-6 bg-[var(--bg-surface)] shrink-0">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'comments'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Comments ({comments.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'activity'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Activity ({activity.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'details' && (
            <div className="flex flex-col gap-6">
              {/* Title & Description */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                      <span>Title</span>
                      <span className="text-[10px] font-normal text-[var(--text-muted)]">(Click to edit • Press Shift+Enter for new line)</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (current?.key) {
                            navigator.clipboard.writeText(current.key);
                            setCopiedKey(true);
                            setTimeout(() => setCopiedKey(false), 2000);
                          }
                        }}
                        title="Copy Item ID"
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                      >
                        {copiedKey ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500 font-medium">Copied ID!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy ID</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (current?.title) {
                            navigator.clipboard.writeText(current.title);
                            setCopiedTitle(true);
                            setTimeout(() => setCopiedTitle(false), 2000);
                          }
                        }}
                        title="Copy Work Item Title"
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                      >
                        {copiedTitle ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500 font-medium">Copied Title!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Title</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onBlur={() => {
                        if (titleInput.trim() && titleInput.trim() !== current.title) {
                          handleUpdate('title', titleInput.trim());
                        } else {
                          setTitleInput(current.title);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          setTitleInput(current.title);
                          e.currentTarget.blur();
                        }
                      }}
                      rows={Math.min(5, Math.max(2, titleInput.split('\n').length))}
                      placeholder="Title of work item..."
                      className="w-full text-base font-semibold px-3 py-2 rounded-[var(--radius-input)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:bg-[var(--bg-surface)] outline-none transition-all text-[var(--text-primary)] shadow-xs resize-y min-h-[48px] whitespace-pre-wrap leading-snug"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">Description</label>
                  <textarea
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    onBlur={() => {
                      if (descriptionInput !== (current.description || '')) {
                        handleUpdate('description', descriptionInput);
                      }
                    }}
                    placeholder="Add a detailed description..."
                    rows={4}
                    className="w-full text-xs p-3 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] focus:bg-[var(--bg-surface)] outline-none transition-colors text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-subtle)] pt-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">State</label>
                  <select
                    value={current.state}
                    onChange={(e) => handleUpdate('state', e.target.value)}
                    className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                  >
                    {states.map((s) => (
                      <option key={s.id} value={s.key}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">Priority</label>
                  <select
                    value={current.priority}
                    onChange={(e) => handleUpdate('priority', e.target.value)}
                    className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">Assignee</label>
                  <select
                    value={current.assignedTo || ''}
                    onChange={(e) => handleUpdate('assignedTo', e.target.value || null)}
                    className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.userId}>
                        {m.userName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">Story Points</label>
                  <input
                    type="number"
                    min={0}
                    defaultValue={current.points ?? ''}
                    onBlur={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      if (val !== current.points) handleUpdate('points', val);
                    }}
                    className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">Parent Item</label>
                  <select
                    value={current.parentId || ''}
                    onChange={(e) => handleUpdate('parentId', e.target.value || null)}
                    className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">None</option>
                    {allWorkItems
                      .filter((w) => w.id !== item.id)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          [{w.key}] {w.title}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">Iteration</label>
                  <select
                    value={current.iterationId || ''}
                    onChange={(e) => handleUpdate('iterationId', e.target.value || null)}
                    className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">Backlog</option>
                    {iterations.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Parent Item Banner */}
              {current.parentId && (
                <div className="p-3 bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 rounded-[var(--radius-card)] flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-bold text-[var(--brand-primary)] uppercase tracking-wider">Parent Work Item</span>
                    <div className="flex items-center gap-2 truncate">
                      {allWorkItems.find((w) => w.id === current.parentId) ? (
                        <WorkItemTypeBadge type={allWorkItems.find((w) => w.id === current.parentId)!.type} />
                      ) : null}
                      <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                        {allWorkItems.find((w) => w.id === current.parentId)?.key || 'Parent'}
                      </span>
                      <span className="text-xs font-medium text-[var(--text-secondary)] truncate">
                        {allWorkItems.find((w) => w.id === current.parentId)?.title || current.parentId}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags Section */}
              <div className="border-t border-[var(--border-subtle)] pt-4 flex flex-col gap-2">
                <label className="text-[11px] font-medium text-[var(--text-muted)]">Tags</label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(current.tags || []).map((t: string) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full text-xs"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-[var(--text-primary)] text-[10px]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    className="text-xs bg-transparent border-b border-transparent focus:border-[var(--border-focus)] outline-none px-1 py-0.5 text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Child Tasks & Bugs Section */}
              <div className="border-t border-[var(--border-subtle)] pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">Child Tasks & Bugs</h3>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                      {allWorkItems.filter((w) => w.parentId === current.id).length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreateChildModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--brand-primary)] hover:underline"
                  >
                    + Add Child Item
                  </button>
                </div>

                {allWorkItems.filter((w) => w.parentId === current.id).length === 0 ? (
                  <div className="text-xs text-[var(--text-muted)] italic bg-[var(--bg-surface-subtle)] p-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] text-center">
                    No child tasks or bugs added yet. Click "+ Add Child Item" to create one.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {allWorkItems
                      .filter((w) => w.parentId === current.id)
                      .map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between p-2.5 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs gap-3 hover:border-[var(--border-strong)] transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <WorkItemTypeBadge type={child.type} />
                            <span className="font-mono text-[11px] font-semibold text-[var(--text-secondary)]">{child.key}</span>
                            <span className="font-medium text-[var(--text-primary)] truncate" title={child.title}>
                              {child.title}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] shrink-0">
                            {child.state}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="border-t border-[var(--border-subtle)] pt-6 flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleDeleteWorkItem}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium transition-colors"
                >
                  Delete Work Item
                </button>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Created {format(new Date(current.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] outline-none transition-colors text-[var(--text-primary)]"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={addComment.isPending || !newComment.trim()}
                    className="px-3 py-1.5 text-xs font-medium bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] hover:opacity-90 disabled:opacity-50 transition-colors"
                  >
                    Post Comment
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-4 border-t border-[var(--border-subtle)] pt-4">
                {isLoadingComments ? (
                  <div className="flex justify-center p-4">
                    <Spinner size="sm" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[var(--text-muted)]">No comments yet.</div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-[var(--text-primary)]">{comment.authorName}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                        </span>
                      </div>

                      {editingCommentId === comment.id ? (
                        <div className="flex flex-col gap-2 mt-1">
                          <textarea
                            value={editingCommentContent}
                            onChange={(e) => setEditingCommentContent(e.target.value)}
                            className="w-full text-xs p-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                            rows={2}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingCommentId(null)}
                              className="text-xs text-[var(--text-secondary)]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(comment.id)}
                              className="text-xs text-[var(--brand-primary)] font-medium"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{comment.content}</div>
                      )}

                      {editingCommentId !== comment.id && (
                        <div className="flex gap-3 justify-end text-[10px] text-[var(--text-muted)] mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditingCommentContent(comment.content);
                            }}
                            className="hover:text-[var(--text-primary)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="hover:text-rose-500"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="flex flex-col gap-3">
              {isLoadingActivity ? (
                <div className="flex justify-center p-4">
                  <Spinner size="sm" />
                </div>
              ) : activity.length === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--text-muted)]">No activity logged.</div>
              ) : (
                activity.map((act) => (
                  <div key={act.id} className="text-xs flex flex-col gap-0.5 border-b border-[var(--border-subtle)] pb-2.5">
                    <div className="flex justify-between">
                      <span className="font-medium text-[var(--text-primary)]">{act.actorName}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {format(new Date(act.createdAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <span className="text-[var(--text-secondary)]">{act.description}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {isCreateChildModalOpen && (
        <CreateWorkItemModal
          projectId={projectId}
          initialValues={{ parentId: current.id, type: 'TASK' }}
          isOpen={isCreateChildModalOpen}
          onClose={() => setIsCreateChildModalOpen(false)}
        />
      )}
    </Drawer>
  );
}

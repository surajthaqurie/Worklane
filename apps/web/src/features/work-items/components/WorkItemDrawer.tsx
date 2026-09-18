'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  useWorkItemComments,
  useWorkItemActivity,
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

  const itemId = item?.id ?? '';
  const projectId = item?.projectId ?? '';

  const { data: commentPages, isLoading: isLoadingComments } = useWorkItemComments(itemId);
  const comments = commentPages?.pages.flatMap((p) => p.items) ?? [];
  const { data: activity = [], isLoading: isLoadingActivity } = useWorkItemActivity(itemId);

  const addComment = useAddComment(itemId);
  const updateComment = useUpdateComment(itemId);
  const deleteComment = useDeleteComment(itemId);
  const updateWorkItem = useUpdateWorkItem(projectId);
  const deleteWorkItem = useDeleteWorkItem(projectId);
  const transitionWorkItem = useTransitionWorkItemState(projectId);

  const { data: members = [] } = useProjectMembers(projectId);
  const { data: iterations = [] } = useIterations(projectId);
  const { data: allWorkItems = [] } = useWorkItems(projectId);
  const { data: states = [] } = useWorkItemStates(projectId);

  if (!item) return null;

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
      const currentTags = item.tags || [];
      if (!currentTags.includes(tagInput.trim())) {
        handleUpdate('tags', [...currentTags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = item.tags || [];
    handleUpdate('tags', currentTags.filter((t: string) => t !== tagToRemove));
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
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[var(--text-muted)] font-normal">{item.key}</span>
          <WorkItemTypeBadge type={item.type} />
        </div>
      }
      subtitle={item.title}
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
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  defaultValue={item.title}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== item.title) {
                      handleUpdate('title', e.target.value.trim());
                    }
                  }}
                  className="text-lg font-semibold bg-transparent border-b border-transparent hover:border-[var(--border-default)] focus:border-[var(--border-focus)] outline-none transition-colors text-[var(--text-primary)]"
                />

                <textarea
                  defaultValue={item.description || ''}
                  placeholder="Add a detailed description..."
                  onBlur={(e) => {
                    if (e.target.value !== (item.description || '')) {
                      handleUpdate('description', e.target.value);
                    }
                  }}
                  rows={4}
                  className="w-full text-xs p-3 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] outline-none transition-colors text-[var(--text-primary)]"
                />
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-subtle)] pt-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">State</label>
                  <select
                    value={item.state}
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
                    value={item.priority}
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
                    value={item.assignedTo || ''}
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
                    defaultValue={item.points ?? ''}
                    onBlur={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      if (val !== item.points) handleUpdate('points', val);
                    }}
                    className="border border-[var(--border-default)] rounded-[var(--radius-input)] px-2.5 py-1.5 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">Parent Item</label>
                  <select
                    value={item.parentId || ''}
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
                    value={item.iterationId || ''}
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

              {/* Tags Section */}
              <div className="border-t border-[var(--border-subtle)] pt-4 flex flex-col gap-2">
                <label className="text-[11px] font-medium text-[var(--text-muted)]">Tags</label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(item.tags || []).map((t: string) => (
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
                  Created {format(new Date(item.createdAt), 'MMM d, yyyy')}
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
    </Drawer>
  );
}

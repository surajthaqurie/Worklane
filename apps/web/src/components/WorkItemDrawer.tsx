'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { WorkItem, WorkItemActivity, WorkItemComment, useWorkItemComments, useWorkItemActivity, useAddComment, useUpdateComment, useDeleteComment, useUpdateWorkItem, useDeleteWorkItem, useWorkItems, useTransitionWorkItemState } from '@/hooks/useWorkItems';
import { useProjectMembers, useAreas } from '@/hooks/useProjects';
import { useIterations } from '@/hooks/useIterations';
import { X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/Toast';

export function WorkItemDrawer({ item, onClose }: { item: WorkItem, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || '');

  const {
    data: commentPages,
    isLoading: isLoadingComments,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useWorkItemComments(item.id);
  const comments = commentPages?.pages.flatMap((p) => p.items) ?? [];
  const { data: activity = [], isLoading: isLoadingActivity } = useWorkItemActivity(item.id);

  const addComment = useAddComment(item.id);
  const updateComment = useUpdateComment(item.id);
  const deleteComment = useDeleteComment(item.id);
  const updateWorkItem = useUpdateWorkItem(item.projectId);
  const deleteWorkItem = useDeleteWorkItem(item.projectId);
  const { data: members = [] } = useProjectMembers(item.projectId);
  const { data: iterations = [] } = useIterations(item.projectId);
  const { data: areas = [] } = useAreas(item.projectId);
  const { data: allWorkItems = [] } = useWorkItems(item.projectId); // for parent selection
  
  const [tagInput, setTagInput] = useState('');
  
  const handleDeleteWorkItem = () => {
    if (confirm('Are you sure you want to delete this work item?')) {
      deleteWorkItem.mutate(item.id, {
        onSuccess: () => onClose()
      });
    }
  };
  
  const handleAddTag = (e: any) => {
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
    handleUpdate('tags', currentTags.filter(t => t !== tagToRemove));
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate(newComment, {
      onSuccess: () => setNewComment('')
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

  const handleDelete = (commentId: string) => {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    if (confirm('Are you sure you want to delete this comment?')) {
      deleteComment.mutate({ commentId, version: comment.version });
    }
  };

  const transitionWorkItem = useTransitionWorkItemState(item.projectId);

  const handleUpdate = (field: string, value: any) => {
    if (field === 'state') {
        transitionWorkItem.mutate({ id: item.id, state: value });
    } else {
        updateWorkItem.mutate({ id: item.id, data: { [field]: value } });
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity backdrop-blur-[1px]"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-[var(--bg-surface)] shadow-2xl z-50 flex flex-col transform transition-transform duration-300 border-l border-[var(--border-subtle)]">
        <div className="flex justify-between items-start p-6 border-b border-[var(--border-subtle)]">
          <div className="flex flex-col gap-3 pr-8 w-full">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-[var(--text-secondary)]">{item.key}</span>
              <select 
                value={item.type}
                onChange={(e) => handleUpdate('type', e.target.value)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border-none focus:ring-0 cursor-pointer"
              >
                <option value="EPIC">EPIC</option>
                <option value="FEATURE">FEATURE</option>
                <option value="STORY">STORY</option>
                <option value="TASK">TASK</option>
                <option value="BUG">BUG</option>
              </select>
            </div>
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => {
                if (e.target.value !== item.title) handleUpdate('title', e.target.value);
              }}
              className="text-[18px] font-semibold text-[var(--text-primary)] leading-snug bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full"
            />
          </div>
          <div className="absolute top-6 right-6 flex items-center gap-2">
             <button onClick={handleDeleteWorkItem} className="text-[12px] font-medium text-[var(--priority-high)] hover:bg-[var(--bg-surface-hover)] px-2 py-1 rounded-[var(--radius-button)] transition-colors">Delete</button>
             <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 bg-[var(--bg-surface-hover)] rounded-full">
            <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-[var(--border-subtle)] px-6">
          <button 
            className={`py-3 mr-6 text-[13px] font-medium relative ${activeTab === 'details' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            onClick={() => setActiveTab('details')}
          >
            Details
            {activeTab === 'details' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--brand-primary)]"></div>}
          </button>
          <button 
            className={`py-3 mr-6 text-[13px] font-medium relative ${activeTab === 'comments' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            onClick={() => setActiveTab('comments')}
          >
            Comments
            {activeTab === 'comments' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--brand-primary)]"></div>}
          </button>
          <button 
            className={`py-3 text-[13px] font-medium relative ${activeTab === 'activity' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
            {activeTab === 'activity' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--brand-primary)]"></div>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {activeTab === 'details' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">State</label>
                  <select 
                    value={item.state}
                    onChange={(e) => handleUpdate('state', e.target.value)}
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  >
                    <option value="New">New</option>
                    <option value="Active">Active</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                    <option value="Removed">Removed</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">Priority</label>
                  <select 
                    value={item.priority}
                    onChange={(e) => handleUpdate('priority', e.target.value)}
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">Points</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5"
                    value={item.points === null ? '' : item.points}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleUpdate('points', val === '' ? null : parseInt(val, 10));
                    }}
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">Assigned To</label>
                  <select 
                    value={item.assignedTo || ''}
                    onChange={(e) => handleUpdate('assignedTo', e.target.value || null)}
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m: any) => (
                      <option key={m.userId} value={m.userId}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">Parent</label>
                  <select 
                    value={item.parentId || ''}
                    onChange={(e) => handleUpdate('parentId', e.target.value || null)}
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  >
                    <option value="">None</option>
                    {allWorkItems.filter((w: any) => w.id !== item.id).map((w: any) => (
                      <option key={w.id} value={w.id}>{w.key} - {w.title}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">Iteration</label>
                  <select 
                    value={item.iterationId || ''}
                    onChange={(e) => handleUpdate('iterationId', e.target.value || null)}
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  >
                    <option value="">Backlog</option>
                    {iterations.map((it: any) => (
                      <option key={it.id} value={it.id}>{it.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">Area</label>
                  <select 
                    value={item.areaId || ''}
                    onChange={(e) => handleUpdate('areaId', e.target.value || null)}
                    className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  >
                    <option value="">None</option>
                    {areas.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(item.tags || []).map((t: string) => (
                    <span key={t} className="flex items-center gap-1 bg-[var(--bg-surface-hover)] text-[12px] px-2 py-1 rounded-[var(--radius-button)]">
                      {t}
                      <button onClick={() => handleRemoveTag(t)} className="hover:text-[var(--priority-high)]"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Add a tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">Description</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={(e) => {
                    if (e.target.value !== (item.description || '')) handleUpdate('description', e.target.value);
                  }}
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] min-h-[150px] focus:outline-none focus:border-[var(--border-focus)] transition-colors placeholder:text-[var(--text-muted)]"
                  placeholder="Add a description..."
                />
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <>
              <div className="flex flex-col gap-6 flex-1">
                {isLoadingComments ? (
                  <div className="text-center text-[13px] text-[var(--text-muted)] mt-8">Loading comments...</div>
                ) : comments.length === 0 ? (
                  <div className="text-center text-[13px] text-[var(--text-muted)] py-12">No comments yet. Be the first to start the conversation.</div>
                ) : (
                  <>
                    {comments.map((comment: WorkItemComment) => (
                      <div key={comment.id} className={`flex gap-4 ${comment.isPending ? 'opacity-60' : ''}`}>
                        <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-medium text-[var(--text-primary)] flex-shrink-0">
                          {comment.authorName?.substring(0,2).toUpperCase() || 'US'}
                        </div>
                        <div className="flex flex-col flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-semibold text-[13px] text-[var(--text-primary)]">{comment.authorName || 'User'}</span>
                            <span className="text-[12px] text-[var(--text-muted)]">{format(new Date(comment.createdAt), 'MMM d, yyyy HH:mm')}</span>
                            {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                              <span className="text-[12px] text-[var(--text-muted)]">
                                (edited)
                              </span>
                            )}
                            {comment.isPending && (
                              <span className="text-[10px] font-medium text-[var(--brand-primary)] bg-[var(--bg-surface-selected)] px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Sending…
                              </span>
                            )}
                          </div>
                          
                          {editingCommentId === comment.id ? (
                            <div className="flex flex-col gap-2 mt-1">
                              <textarea 
                                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] p-2.5 text-[13px] bg-[var(--bg-surface)] min-h-[80px] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                                value={editingCommentContent}
                                onChange={(e) => setEditingCommentContent(e.target.value)}
                              />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingCommentId(null)} className="text-[12px] px-3 py-1.5 text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors">Cancel</button>
                                <button onClick={() => handleSaveEdit(comment.id)} disabled={updateComment.isPending} className="text-[12px] px-3 py-1.5 bg-[var(--brand-primary)] text-white font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50">
                                  {updateComment.isPending ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="group relative">
                              <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap bg-[var(--bg-surface-hover)] p-3 rounded-tr-[var(--radius-card)] rounded-br-[var(--radius-card)] rounded-bl-[var(--radius-card)]">{comment.content}</p>
                              {!comment.isPending && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 absolute -right-2 top-2 translate-x-full">
                                  <button 
                                    onClick={() => { setEditingCommentId(comment.id); setEditingCommentContent(comment.content); }}
                                    className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                                  >Edit</button>
                                  <button 
                                    onClick={() => handleDelete(comment.id)}
                                    className="text-[11px] text-[var(--priority-high)] hover:text-[var(--priority-urgent)] font-medium"
                                  >Delete</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {hasNextPage && (
                      <button
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="self-center text-[12px] px-4 py-1.5 text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors disabled:opacity-50"
                      >
                        {isFetchingNextPage ? 'Loading...' : 'Load more comments'}
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="mt-auto border-t border-[var(--border-subtle)] pt-6 flex flex-col gap-3 bg-[var(--bg-surface)] sticky bottom-0">
                <textarea 
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] p-3 text-[13px] bg-[var(--bg-surface)] min-h-[80px] focus:outline-none focus:border-[var(--border-focus)] transition-colors placeholder:text-[var(--text-muted)]"
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addComment.isPending}
                  className="self-end px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
                >
                  Send
                </button>
              </div>
            </>
          )}

          {activeTab === 'activity' && (
            <div className="flex flex-col gap-6">
              {isLoadingActivity ? (
                <div className="text-center text-[13px] text-[var(--text-muted)] mt-8">Loading activity...</div>
              ) : activity.length === 0 ? (
                <div className="text-center text-[13px] text-[var(--text-muted)] py-12">No activity yet.</div>
              ) : (
                activity.map((act: WorkItemActivity) => (
                  <div key={act.id} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 text-[11px] font-medium text-[var(--text-primary)]">
                      {act.actorName?.substring(0,2).toUpperCase() || 'US'}
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="text-[13px]">
                        <span className="font-semibold text-[var(--text-primary)]">{act.actorName || 'User'}</span>
                        <span className="text-[var(--text-secondary)] ml-1">{act.description}</span>
                      </div>
                      <span className="text-[12px] text-[var(--text-muted)] mt-0.5">{format(new Date(act.createdAt), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

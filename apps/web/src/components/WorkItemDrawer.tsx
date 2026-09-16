'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { WorkItem, useWorkItemComments, useWorkItemActivity, useAddComment, useUpdateComment, useDeleteComment, useUpdateWorkItem } from '@/hooks/useWorkItems';
import { X } from 'lucide-react';

export function WorkItemDrawer({ item, onClose }: { item: WorkItem, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || '');

  const { data: comments = [], isLoading: isLoadingComments } = useWorkItemComments(item.id);
  const { data: activity = [], isLoading: isLoadingActivity } = useWorkItemActivity(item.id);

  const addComment = useAddComment(item.id);
  const updateComment = useUpdateComment(item.id);
  const deleteComment = useDeleteComment(item.id);
  const updateWorkItem = useUpdateWorkItem(item.projectId);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate(newComment, {
      onSuccess: () => setNewComment('')
    });
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editingCommentContent.trim()) return;
    updateComment.mutate({ commentId, content: editingCommentContent }, {
      onSuccess: () => setEditingCommentId(null)
    });
  };

  const handleDelete = (commentId: string) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      deleteComment.mutate(commentId);
    }
  };

  const handleUpdate = (field: string, value: any) => {
    updateWorkItem.mutate({ id: item.id, data: { [field]: value } });
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
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors absolute top-6 right-6 p-1 bg-[var(--bg-surface-hover)] rounded-full">
            <X className="w-4 h-4" />
          </button>
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
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
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
                  comments.map((comment: any) => (
                    <div key={comment.id} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-medium text-[var(--text-primary)] flex-shrink-0">
                        {comment.user_name?.substring(0,2).toUpperCase() || 'US'}
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-[13px] text-[var(--text-primary)]">{comment.user_name || 'User'}</span>
                          <span className="text-[12px] text-[var(--text-muted)]">{format(new Date(comment.created_at), 'MMM d, yyyy HH:mm')}</span>
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
                              <button onClick={() => handleSaveEdit(comment.id)} className="text-[12px] px-3 py-1.5 bg-[var(--brand-primary)] text-white font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] transition-colors">Save</button>
                            </div>
                          </div>
                        ) : (
                          <div className="group relative">
                            <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap bg-[var(--bg-surface-hover)] p-3 rounded-tr-[var(--radius-card)] rounded-br-[var(--radius-card)] rounded-bl-[var(--radius-card)]">{comment.content}</p>
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
                          </div>
                        )}
                      </div>
                    </div>
                  ))
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
                activity.map((act: any) => (
                  <div key={act.id} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 text-[11px] font-medium text-[var(--text-primary)]">
                      {act.user_name?.substring(0,2).toUpperCase() || 'US'}
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="text-[13px]">
                        <span className="font-semibold text-[var(--text-primary)]">{act.user_name || 'User'}</span>
                        <span className="text-[var(--text-secondary)] mx-1">
                          {act.action === 'CREATED' && 'created this item'}
                          {act.action === 'TITLE_CHANGED' && `changed title`}
                          {act.action === 'STATE_CHANGED' && `moved item to ${act.new_value?.replace('_', ' ')}`}
                          {act.action === 'PRIORITY_CHANGED' && `changed priority to ${act.new_value}`}
                          {act.action === 'ASSIGNEE_CHANGED' && `assigned to ${act.new_value || 'unassigned'}`}
                          {act.action === 'DESCRIPTION_CHANGED' && `updated the description`}
                          {act.action === 'SPRINT_CHANGED' && (act.new_value ? 'added to a sprint' : 'moved to the backlog')}
                          {act.action === 'PARENT_CHANGED' && (act.new_value ? 'linked under a parent item' : 'removed the parent link')}
                          {act.action === 'DELETED' && 'deleted this item'}
                        </span>
                      </div>
                      <span className="text-[12px] text-[var(--text-muted)] mt-0.5">{format(new Date(act.created_at), 'MMM d, yyyy HH:mm')}</span>
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

import React, { useState } from 'react';
import { WorkItem, useWorkItemComments, useWorkItemActivity, useAddComment, useUpdateComment, useDeleteComment } from '@/hooks/useWorkItems';
import { format } from 'date-fns';

export function WorkItemDrawer({ item, onClose }: { item: WorkItem | null, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  const { data: comments = [], isLoading: isLoadingComments } = useWorkItemComments(item?.id || null);
  const { data: activity = [], isLoading: isLoadingActivity } = useWorkItemActivity(item?.id || null);
  
  const addComment = useAddComment(item?.id || null);
  const updateComment = useUpdateComment(item?.id || null);
  const deleteComment = useDeleteComment(item?.id || null);

  if (!item) return null;

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

  // Using a hardcoded userId for now or you'd get it from a user context
  // Let's assume current user is the one making changes. Wait, we don't have user context.
  // We'll just allow edit/delete for all for simplicity in UI, backend handles permission if it was fully implemented.
  // The prompt says "Delete their own comment" "No roles or permissions." So we will just show the buttons.
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col transform transition-transform duration-300">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-gray-500">{item.key}</span>
            <h2 className="text-lg font-semibold">{item.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-black dark:hover:text-white p-2">✕</button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button 
            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'comments' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
            onClick={() => setActiveTab('comments')}
          >
            Comments
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'activity' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {activeTab === 'comments' && (
            <>
              <div className="flex flex-col gap-4 flex-1">
                {isLoadingComments ? (
                  <div className="text-center text-gray-500">Loading comments...</div>
                ) : comments.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No comments yet.</div>
                ) : (
                  comments.map((comment: any) => (
                    <div key={comment.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{comment.user_name || 'User'}</span>
                          <span className="text-xs text-gray-500">{format(new Date(comment.created_at), 'MMM d, yyyy HH:mm')}</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setEditingCommentId(comment.id); setEditingCommentContent(comment.content); }}
                            className="text-xs text-blue-600 hover:underline"
                          >Edit</button>
                          <button 
                            onClick={() => handleDelete(comment.id)}
                            className="text-xs text-red-600 hover:underline"
                          >Delete</button>
                        </div>
                      </div>
                      
                      {editingCommentId === comment.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea 
                            className="w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm bg-white dark:bg-gray-900 min-h-[60px]"
                            value={editingCommentContent}
                            onChange={(e) => setEditingCommentContent(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingCommentId(null)} className="text-xs px-3 py-1 text-gray-500">Cancel</button>
                            <button onClick={() => handleSaveEdit(comment.id)} className="text-xs px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-auto border-t border-gray-200 dark:border-gray-800 pt-4 flex flex-col gap-2 bg-white dark:bg-gray-900 sticky bottom-0">
                <textarea 
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm bg-transparent min-h-[80px]"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addComment.isPending}
                  className="self-end px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Comment
                </button>
              </div>
            </>
          )}

          {activeTab === 'activity' && (
            <div className="flex flex-col gap-4">
              {isLoadingActivity ? (
                <div className="text-center text-gray-500">Loading activity...</div>
              ) : activity.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No activity yet.</div>
              ) : (
                activity.map((act: any) => (
                  <div key={act.id} className="flex gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      {act.user_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex flex-col">
                      <div>
                        <span className="font-medium">{act.user_name || 'User'}</span>
                        <span className="text-gray-500 mx-1">
                          {act.action === 'CREATED' && 'created this item'}
                          {act.action === 'TITLE_CHANGED' && `changed title`}
                          {act.action === 'STATE_CHANGED' && `moved from ${act.old_value?.replace('_', ' ')} to ${act.new_value?.replace('_', ' ')}`}
                          {act.action === 'PRIORITY_CHANGED' && `changed priority to ${act.new_value}`}
                          {act.action === 'ASSIGNEE_CHANGED' && `assigned to ${act.new_value || 'unassigned'}`}
                          {act.action === 'DESCRIPTION_CHANGED' && `updated the description`}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{format(new Date(act.created_at), 'MMM d, yyyy HH:mm')}</span>
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

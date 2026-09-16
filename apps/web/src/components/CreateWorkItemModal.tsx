'use client';

import { useState } from 'react';
import { useCreateWorkItem } from '@/hooks/useWorkItems';
import { X } from 'lucide-react';

export function CreateWorkItemModal({ projectId, onClose }: { projectId: string, onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'TASK' | 'BUG' | 'STORY'>('TASK');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  
  const createWorkItem = useCreateWorkItem(projectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    createWorkItem.mutate({
      title,
      description,
      type,
      priority,
      state: 'New'
    }, {
      onSuccess: () => onClose()
    });
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity backdrop-blur-[1px]"
        onClick={onClose}
      />
      
      <div className="fixed inset-0 m-auto w-full max-w-md h-fit max-h-[90vh] bg-[var(--bg-surface)] shadow-2xl z-50 rounded-[var(--radius-card)] flex flex-col border border-[var(--border-subtle)] overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-[var(--border-subtle)]">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">New Work Item</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 bg-[var(--bg-surface-hover)] rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">Title</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
              placeholder="e.g. Implement login feature"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">Type</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value as 'TASK' | 'BUG' | 'STORY')}
              className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
            >
              <option value="TASK">Task</option>
              <option value="BUG">Bug</option>
              <option value="STORY">Story</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">Priority</label>
            <select 
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')}
              className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">Description</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] min-h-[100px] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
              placeholder="Add more details..."
            />
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={createWorkItem.isPending}
              className="px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {createWorkItem.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

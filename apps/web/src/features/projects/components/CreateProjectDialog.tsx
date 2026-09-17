'use client';

import React, { useState } from 'react';
import { useCreateProject } from '../hooks/useProjects';
import { Modal } from '@/shared/components/ui/Modal';
import { useToast } from '@/shared/hooks/useToast';

export interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectDialog({ isOpen, onClose }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  
  const createProject = useCreateProject();
  const toast = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;

    createProject.mutate(
      { name: name.trim(), key: key.trim().toUpperCase(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          toast.showSuccess('Project created successfully');
          setName('');
          setKey('');
          setDescription('');
          onClose();
        },
        onError: (err) => {
          toast.showError('Failed to create project', (err as Error).message);
        },
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Project Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!key) {
                setKey(e.target.value.substring(0, 4).toUpperCase());
              }
            }}
            placeholder="e.g. Mobile Application"
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-xs bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Project Key</label>
          <input
            type="text"
            required
            maxLength={10}
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="e.g. MAP"
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-xs bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)] font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional project description..."
            className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-xs bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] text-[var(--text-primary)]"
          />
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createProject.isPending}
            className="px-4 py-2 text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 rounded-[var(--radius-button)] transition-colors disabled:opacity-50"
          >
            {createProject.isPending ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

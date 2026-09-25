'use client';

import React, { useState } from 'react';
import { useCreateOrganization } from '../hooks/useOrganizations';
import { useOrganizationContext } from '../context/OrganizationContext';
import { X, Building2, Loader2 } from 'lucide-react';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateOrganizationModal({ isOpen, onClose }: CreateOrganizationModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { switchOrganization } = useOrganizationContext();
  const createMutation = useCreateOrganization();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Organization name is required');
      return;
    }

    try {
      setErrorMessage('');
      const created = await createMutation.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
      });

      setName('');
      setDescription('');
      onClose();
      switchOrganization(created.id);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create organization');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] max-w-md w-full shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                Create Organization
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                A shared workspace for all your projects and teams
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[13px] rounded-[var(--radius-button)]">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5">
              Organization Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Innovations"
              className="w-full px-3 py-2 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-hidden focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] text-[var(--text-primary)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5">
              Description <span className="text-[11px] text-[var(--text-muted)]">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this organization focus on?"
              className="w-full px-3 py-2 text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] focus:outline-hidden focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] text-[var(--text-primary)] transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-[13px] font-medium bg-[var(--brand-primary)] hover:opacity-90 disabled:opacity-50 text-white rounded-[var(--radius-button)] transition-opacity shadow-xs cursor-pointer"
            >
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Organization</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

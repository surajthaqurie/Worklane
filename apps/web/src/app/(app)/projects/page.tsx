'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProjects, useCreateProject } from '@/hooks/useProjects';
import { Folder } from 'lucide-react';

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useProjects();
  const createProject = useCreateProject();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('APP');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProject.mutateAsync({ name, key, description });
    setShowModal(false);
    setName('');
    setKey('APP');
    setDescription('');
  };

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Projects</h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">View and manage all your workspaces.</p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
          <button 
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
          >
            + New Project
          </button>
        </div>
      </div>

      {isLoading && <div className="text-[13px] text-[var(--text-muted)]">Loading projects...</div>}
      {error && <div className="text-[13px] text-[var(--priority-high)]">Error loading projects</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 content-start">
        {projects?.map((project: { id: string, name: string, key: string, description?: string, createdAt: string }) => (
          <Link href={`/projects/${project.id}`} key={project.id}>
            <div className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-5 hover:border-[var(--border-strong)] transition-colors bg-[var(--bg-surface)] cursor-pointer h-full flex flex-col group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--brand-primary)]">
                    <Folder className="w-4 h-4" />
                  </div>
                  <h2 className="text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">{project.name}</h2>
                </div>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-surface-hover)] px-2 py-1 rounded-[var(--radius-button)]">{project.key}</span>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mb-6 flex-1">
                {project.description || 'No description provided for this project.'}
              </p>
              <div className="flex justify-between items-center text-[11px] text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)]">
                <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Link>
        ))}
        {projects?.length === 0 && (
          <div className="col-span-full text-center text-[13px] text-[var(--text-secondary)] py-10 border border-dashed border-[var(--border-strong)] rounded-[var(--radius-card)] bg-[var(--bg-surface-hover)]">
            No projects yet. Create your first workspace!
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6 w-full max-w-md shadow-lg">
            <h2 className="text-[18px] font-semibold mb-4 text-[var(--text-primary)]">New Project</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-[13px] font-medium mb-1 text-[var(--text-secondary)]">Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
                  required 
                />
              </div>
              <div className="mb-4">
                <label className="block text-[13px] font-medium mb-1 text-[var(--text-secondary)]">Key</label>
                <select 
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
                  required 
                >
                  <option value="APP">APP - Application</option>
                  <option value="WEB">WEB - Web</option>
                  <option value="API">API - API Service</option>
                  <option value="MOBILE">MOBILE - Mobile</option>
                  <option value="DATA">DATA - Data & Analytics</option>
                  <option value="ADMIN">ADMIN - Admin</option>
                  <option value="BILL">BILL - Billing</option>
                  <option value="INFRA">INFRA - Infrastructure</option>
                  <option value="DESIGN">DESIGN - Design</option>
                  <option value="TEST">TEST - Testing</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-[13px] font-medium mb-1 text-[var(--text-secondary)]">Description</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] px-3 py-2 text-[13px] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-button)] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createProject.isPending}
                  className="px-4 py-2 bg-[var(--brand-primary)] text-white text-[13px] font-medium rounded-[var(--radius-button)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
                >
                  {createProject.isPending ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

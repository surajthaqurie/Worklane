'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import { Folder } from 'lucide-react';
import { Spinner, ErrorState, EmptyState } from '@/shared/components/ui';

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageContent />
    </Suspense>
  );
}

function ProjectsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: projects, isLoading, error } = useProjects();

  const showModal = searchParams.get('new') === '1';
  const openModal = () => router.push('/projects?new=1');
  const closeModal = () => router.replace(pathname);

  return (
    <div className="w-full flex flex-col h-full p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Projects</h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">View and manage all your workspaces.</p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
          <button
            onClick={openModal}
            className="px-4 py-2 bg-[var(--brand-primary)] hover:opacity-90 text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors"
          >
            + New Project
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      )}

      {error && <ErrorState error={error} title="Failed to load projects" />}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 content-start">
          {projects?.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id}>
              <div className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-5 hover:border-[var(--border-strong)] transition-colors bg-[var(--bg-surface)] cursor-pointer h-full flex flex-col group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--brand-primary)]">
                      <Folder className="w-4 h-4" />
                    </div>
                    <h2 className="text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                      {project.name}
                    </h2>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-surface-hover)] px-2 py-1 rounded-[var(--radius-button)]">
                    {project.key}
                  </span>
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
            <div className="col-span-full">
              <EmptyState title="No projects yet" description="Create your first workspace to start planning work." />
            </div>
          )}
        </div>
      )}

      <CreateProjectDialog isOpen={showModal} onClose={closeModal} />
    </div>
  );
}

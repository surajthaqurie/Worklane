import { Suspense } from 'react';
import { Sprints } from './Sprints';

export default async function SprintsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[13px] text-[var(--text-muted)]">Loading sprints...</div>
      }
    >
      <Sprints projectId={projectId} />
    </Suspense>
  );
}

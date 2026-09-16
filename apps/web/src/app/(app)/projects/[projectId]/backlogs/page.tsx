import { Suspense } from 'react';
import { Backlog } from './Backlog';

export default async function BacklogPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[13px] text-[var(--text-muted)]">Loading backlog...</div>
      }
    >
      <Backlog projectId={projectId} />
    </Suspense>
  );
}
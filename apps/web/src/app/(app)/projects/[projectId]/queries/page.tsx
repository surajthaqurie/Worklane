import { Suspense } from 'react';
import { Queries } from './Queries';

export default async function QueriesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[13px] text-[var(--text-muted)]">Loading queries...</div>
      }
    >
      <Queries projectId={projectId} />
    </Suspense>
  );
}
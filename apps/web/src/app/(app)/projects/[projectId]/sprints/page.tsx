import { Suspense } from 'react';
import { Iterations } from './Iterations';

export default async function IterationsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[13px] text-[var(--text-muted)]">Loading iterations...</div>
      }
    >
      <Iterations projectId={projectId} />
    </Suspense>
  );
}

import { Suspense } from 'react';
import { AnalyticsView } from '../analytics/AnalyticsView';

export default async function ReportsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[13px] text-[var(--text-muted)]">Loading reports...</div>
      }
    >
      <AnalyticsView projectId={projectId} />
    </Suspense>
  );
}

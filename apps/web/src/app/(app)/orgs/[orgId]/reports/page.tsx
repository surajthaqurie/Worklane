import { Suspense } from 'react';
import { OrgReportsView } from './OrgReportsView';

export default async function OrgReportsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[13px] text-[var(--text-muted)]">Loading organization analytics...</div>
      }
    >
      <OrgReportsView orgId={orgId} />
    </Suspense>
  );
}

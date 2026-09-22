import { Suspense } from 'react';
import { DeliveryPlans } from './DeliveryPlans';

export default async function DeliveryPlansPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-[var(--text-muted)]">Loading delivery plans...</div>}>
      <DeliveryPlans projectId={projectId} />
    </Suspense>
  );
}
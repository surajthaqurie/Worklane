'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrgIndexPage({ params }: { params: Promise<{ orgId: string }> }) {
  const resolved = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/orgs/${resolved.orgId}/projects`);
  }, [resolved.orgId, router]);

  return null;
}

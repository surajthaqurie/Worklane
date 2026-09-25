'use client';

import { Suspense, use } from 'react';
import { OrganizationSettingsView } from '@/features/organizations';
import { AppShell } from '@/components/layout/app-shell';

export default function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <OrgSettingsPageContent params={params} />
    </Suspense>
  );
}

function OrgSettingsPageContent({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const resolved = use(params);

  return (
    <AppShell>
      <OrganizationSettingsView organizationId={resolved.orgId} />
    </AppShell>
  );
}

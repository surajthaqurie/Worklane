import { Suspense } from 'react';
import { OrganizationLayoutClient } from './organization-layout-client';

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const resolved = await params;
  return (
    <Suspense fallback={null}>
      <OrganizationLayoutClient orgId={resolved.orgId}>
        {children}
      </OrganizationLayoutClient>
    </Suspense>
  );
}

'use client';

import { use } from 'react';
import { ProjectLayoutClient } from '@/app/(app)/projects/[projectId]/project-layout-client';

export default function OrgProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string; projectId: string }>;
}) {
  const resolved = use(params);

  return (
    <ProjectLayoutClient
      projectId={resolved.projectId}
      expectedOrgId={resolved.orgId}
    >
      {children}
    </ProjectLayoutClient>
  );
}

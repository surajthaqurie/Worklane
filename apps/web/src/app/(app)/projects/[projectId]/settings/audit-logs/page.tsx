'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AuditLogView } from '@/features/audit/components/AuditLogView';

export default function ProjectAuditLogsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return <AuditLogView projectId={projectId} />;
}

'use client';

import React, { useState } from 'react';
import { DashboardGrid } from '@/features/dashboards';
import { WorkItemDrawer } from '@/features/work-items/components/WorkItemDrawer';
import { useWorkItemDetail } from '@/features/work-items/hooks/useWorkItems';

export function ProjectOverview({ projectId }: { projectId: string }) {
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const { data: selectedItem } = useWorkItemDetail(selectedWorkItemId || '');

  return (
    <div className="flex flex-col gap-6">
      <DashboardGrid
        projectId={projectId}
        title="Project Dashboard"
        description="Monitor sprint progress, velocity, blockers, and recent activity."
        onOpenWorkItem={(id) => setSelectedWorkItemId(id)}
      />

      {selectedItem && (
        <WorkItemDrawer
          item={selectedItem}
          onClose={() => setSelectedWorkItemId(null)}
        />
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { useProjectContext } from '@/app/(app)/projects/[projectId]/project-layout-client';
import { TeamSelector as FeatureTeamSelector } from '@/features/teams/components/TeamSelector';

export function TeamSelector() {
  const { teams, selectedTeamId, setSelectedTeamId } = useProjectContext();

  return (
    <FeatureTeamSelector
      teams={teams}
      selectedTeamId={selectedTeamId}
      onSelectTeam={setSelectedTeamId}
    />
  );
}
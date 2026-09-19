export class CreateTeamDto {
  name: string;
  description?: string;
}

export class UpdateTeamDto {
  name?: string;
  description?: string | null;
}

export class AddTeamMemberDto {
  userId: string;
  role?: 'ADMIN' | 'MEMBER';
}

export class UpdateTeamMemberDto {
  role: 'ADMIN' | 'MEMBER';
}

export class UpdateTeamSettingsDto {
  boardConfig?: Record<string, unknown>;
  backlogConfig?: Record<string, unknown>;
  defaultIterationId?: string | null;
  defaultAreaId?: string | null;
  iterationIds?: string[];
  areaIds?: string[];
}
import { z } from 'zod';

export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export class CreateTeamDto {
  name: string;
  description?: string;
}

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
});

export class UpdateTeamDto {
  name?: string;
  description?: string | null;
}

const TeamRoleSchema = z.enum(['ADMIN', 'MEMBER']);

export const AddTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: TeamRoleSchema.optional(),
});

export class AddTeamMemberDto {
  userId: string;
  role?: 'ADMIN' | 'MEMBER';
}

export const UpdateTeamMemberSchema = z.object({
  role: TeamRoleSchema,
});

export class UpdateTeamMemberDto {
  role: 'ADMIN' | 'MEMBER';
}

export const UpdateTeamSettingsSchema = z.object({
  boardConfig: z.record(z.string(), z.unknown()).optional(),
  backlogConfig: z.record(z.string(), z.unknown()).optional(),
  defaultIterationId: z.string().uuid().nullable().optional(),
  defaultAreaId: z.string().uuid().nullable().optional(),
  iterationIds: z.array(z.string().uuid()).optional(),
  areaIds: z.array(z.string().uuid()).optional(),
});

export class UpdateTeamSettingsDto {
  boardConfig?: Record<string, unknown>;
  backlogConfig?: Record<string, unknown>;
  defaultIterationId?: string | null;
  defaultAreaId?: string | null;
  iterationIds?: string[];
  areaIds?: string[];
}
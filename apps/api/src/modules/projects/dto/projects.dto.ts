import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  key: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9]+$/),
  description: z.string().optional(),
  organizationId: z.string().uuid().optional().default('00000000-0000-0000-0000-000000000000'),
});

export class CreateProjectDto {
  name: string;
  key: string;
  description?: string;
  organizationId?: string;
}

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  archived: z.boolean().optional(),
});

export class UpdateProjectDto {
  name?: string;
  description?: string;
  archived?: boolean;
}

export const AddProjectMemberSchema = z.object({
  userId: z.string().uuid(),
});

export class AddProjectMemberDto {
  userId: string;
}

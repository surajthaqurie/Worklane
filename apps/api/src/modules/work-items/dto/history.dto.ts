import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const workItemHistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    actorId: z.string().uuid().optional(),
    field: z.string().trim().min(1).max(100).optional(),
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
    order: z.enum(['asc', 'desc']).default('desc').optional(),
  })
  .strict();

export type WorkItemHistoryQueryDto = z.infer<typeof workItemHistoryQuerySchema>;

export function parseHistoryInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map((issue) => issue.message).join('; '));
  }
  return result.data;
}

import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const auditLogQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    actorId: z.string().uuid().optional(),
    eventType: z.string().trim().min(1).max(100).optional(),
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
  })
  .strict();

export type AuditLogQueryDto = z.infer<typeof auditLogQuerySchema>;

export function parseAuditQueryInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map((issue) => issue.message).join('; '));
  }
  return result.data;
}

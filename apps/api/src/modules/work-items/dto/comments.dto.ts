import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const content = z.string().trim().min(1).max(10000).refine((value) => !value.includes('\0'));
const version = z.number().int().min(1).max(2147483647);

export const createCommentSchema = z.object({ content }).strict();
export const updateCommentSchema = z.object({ content, version }).strict();
export const deleteCommentSchema = z.object({ version }).strict();
export const commentPageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
}).strict();

export function parseCommentInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map((issue) => issue.message).join('; '));
  }
  return result.data;
}

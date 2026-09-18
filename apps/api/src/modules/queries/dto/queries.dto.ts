import { z } from 'zod';

export const queryOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'in',
  'notIn',
  'isEmpty',
  'isNotEmpty',
  'after',
  'before',
  'between',
]);

export const queryFieldSchema = z.enum([
  'key',
  'type',
  'title',
  'description',
  'state',
  'priority',
  'assignedTo',
  'iterationId',
  'areaId',
  'parentId',
  'createdBy',
  'createdAt',
  'updatedAt',
  'completedAt',
  'tags',
]);

export const queryClauseSchema = z.object({
  id: z.string().optional(),
  logicalOperator: z.enum(['AND', 'OR']).default('AND'),
  field: queryFieldSchema,
  operator: queryOperatorSchema,
  value: z.string().optional().default(''),
});

export const queryDefinitionSchema = z.object({
  filters: z.array(queryClauseSchema).default([]),
  sortBy: queryFieldSchema.default('key'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  columns: z
    .array(queryFieldSchema)
    .default(['key', 'type', 'title', 'state', 'priority', 'assignedTo']),
  limit: z.number().int().min(1).max(500).default(100),
});

export const createQuerySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  isShared: z.boolean().optional().default(false),
  folder: z.string().optional().nullable(),
  definition: queryDefinitionSchema,
});

export const updateQuerySchema = createQuerySchema.partial({
  name: true,
  description: true,
  isShared: true,
  folder: true,
});

export const runQuerySchema = z.object({
  definition: queryDefinitionSchema,
});

export type QueryClause = z.infer<typeof queryClauseSchema>;
export type QueryDefinition = z.infer<typeof queryDefinitionSchema>;

export class CreateQueryDto {
  name: string;
  description?: string | null;
  isShared?: boolean;
  folder?: string | null;
  definition: QueryDefinition;
}

export class UpdateQueryDto {
  name?: string;
  description?: string | null;
  isShared?: boolean;
  folder?: string | null;
  definition?: QueryDefinition;
}
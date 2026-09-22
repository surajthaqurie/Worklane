import { z } from 'zod';

/**
 * DTOs & Zod schemas for the Phase 17 delivery-plans module.
 *
 * The Zod schemas are the source of truth for payload validation and are
 * parsed inside the service (mirrors the boards module), while the plain
 * classes give NestJS-friendly request body typings.
 */

export const LINK_TYPES = ['DEPENDS_ON', 'RELATED'] as const;
export type WorkItemLinkType = (typeof LINK_TYPES)[number];

// ─── Delivery plans ─────────────────────────────────────────────────────────

export const CreateDeliveryPlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Plan name is required' })
    .max(255, { message: 'Plan name must be at most 255 characters' }),
  description: z.string().trim().max(4000).optional().nullable(),
  teamIds: z.array(z.string().uuid()).default([]),
});

export const UpdateDeliveryPlanSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  teamIds: z.array(z.string().uuid()).optional(),
});

export const SetPlanTeamsSchema = z.object({
  teamIds: z.array(z.string().uuid()),
});

// ─── Timeline query ─────────────────────────────────────────────────────────

/**
 * Query params for the timeline endpoint.
 * All are optional so the full plan is returned by default; callers can
 * narrow the payload (and avoid loading unnecessary work items) with the
 * team/iteration filters and pagination.
 */
export const TimelineQuerySchema = z.object({
  teamId: z.string().uuid().optional(),
  iterationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ─── Work item links (dependencies) ─────────────────────────────────────────

export const CreateWorkItemLinkSchema = z.object({
  targetWorkItemId: z.string().uuid({ message: 'Valid target work item id required' }),
  linkType: z.enum(LINK_TYPES).default('DEPENDS_ON'),
});

// ─── Plain DTO classes ───────────────────────────────────────────────────────

export class CreateDeliveryPlanDto {
  name!: string;
  description?: string | null;
  teamIds?: string[];
}

export class UpdateDeliveryPlanDto {
  name?: string;
  description?: string | null;
  teamIds?: string[];
}

export class SetPlanTeamsDto {
  teamIds!: string[];
}

export class CreateWorkItemLinkDto {
  targetWorkItemId!: string;
  linkType?: WorkItemLinkType;
}
import { z } from 'zod';

export enum JobType {
  EMAIL_NOTIFICATION = 'EMAIL_NOTIFICATION',
  CSV_IMPORT = 'CSV_IMPORT',
  ANALYTICS_CALCULATION = 'ANALYTICS_CALCULATION',
  ATTACHMENT_PROCESSING = 'ATTACHMENT_PROCESSING',
  CLEANUP = 'CLEANUP',
  SEARCH_INDEXING = 'SEARCH_INDEXING',
}

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

export const dispatchJobSchema = z.object({
  jobType: z.nativeEnum(JobType),
  payload: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
});

export type DispatchJobDto = z.input<typeof dispatchJobSchema>;

export const getJobsQuerySchema = z.object({
  status: z.nativeEnum(JobStatus).optional(),
  jobType: z.nativeEnum(JobType).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GetJobsQueryDto = z.input<typeof getJobsQuerySchema>;

export interface BackgroundJobDto {
  id: string;
  jobType: JobType | string;
  idempotencyKey: string | null;
  status: JobStatus | string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  attempts: number;
  maxRetries: number;
  progress: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

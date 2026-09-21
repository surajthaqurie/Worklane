import type { ConnectionOptions } from 'bullmq';

/**
 * Phase 15 — Background Job Infrastructure
 *
 * Central configuration for the BullMQ-backed background job queue.
 * BullMQ is the project's single queue technology (Redis → BullMQ → Workers).
 */

/** Main queue consumed by the background worker. */
export const BACKGROUND_JOBS_QUEUE = 'worklane-background-jobs';

/** Dead-letter queue where jobs that exhaust their retry budget are parked. */
export const BACKGROUND_JOBS_DEAD_LETTER_QUEUE = 'worklane-background-jobs-dead-letter';

export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_BACKOFF_DELAY_MS = 1000;
export const DEFAULT_WORKER_CONCURRENCY = 10;
export const STALE_PROCESSING_MINUTES_DEFAULT = 15;

/** Retention for completed/failed BullMQ jobs (7 days, capped at 2000 jobs). */
export const JOB_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const JOB_RETENTION_MAX_COUNT = 2000;

/**
 * Redis connection options for BullMQ (Queue and Worker).
 * `maxRetriesPerRequest: null` is required for BullMQ's blocking commands.
 */
export function getRedisConnectionOptions(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };
}

/** Total attempts granted to a job (defaults to maxRetries from the DTO). */
export function getDefaultMaxRetries(): number {
  return clampInt(process.env.JOB_DEFAULT_MAX_RETRIES, DEFAULT_MAX_RETRIES, 1, 10);
}

/** Base delay in ms for the exponential backoff curve. */
export function getBackoffDelayMs(): number {
  return clampInt(process.env.JOB_BACKOFF_DELAY_MS, DEFAULT_BACKOFF_DELAY_MS, 1, 60_000);
}

export function getWorkerConcurrency(): number {
  return clampInt(process.env.JOB_WORKER_CONCURRENCY, DEFAULT_WORKER_CONCURRENCY, 1, 100);
}

export function getStaleProcessingMinutes(): number {
  return clampInt(
    process.env.JOB_STALE_PROCESSING_MINUTES,
    STALE_PROCESSING_MINUTES_DEFAULT,
    1,
    24 * 60,
  );
}

/** Whether the in-process BullMQ worker should start (disabled in some environments). */
export function isWorkerEnabled(): boolean {
  return process.env.JOB_WORKER_ENABLED !== 'false';
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
import { Logger } from '@nestjs/common';

/**
 * Phase 15 — Structured logging for background jobs.
 *
 * Every job lifecycle event is emitted with a machine-readable event name plus
 * correlation fields (jobId, jobType, attempt, durationMs, queueJobId) so logs
 * can be filtered/traced across retries and worker instances.
 */
export interface JobLogFields {
  event: string;
  jobId?: string;
  queueJobId?: string;
  jobType?: string;
  attempt?: number;
  maxRetries?: number;
  progress?: number;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

export type JobLogLevel = 'log' | 'warn' | 'error' | 'debug';

export function logJobEvent(logger: Logger, level: JobLogLevel, fields: JobLogFields): void {
  const message = `[background-jobs] ${fields.event}${fields.jobId ? ` job=${fields.jobId}` : ''}${fields.jobType ? ` type=${fields.jobType}` : ''}${fields.attempt ? ` attempt=${fields.attempt}` : ''}`;

  switch (level) {
    case 'warn':
      logger.warn(message, JSON.stringify(fields));
      break;
    case 'error':
      logger.error(message, JSON.stringify(fields));
      break;
    case 'debug':
      logger.debug(message, JSON.stringify(fields));
      break;
    default:
      logger.log(message, JSON.stringify(fields));
      break;
  }
}

/** Small perf helper for recording handler wall-time. */
export function durationSince(startedAtMs: number): number {
  return Date.now() - startedAtMs;
}
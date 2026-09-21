import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  BACKGROUND_JOBS_DEAD_LETTER_QUEUE,
  BACKGROUND_JOBS_QUEUE,
  DEFAULT_MAX_RETRIES,
  JOB_RETENTION_MAX_COUNT,
  JOB_RETENTION_SECONDS,
  getBackoffDelayMs,
  getRedisConnectionOptions,
} from '../background-jobs.constants.js';
import type { DispatchJobDto } from '../dto/background-job.dto.js';
import { logJobEvent } from '../background-jobs.logger.js';

export interface QueueJobData {
  /** Primary key of the background_jobs row — the correlation id. */
  jobId: string;
  payload: Record<string, unknown>;
}

export interface EnqueueOptions {
  attempts?: number;
  backoffDelayMs?: number;
}

/**
 * Thin wrapper around the BullMQ Queue for background jobs.
 *
 * It is the only queue in the system (plus its mirror dead-letter queue) and
 * provides:
 *  - idempotent enqueue via BullMQ's `jobId` option (a job id already in the
 *    queue is never added twice),
 *  - per-job attempts with exponential backoff,
 *  - retention policies so completed/failed jobs do not accumulate forever.
 */
@Injectable()
export class BackgroundJobsQueue implements OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobsQueue.name);
  private readonly queue: Queue<QueueJobData>;
  private readonly deadLetterQueue: Queue;

  constructor() {
    const connection = getRedisConnectionOptions();

    this.queue = new Queue<QueueJobData>(BACKGROUND_JOBS_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: DEFAULT_MAX_RETRIES,
        backoff: { type: 'exponential', delay: getBackoffDelayMs() },
        removeOnComplete: { age: JOB_RETENTION_SECONDS, count: JOB_RETENTION_MAX_COUNT },
        removeOnFail: { age: JOB_RETENTION_SECONDS, count: JOB_RETENTION_MAX_COUNT },
      },
    });

    this.deadLetterQueue = new Queue(BACKGROUND_JOBS_DEAD_LETTER_QUEUE, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { age: JOB_RETENTION_SECONDS, count: JOB_RETENTION_MAX_COUNT },
        removeOnFail: { age: JOB_RETENTION_SECONDS, count: JOB_RETENTION_MAX_COUNT },
      },
    });
  }

  /**
   * Adds a job to the queue. Passing `jobId` makes BullMQ treat repeated adds
   * of the same job as no-ops (duplicate-execution protection).
   */
  async enqueue(dto: DispatchJobDto, dbJobId: string, opts: EnqueueOptions = {}): Promise<string> {
    const attempts = Math.max(1, opts.attempts ?? dto.maxRetries ?? DEFAULT_MAX_RETRIES);
    const added = await this.queue.add(
      dto.jobType,
      { jobId: dbJobId, payload: dto.payload ?? {} },
      {
        jobId: dbJobId,
        attempts,
        backoff: { type: 'exponential', delay: opts.backoffDelayMs ?? getBackoffDelayMs() },
      },
    );

    if (dbJobId === added.id) {
      logJobEvent(this.logger, 'debug', {
        event: 'queue.enqueued',
        jobId: dbJobId,
        jobType: dto.jobType,
        queueJobId: String(added.id),
        attempts,
      });
    } else {
      logJobEvent(this.logger, 'debug', {
        event: 'queue.duplicate',
        jobId: dbJobId,
        jobType: dto.jobType,
        queueJobId: String(added.id),
      });
    }

    return added.id as string;
  }

  /** Parks an exhausted job into the dedicated dead-letter queue. */
  async enqueueDeadLetter(data: {
    jobId: string;
    jobType: string;
    payload: Record<string, unknown>;
    failureReason: string;
    failedAt: string;
  }): Promise<string | null> {
    try {
      const added = await this.deadLetterQueue.add(data.jobType, data, { jobId: data.jobId });
      return (added.id ?? null) as string | null;
    } catch (err: any) {
      logJobEvent(this.logger, 'error', {
        event: 'queue.deadLetter.enqueueFailed',
        jobId: data.jobId,
        jobType: data.jobType,
        error: err?.message || String(err),
      });
      return null;
    }
  }

  /** Removes a job from the main queue (any state). Missing jobs are ignored. */
  async removeJobIfExists(jobId: string): Promise<void> {
    try {
      await this.queue.remove(jobId);
    } catch {
      // Job not in any state in the queue — nothing to remove.
    }
  }

  async getJob(jobId: string) {
    return this.queue.getJob(jobId);
  }

  async getDeadLetterJob(jobId: string) {
    return (await this.deadLetterQueue.getJob(jobId)) ?? null;
  }

  async countDeadLetterJobs(): Promise<number> {
    return this.deadLetterQueue.count();
  }

  /** Aggregate queue state — used for ops/monitoring, never exposed to users. */
  async getQueueStats() {
    const [counts, dlqCount] = await Promise.all([
      this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed'),
      this.deadLetterQueue.count(),
    ]);
    return { queue: this.queue.name, ...counts, deadLetter: dlqCount } as Record<string, unknown>;
  }

  get queueName(): string {
    return this.queue.name;
  }

  get deadLetterQueueName(): string {
    return this.deadLetterQueue.name;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.queue.close(), this.deadLetterQueue.close()]);
    logJobEvent(this.logger, 'debug', { event: 'queue.closed' });
  }
}
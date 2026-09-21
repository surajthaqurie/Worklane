import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { BackgroundJobsRepository } from '../background-jobs.repository.js';
import { BackgroundJobsProcessor } from '../background-jobs.processor.js';
import { BackgroundJobsQueue, QueueJobData } from './background-jobs.queue.js';
import {
  BACKGROUND_JOBS_QUEUE,
  getRedisConnectionOptions,
  getWorkerConcurrency,
  isWorkerEnabled,
} from '../background-jobs.constants.js';
import { JobStatus } from '../dto/background-job.dto.js';
import { durationSince, logJobEvent } from '../background-jobs.logger.js';

/**
 * BullMQ Worker consuming the background-jobs queue.
 *
 * Responsibilities:
 *  - mark the DB row PROCESSING and persist attempts/progress as the handler runs,
 *  - delegate execution to BackgroundJobsProcessor (per job type handlers),
 *  - persist COMPLETED results,
 *  - on failure: rely on BullMQ's exponential backoff for retries; when a job
 *    exhausts its retry budget it is marked DEAD_LETTER in the DB and parked in
 *    the dead-letter queue for operational review.
 */
@Injectable()
export class BackgroundJobsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobsWorker.name);
  private worker: Worker<QueueJobData, unknown> | null = null;

  constructor(
    private readonly repo: BackgroundJobsRepository,
    private readonly processor: BackgroundJobsProcessor,
    private readonly queue: BackgroundJobsQueue,
  ) {}

  onModuleInit(): void {
    if (!isWorkerEnabled()) {
      this.logger.log('Background job worker disabled (JOB_WORKER_ENABLED=false)');
      return;
    }

    this.worker = new Worker<QueueJobData, unknown>(
      BACKGROUND_JOBS_QUEUE,
      async (job) => this.processJob(job),
      {
        connection: getRedisConnectionOptions(),
        concurrency: getWorkerConcurrency(),
      },
    );

    this.worker.on('completed', (job) => {
      if (!job) return;
      logJobEvent(this.logger, 'log', { event: 'worker.completed', jobId: job.data.jobId, queueJobId: String(job.id) });
    });

    this.worker.on('failed', (job, error) => this.onJobFailed(job, error));

    this.worker.on('error', (error) => {
      logJobEvent(this.logger, 'error', { event: 'worker.error', error: error?.message || String(error) });
    });

    this.logger.log(`Background job worker started (queue=${BACKGROUND_JOBS_QUEUE})`);
  }

  private async processJob(bullJob: Job<QueueJobData, unknown>) {
    const { jobId } = bullJob.data;
    const record = await this.repo.findById(jobId);

    if (!record) {
      throw new Error(`Background job record '${jobId}' not found`);
    }

    // Idempotent ignore: the row is already completed (e.g. leftover from a
    // duplicate enqueue or a post-recovery duplicate) — do not run it again.
    if (record.status === JobStatus.COMPLETED) {
      logJobEvent(this.logger, 'debug', {
        event: 'worker.skipped',
        jobId,
        jobType: record.jobType,
        queueJobId: String(bullJob.id),
        reason: 'job-already-completed',
      });
      return { jobId, skipped: true };
    }

    const attempt = record.attempts + 1;
    const startedAtMs = Date.now();

    await this.repo.updateJob(jobId, {
      status: JobStatus.PROCESSING,
      attempts: attempt,
      startedAt: new Date(),
      errorMessage: null,
    });

    logJobEvent(this.logger, 'log', {
      event: 'job.processing',
      jobId,
      jobType: record.jobType,
      attempt,
      maxRetries: record.maxRetries,
      queueJobId: String(bullJob.id),
    });

    const result = await this.processor.executeJobTask(
      record,
      attempt,
      async (progress: number) => {
        await this.repo.updateJob(jobId, { progress });
        await bullJob.updateProgress(progress);
      },
    );

    await this.repo.updateJob(jobId, {
      status: JobStatus.COMPLETED,
      progress: 100,
      result: result ?? null,
      errorMessage: null,
      completedAt: new Date(),
    });

    logJobEvent(this.logger, 'log', {
      event: 'job.completed',
      jobId,
      jobType: record.jobType,
      attempt,
      durationMs: durationSince(startedAtMs),
      queueJobId: String(bullJob.id),
    });

    return { jobId, result, skipped: false };
  }

  /**
   * Failure handling for both intermediate retries and final dead-lettering.
   * Called by BullMQ only after the handler threw and the attempt concluded.
   */
  private async onJobFailed(
    bullJob: Job<QueueJobData, unknown> | undefined,
    error: Error,
  ): Promise<void> {
    if (!bullJob) return;
    const { jobId } = bullJob.data;
    const totalAttempts = bullJob.opts.attempts ?? 1;
    const exhausted = bullJob.attemptsMade >= totalAttempts;
    const failureReason = error?.message || String(error);

    if (exhausted) {
      await this.repo.updateJob(jobId, {
        status: JobStatus.DEAD_LETTER,
        errorMessage: `Dead-letter: max retries (${totalAttempts}) exceeded. Last error: ${failureReason}`,
        completedAt: new Date(),
      });

      await this.queue.enqueueDeadLetter({
        jobId,
        jobType: String(bullJob.name),
        payload: bullJob.data.payload,
        failureReason,
        failedAt: new Date().toISOString(),
      });

      logJobEvent(this.logger, 'error', {
        event: 'job.deadLetter',
        jobId,
        jobType: String(bullJob.name),
        attempt: bullJob.attemptsMade,
        maxRetries: totalAttempts,
        error: failureReason,
      });
    } else {
      await this.repo.updateJob(jobId, {
        status: JobStatus.FAILED,
        errorMessage: `Attempt ${bullJob.attemptsMade} failed: ${failureReason}. Retrying with exponential backoff...`,
      });

      logJobEvent(this.logger, 'warn', {
        event: 'job.retryScheduled',
        jobId,
        jobType: String(bullJob.name),
        attempt: bullJob.attemptsMade,
        maxRetries: totalAttempts,
        error: failureReason,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
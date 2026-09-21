import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { BackgroundJobsRepository } from './background-jobs.repository.js';
import { BackgroundJobsQueue } from './queue/background-jobs.queue.js';
import {
  getBackoffDelayMs,
  getStaleProcessingMinutes,
} from './background-jobs.constants.js';
import {
  BackgroundJobDto,
  DispatchJobDto,
  GetJobsQueryDto,
  JobStatus,
  JobType,
} from './dto/background-job.dto.js';
import { logJobEvent } from './background-jobs.logger.js';

@Injectable()
export class BackgroundJobsService {
  private readonly logger = new Logger(BackgroundJobsService.name);

  constructor(
    private readonly repo: BackgroundJobsRepository,
    private readonly queue: BackgroundJobsQueue,
  ) {}

  /**
   * Dispatches a background job through BullMQ (Redis → BullMQ → Workers).
   *
   * Idempotency is enforced in two layers:
   *  1. a unique `idempotency_key` on the background_jobs row, and
   *  2. BullMQ's `jobId` deduplication (a job id cannot be queued twice).
   */
  async dispatchJob(dto: DispatchJobDto): Promise<{ job: BackgroundJobDto; isDuplicate: boolean }> {
    const { job, isDuplicate } = await this.repo.createJob(dto);

    if (isDuplicate) {
      logJobEvent(this.logger, 'debug', {
        event: 'job.duplicate',
        jobId: job.id,
        jobType: job.jobType,
        idempotencyKey: dto.idempotencyKey,
      });
      return { job, isDuplicate: true };
    }

    const queueJobId = await this.queue.enqueue(dto, job.id);

    logJobEvent(this.logger, 'log', {
      event: 'job.dispatched',
      jobId: job.id,
      jobType: job.jobType,
      queueJobId,
      maxRetries: job.maxRetries,
      backoffDelayMs: getBackoffDelayMs(),
    });

    return { job, isDuplicate: false };
  }

  async getJobStatus(jobId: string): Promise<BackgroundJobDto> {
    const job = await this.repo.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Background job with ID '${jobId}' not found`);
    }
    return job;
  }

  /**
   * Recovers and retries a failed or dead-lettered job by re-queuing it.
   * Only FAILED and DEAD_LETTER jobs can be retried.
   */
  async retryJob(jobId: string): Promise<BackgroundJobDto> {
    const job = await this.getJobStatus(jobId);

    if (job.status !== JobStatus.FAILED && job.status !== JobStatus.DEAD_LETTER) {
      throw new BadRequestException(
        `Job ${jobId} is in state '${job.status}' and cannot be retried. Only FAILED or DEAD_LETTER jobs can be retried.`,
      );
    }

    // Reset attempts/status so the retried run starts from a clean slate.
    const updated = await this.repo.updateJob(jobId, {
      status: JobStatus.PENDING,
      attempts: 0,
      errorMessage: null,
      progress: 0,
      startedAt: null,
      completedAt: null,
    });

    // Drop the old (failed/dead-lettered) BullMQ job, then re-enqueue fresh.
    await this.queue.removeJobIfExists(jobId);
    const queueJobId = await this.queue.enqueue(
      {
        jobType: job.jobType as JobType,
        payload: job.payload,
        maxRetries: Math.max(1, job.maxRetries),
        idempotencyKey: job.idempotencyKey ?? undefined,
      },
      jobId,
    );

    logJobEvent(this.logger, 'log', {
      event: 'job.retried',
      jobId,
      jobType: job.jobType,
      queueJobId,
      maxRetries: job.maxRetries,
    });

    return updated!;
  }

  async listJobs(query: GetJobsQueryDto): Promise<BackgroundJobDto[]> {
    return this.repo.getJobs(query);
  }

  /**
   * Recovery pass for jobs stuck in PROCESSING (e.g. a worker crashed mid-job).
   * Such jobs are reset to PENDING and re-queued for another attempt.
   */
  async recoverStaleJobs(sinceMinutes = getStaleProcessingMinutes()): Promise<{ recovered: number; jobIds: string[] }> {
    const stale = await this.repo.findStaleProcessing(sinceMinutes);
    const jobIds: string[] = [];

    for (const job of stale) {
      await this.repo.updateJob(job.id, {
        status: JobStatus.PENDING,
        errorMessage: 'Recovered: job was stuck in PROCESSING and has been re-queued',
        startedAt: null,
      });

      await this.queue.removeJobIfExists(job.id);
      await this.queue.enqueue(
        {
          jobType: job.jobType as JobType,
          payload: job.payload,
          maxRetries: Math.max(1, job.maxRetries),
          idempotencyKey: job.idempotencyKey ?? undefined,
        },
        job.id,
      );

      jobIds.push(job.id);
      logJobEvent(this.logger, 'log', { event: 'job.recovered', jobId: job.id, jobType: job.jobType });
    }

    if (jobIds.length > 0) {
      logJobEvent(this.logger, 'log', { event: 'job.recovery.summary', recovered: jobIds.length });
    }

    return { recovered: jobIds.length, jobIds };
  }
}
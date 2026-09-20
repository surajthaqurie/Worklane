import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { BackgroundJobsRepository } from './background-jobs.repository.js';
import { BackgroundJobsProcessor } from './background-jobs.processor.js';
import { BackgroundJobDto, DispatchJobDto, GetJobsQueryDto, JobStatus } from './dto/background-job.dto.js';

@Injectable()
export class BackgroundJobsService {
  private readonly logger = new Logger(BackgroundJobsService.name);

  constructor(
    private readonly repo: BackgroundJobsRepository,
    private readonly processor: BackgroundJobsProcessor,
  ) {}

  /**
   * Dispatches a background job with idempotency support and asynchronous execution.
   */
  async dispatchJob(dto: DispatchJobDto, executeImmediately = true): Promise<{ job: BackgroundJobDto; isDuplicate: boolean }> {
    const { job, isDuplicate } = await this.repo.createJob(dto);

    if (isDuplicate) {
      this.logger.debug(`Idempotency key matched for key '${dto.idempotencyKey}'. Returning existing job ${job.id}`);
      return { job, isDuplicate: true };
    }

    if (executeImmediately) {
      // Fire-and-forget processing in background thread
      this.processor.processJob(job.id).catch((err) => {
        this.logger.error(`Background worker error processing job ${job.id}: ${err?.message || err}`);
      });
    }

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
   * Recovers and retries a failed or dead-letter job
   */
  async retryJob(jobId: string, executeImmediately = true): Promise<BackgroundJobDto> {
    const job = await this.getJobStatus(jobId);

    if (job.status !== JobStatus.FAILED && job.status !== JobStatus.DEAD_LETTER) {
      throw new BadRequestException(`Job ${jobId} is in state '${job.status}' and cannot be retried. Only FAILED or DEAD_LETTER jobs can be retried.`);
    }

    // Reset attempts and status for recovery
    const updated = await this.repo.updateJob(jobId, {
      status: JobStatus.PENDING,
      attempts: 0,
      errorMessage: null,
      progress: 0,
    });

    this.logger.log(`Manual recovery triggered for dead-letter/failed job ${jobId}`);

    if (executeImmediately) {
      // Fire processing in background
      this.processor.processJob(jobId).catch((err) => {
        this.logger.error(`Error during manual retry execution for job ${jobId}: ${err?.message || err}`);
      });
    }

    return updated!;
  }

  async listJobs(query: GetJobsQueryDto): Promise<BackgroundJobDto[]> {
    return this.repo.getJobs(query);
  }
}

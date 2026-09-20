import { Injectable, Logger } from '@nestjs/common';
import { BackgroundJobsRepository } from './background-jobs.repository.js';
import { BackgroundJobDto, JobStatus, JobType } from './dto/background-job.dto.js';

@Injectable()
export class BackgroundJobsProcessor {
  private readonly logger = new Logger(BackgroundJobsProcessor.name);

  constructor(private readonly repo: BackgroundJobsRepository) {}

  /**
   * Main entrypoint to process a job with retry, exponential backoff, progress tracking, and DLQ handling.
   */
  async processJob(jobId: string): Promise<BackgroundJobDto> {
    const job = await this.repo.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === JobStatus.COMPLETED) {
      this.logger.debug(`Job ${jobId} already completed (idempotent ignore)`);
      return job;
    }

    const currentAttempts = job.attempts + 1;
    await this.repo.updateJob(jobId, {
      status: JobStatus.PROCESSING,
      attempts: currentAttempts,
      startedAt: new Date(),
    });

    try {
      this.logger.log(`Starting execution of job ${jobId} (type: ${job.jobType}, attempt: ${currentAttempts}/${job.maxRetries})`);

      const result = await this.executeJobTask(job, currentAttempts, async (progress) => {
        await this.repo.updateJob(jobId, { progress });
      });

      const completedJob = await this.repo.updateJob(jobId, {
        status: JobStatus.COMPLETED,
        progress: 100,
        result,
        errorMessage: null,
        completedAt: new Date(),
      });

      this.logger.log(`Job ${jobId} completed successfully`);
      return completedJob!;
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      this.logger.warn(`Execution failed for job ${jobId} (attempt ${currentAttempts}/${job.maxRetries}): ${errorMessage}`);

      if (currentAttempts < job.maxRetries) {
        // Calculate exponential backoff delay (ms): e.g. 100ms, 200ms, 400ms...
        const backoffMs = Math.min(10000, 100 * Math.pow(2, currentAttempts - 1));
        
        await this.repo.updateJob(jobId, {
          status: JobStatus.PENDING,
          errorMessage: `Attempt ${currentAttempts} failed: ${errorMessage}. Retrying in ${backoffMs}ms...`,
        });

        this.logger.log(`Scheduled retry for job ${jobId} with exponential backoff ${backoffMs}ms`);
        
        // Wait exponential backoff in background worker then retry
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.processJob(jobId);
      } else {
        // Dead-Letter / Failure handling after max retries exceeded
        const deadLetterJob = await this.repo.updateJob(jobId, {
          status: JobStatus.DEAD_LETTER,
          errorMessage: `Dead-letter: Max retries (${job.maxRetries}) exceeded. Last error: ${errorMessage}`,
          completedAt: new Date(),
        });

        this.logger.error(`Job ${jobId} moved to DEAD_LETTER queue after ${currentAttempts} failed attempts`);
        return deadLetterJob!;
      }
    }
  }

  /**
   * Internal job execution dispatcher for the supported job types
   */
  private async executeJobTask(
    job: BackgroundJobDto,
    currentAttempt: number,
    onProgress: (progress: number) => Promise<void>,
  ): Promise<Record<string, any>> {
    const payload = job.payload || {};

    // Simulate intentional failure test payload flag
    if (payload.shouldFail === true && currentAttempt <= (payload.failUntilAttempt as number || 999)) {
      throw new Error((payload.failureMessage as string) || 'Simulated processing failure');
    }

    switch (job.jobType) {
      case JobType.EMAIL_NOTIFICATION: {
        await onProgress(25);
        const recipient = (payload.recipient as string) || 'user@worklane.dev';
        const subject = (payload.subject as string) || 'Notification';
        await onProgress(75);
        return { delivered: true, recipient, subject, sentAt: new Date().toISOString() };
      }

      case JobType.CSV_IMPORT: {
        const rowCount = (payload.rowCount as number) || 50;
        await onProgress(30);
        await onProgress(70);
        return { importedCount: rowCount, status: 'SUCCESS' };
      }

      case JobType.ANALYTICS_CALCULATION: {
        const projectId = (payload.projectId as string) || 'global';
        await onProgress(50);
        return { projectId, rollupCompleted: true, calculatedAt: new Date().toISOString() };
      }

      case JobType.ATTACHMENT_PROCESSING: {
        const fileKey = (payload.fileKey as string) || 'sample.png';
        await onProgress(40);
        await onProgress(80);
        return { fileKey, virusScanned: true, thumbnailGenerated: true };
      }

      case JobType.CLEANUP: {
        await onProgress(50);
        return { purgedTokens: 12, purgedTempFiles: 5, status: 'CLEAN' };
      }

      case JobType.SEARCH_INDEXING: {
        const itemsIndexed = (payload.itemsCount as number) || 100;
        await onProgress(60);
        return { indexedItems: itemsIndexed, searchRegistryUpdated: true };
      }

      default: {
        await onProgress(50);
        return { processed: true, jobType: job.jobType };
      }
    }
  }
}

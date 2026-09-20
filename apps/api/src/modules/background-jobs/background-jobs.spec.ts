import { describe, it, expect, beforeEach } from 'vitest';
import { BackgroundJobsRepository } from './background-jobs.repository.js';
import { BackgroundJobsProcessor } from './background-jobs.processor.js';
import { BackgroundJobsService } from './background-jobs.service.js';
import { JobStatus, JobType } from './dto/background-job.dto.js';
import { db } from '../../db/kysely.js';

describe('Worklane Phase 15 — Background Job Infrastructure', () => {
  let repo: BackgroundJobsRepository;
  let processor: BackgroundJobsProcessor;
  let service: BackgroundJobsService;

  beforeEach(() => {
    repo = new BackgroundJobsRepository();
    processor = new BackgroundJobsProcessor(repo);
    service = new BackgroundJobsService(repo, processor);
  });

  it('successfully processes a background job and updates status & progress', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.EMAIL_NOTIFICATION,
      payload: { recipient: 'dev@worklane.io', subject: 'Sprint Alert' },
      maxRetries: 3,
    }, false); // Do not run fire-and-forget in background thread, call processor directly for deterministic assertion

    expect(job.status).toBe(JobStatus.PENDING);
    expect(job.attempts).toBe(0);

    const completed = await processor.processJob(job.id);

    expect(completed.status).toBe(JobStatus.COMPLETED);
    expect(completed.progress).toBe(100);
    expect(completed.attempts).toBe(1);
    expect(completed.result).toMatchObject({
      delivered: true,
      recipient: 'dev@worklane.io',
      subject: 'Sprint Alert',
    });
  });

  it('enforces idempotency and prevents duplicate executions when idempotencyKey is provided', async () => {
    const idempotencyKey = `job-idem-${Date.now()}`;

    const res1 = await service.dispatchJob({
      jobType: JobType.CSV_IMPORT,
      payload: { rowCount: 100 },
      idempotencyKey,
    }, false);

    expect(res1.isDuplicate).toBe(false);

    const res2 = await service.dispatchJob({
      jobType: JobType.CSV_IMPORT,
      payload: { rowCount: 100 },
      idempotencyKey,
    }, false);

    expect(res2.isDuplicate).toBe(true);
    expect(res2.job.id).toBe(res1.job.id);
  });

  it('handles automatic retries and exponential backoff on transient failure', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.ATTACHMENT_PROCESSING,
      payload: {
        shouldFail: true,
        failUntilAttempt: 1, // Fail on attempt 1, succeed on attempt 2
        failureMessage: 'Transient storage timeout',
      },
      maxRetries: 3,
    }, false);

    const result = await processor.processJob(job.id);

    expect(result.status).toBe(JobStatus.COMPLETED);
    expect(result.attempts).toBe(2);
    expect(result.progress).toBe(100);
  });

  it('moves job to DEAD_LETTER status after exceeding maxRetries', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.ANALYTICS_CALCULATION,
      payload: {
        shouldFail: true,
        failUntilAttempt: 10, // Always fail
        failureMessage: 'Unrecoverable database error',
      },
      maxRetries: 2,
    }, false);

    const dlqJob = await processor.processJob(job.id);

    expect(dlqJob.status).toBe(JobStatus.DEAD_LETTER);
    expect(dlqJob.attempts).toBe(2);
    expect(dlqJob.errorMessage).toContain('Dead-letter: Max retries (2) exceeded');
  });

  it('recovers a DEAD_LETTER job when retryJob is triggered', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.CLEANUP,
      payload: {
        shouldFail: true,
        failUntilAttempt: 1,
        failureMessage: 'Cleanup lock contention',
      },
      maxRetries: 1,
    }, false);

    // Initial execution leads to DEAD_LETTER because maxRetries=1 and it failed on attempt 1
    const dlqJob = await processor.processJob(job.id);
    expect(dlqJob.status).toBe(JobStatus.DEAD_LETTER);

    // Disable failure flag for recovery attempt
    await repo.updateJob(job.id, {
      payload: { shouldFail: false },
    });

    // Trigger manual recovery
    const retriedJob = await service.retryJob(job.id, false);
    expect(retriedJob.status).toBe(JobStatus.PENDING);
    expect(retriedJob.attempts).toBe(0);

    // Execute recovered job
    const finalJob = await processor.processJob(job.id);
    expect(finalJob.status).toBe(JobStatus.COMPLETED);
    expect(finalJob.result).toMatchObject({ status: 'CLEAN' });
  });

  it('queries job status and lists jobs by status filter', async () => {
    const { job: job1 } = await service.dispatchJob({
      jobType: JobType.SEARCH_INDEXING,
      payload: { itemsCount: 50 },
    }, false);

    const fetched = await service.getJobStatus(job1.id);
    expect(fetched.id).toBe(job1.id);

    const pendingJobs = await service.listJobs({ status: JobStatus.PENDING });
    expect(pendingJobs.some((j) => j.id === job1.id)).toBe(true);
  });
});

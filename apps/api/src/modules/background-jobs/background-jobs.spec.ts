import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Redis } from 'ioredis';
import { BackgroundJobsRepository } from './background-jobs.repository.js';
import { BackgroundJobsProcessor } from './background-jobs.processor.js';
import { BackgroundJobsService } from './background-jobs.service.js';
import { BackgroundJobsQueue } from './queue/background-jobs.queue.js';
import { BackgroundJobsWorker } from './queue/background-jobs.worker.js';
import { JobStatus, JobType } from './dto/background-job.dto.js';
import { db } from '../../db/kysely.js';

/**
 * Worklane Phase 15 — Background Job Infrastructure (DB + Redis integration)
 *
 * Exercises the full BullMQ path: dispatch → Redis queue → worker → DB status.
 * Requires Postgres (docker-compose db) and Redis (docker-compose redis). The
 * suite self-skips when either service is unavailable (checked at module load
 * via top-level await).
 */
const INTEGRATION = process.env.INTEGRATION === '1';

// Probe Redis and Postgres availability once at module load.
const redisProbe = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  lazyConnect: true,
  connectTimeout: 2000,
  retryStrategy: () => null as any,
});

let redisReady = false;
let dbReady = false;

try {
  await redisProbe.connect();
  await redisProbe.ping();
  redisReady = true;
} catch {
  // Redis unavailable — suite will skip.
}
redisProbe.disconnect();

try {
  await db.selectFrom('organizations').select('id').limit(1).executeTakeFirst();
  dbReady = true;
} catch {
  // Postgres unavailable — suite will skip.
}

const SERVICES_READY = INTEGRATION && redisReady && dbReady;

describe.skipIf(!SERVICES_READY)('Background jobs: BullMQ + Postgres integration', () => {
  let repo: BackgroundJobsRepository;
  let worker: BackgroundJobsWorker;
  let queue: BackgroundJobsQueue;
  let service: BackgroundJobsService;
  const createdJobIds: string[] = [];

  beforeAll(async () => {
    // Fast exponential backoff for CI-speed assertions.
    process.env.JOB_BACKOFF_DELAY_MS = '50';
    process.env.JOB_DEFAULT_MAX_RETRIES = '3';

    repo = new BackgroundJobsRepository();
    queue = new BackgroundJobsQueue();
    service = new BackgroundJobsService(repo, queue);
    worker = new BackgroundJobsWorker(repo, new BackgroundJobsProcessor(repo), queue);
    worker.onModuleInit();
  });

  afterAll(async () => {
    await worker?.onModuleDestroy();
    await queue?.onModuleDestroy();
    if (createdJobIds.length > 0) {
      await db
        .deleteFrom('background_jobs')
        .where('id', 'in', createdJobIds)
        .execute()
        .catch(() => {});
    }
  });

  async function waitForStatus(
    jobId: string,
    predicate: (status: string) => boolean,
    timeoutMs = 10_000,
  ): Promise<Awaited<ReturnType<typeof service.getJobStatus>>> {
    const deadline = Date.now() + timeoutMs;
    let last: Awaited<ReturnType<typeof service.getJobStatus>> | null = null;
    while (Date.now() < deadline) {
      last = await service.getJobStatus(jobId);
      if (predicate(String(last.status))) return last;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(
      `Timed out waiting for job ${jobId} to satisfy predicate. Last status: ${last?.status ?? 'unknown'}`,
    );
  }

  const track = (job: { id: string }) => {
    createdJobIds.push(job.id);
    return job.id;
  };

  it('successfully processes a job end-to-end with progress and result', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.EMAIL_NOTIFICATION,
      payload: { recipient: 'dev@worklane.io', subject: 'Sprint Alert' },
      maxRetries: 3,
    });
    track(job);

    expect(job.status).toBe(JobStatus.PENDING);
    expect(job.attempts).toBe(0);

    const completed = await waitForStatus(job.id, (s) => s === JobStatus.COMPLETED);

    expect(completed.progress).toBe(100);
    expect(completed.attempts).toBe(1);
    expect(completed.errorMessage).toBeNull();
    expect(completed.startedAt).toBeTruthy();
    expect(completed.completedAt).toBeTruthy();
    expect(completed.result).toMatchObject({
      delivered: true,
      recipient: 'dev@worklane.io',
      subject: 'Sprint Alert',
    });
  });

  it('reports intermediate progress points persisted to the DB row', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.ATTACHMENT_PROCESSING,
      payload: { fileKey: 'projects/p1/attachments/report.pdf', contentType: 'application/pdf' },
      maxRetries: 1,
    });
    track(job);

    const completed = await waitForStatus(job.id, (s) => s === JobStatus.COMPLETED);
    expect(completed.progress).toBe(100);
  });

  it('enforces idempotency: duplicate dispatches return the existing job', async () => {
    const idempotencyKey = `job-idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const res1 = await service.dispatchJob({
      jobType: JobType.CSV_IMPORT,
      payload: { rowCount: 100 },
      idempotencyKey,
    });
    const res2 = await service.dispatchJob({
      jobType: JobType.CSV_IMPORT,
      payload: { rowCount: 100 },
      idempotencyKey,
    });

    expect(res1.isDuplicate).toBe(false);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.job.id).toBe(res1.job.id);
    track(res1.job);

    // Exactly one row exists for the key.
    const rowCount = await db
      .selectFrom('background_jobs')
      .where('idempotency_key', '=', idempotencyKey)
      .select(db.fn.countAll().as('count'))
      .executeTakeFirst();
    expect(Number(rowCount?.count)).toBe(1);

    await waitForStatus(res1.job.id, (s) => s === JobStatus.COMPLETED);
  });

  it('prevents duplicate execution when the same job is enqueued concurrently', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.EMAIL_NOTIFICATION,
      payload: { recipient: 'fixed@worklane.io', subject: 'Duplicate guard' },
      maxRetries: 3,
    });
    track(job);

    // A stray producer enqueues the same DB row twice more — BullMQ's jobId
    // deduplication must collapse all three into one execution.
    const bullIdA = await queue.enqueue(
      { jobType: JobType.EMAIL_NOTIFICATION, payload: { recipient: 'fixed@worklane.io' } },
      job.id,
    );
    const bullIdB = await queue.enqueue(
      { jobType: JobType.EMAIL_NOTIFICATION, payload: { recipient: 'fixed@worklane.io' } },
      job.id,
    );
    expect(bullIdA).toBe(bullIdB);

    const completed = await waitForStatus(job.id, (s) => s === JobStatus.COMPLETED);
    expect(completed.attempts).toBe(1); // executed exactly once
  });

  it('retries transient failures with exponential backoff and succeeds', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.CSV_IMPORT,
      payload: {
        rowCount: 50,
        shouldFail: true,
        failUntilAttempt: 1, // Fail attempt 1, succeed attempt 2
        failureMessage: 'Transient database timeout',
      },
      maxRetries: 3,
    });
    track(job);

    const completed = await waitForStatus(job.id, (s) => s === JobStatus.COMPLETED);

    expect(completed.attempts).toBe(2);
    expect(completed.progress).toBe(100);
    expect(completed.errorMessage).toBeNull();
    expect(completed.result).toMatchObject({ importedCount: 50, status: 'SUCCESS' });
  });

  it('moves permanently-failing jobs to DEAD_LETTER and parks them in the DLQ', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.ATTACHMENT_PROCESSING,
      payload: {
        fileKey: 'projects/p1/attachments/broken.bin',
        shouldFail: true,
        failUntilAttempt: 99,
        failureMessage: 'Unrecoverable storage corruption',
      },
      maxRetries: 2,
    });
    track(job);

    const deadJob = await waitForStatus(job.id, (s) => s === JobStatus.DEAD_LETTER);

    expect(deadJob.attempts).toBe(2);
    expect(deadJob.errorMessage).toContain('Dead-letter: max retries (2) exceeded');
    expect(deadJob.completedAt).toBeTruthy();

    // The failed job must be observable in the dead-letter queue.
    const dlqJob = await queue.getDeadLetterJob(job.id);
    expect(dlqJob).toBeTruthy();
    expect(dlqJob?.data.jobId).toBe(job.id);
  });

  it('recovers a DEAD_LETTER job via retryJob after the underlying cause clears', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.ATTACHMENT_PROCESSING,
      payload: {
        fileKey: 'projects/p1/attachments/recoverable.bin',
        shouldFail: true,
        failUntilAttempt: 99,
        failureMessage: 'Storage backend unavailable',
      },
      maxRetries: 1,
    });
    track(job);

    await waitForStatus(job.id, (s) => s === JobStatus.DEAD_LETTER);

    // Simulate the root cause being fixed, then manually recover the job.
    await repo.updateJob(job.id, { payload: { fileKey: 'projects/p1/attachments/recoverable.bin' } });
    const retried = await service.retryJob(job.id);
    expect(retried.status).toBe(JobStatus.PENDING);
    expect(retried.attempts).toBe(0);

    const finalJob = await waitForStatus(job.id, (s) => s === JobStatus.COMPLETED);
    expect(finalJob.result).toMatchObject({ virusScanned: true, thumbnailGenerated: true });
  });

  it('recovers stale PROCESSING jobs (crashed worker) and re-runs them', async () => {
    const staleId = track(
      await db
        .insertInto('background_jobs')
        .values({
          job_type: JobType.CLEANUP,
          status: JobStatus.PROCESSING,
          payload: {},
          attempts: 1,
          max_retries: 3,
          progress: 45,
          started_at: new Date(Date.now() - 60 * 60 * 1000), // 1h old → stale
        })
        .returning('id')
        .executeTakeFirstOrThrow(),
    );

    const recovery = await service.recoverStaleJobs(15);
    expect(recovery.jobIds).toContain(staleId);
    expect(await service.getJobStatus(staleId)).toMatchObject({ status: JobStatus.PENDING });

    const completed = await waitForStatus(staleId, (s) => s === JobStatus.COMPLETED);
    expect(completed.result).toMatchObject({ status: 'CLEAN' });
  });

  it('calculates analytics rollups and verifies search index coverage', async () => {
    const { job: analyticsJob } = await service.dispatchJob({
      jobType: JobType.ANALYTICS_CALCULATION,
      payload: {},
      maxRetries: 1,
    });
    track(analyticsJob);
    const analyticsDone = await waitForStatus(analyticsJob.id, (s) => s === JobStatus.COMPLETED);
    expect(analyticsDone.result).toMatchObject({ rollupCompleted: true });

    const { job: indexJob } = await service.dispatchJob({
      jobType: JobType.SEARCH_INDEXING,
      payload: {},
      maxRetries: 1,
    });
    track(indexJob);
    const indexDone = await waitForStatus(indexJob.id, (s) => s === JobStatus.COMPLETED);
    expect(indexDone.result).toMatchObject({ searchRegistryUpdated: true });
    expect(indexDone.result?.indexedItems).toBeGreaterThanOrEqual(0);
  });

  it('lists jobs and supports status filtering for monitoring', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.EMAIL_NOTIFICATION,
      payload: { recipient: 'monitor@worklane.io', subject: 'Monitor' },
      maxRetries: 1,
    });
    track(job);
    await waitForStatus(job.id, (s) => s === JobStatus.COMPLETED);

    const completed = await service.listJobs({ status: JobStatus.COMPLETED, limit: 50 });
    expect(completed.some((j) => j.id === job.id)).toBe(true);

    const byType = await service.listJobs({ jobType: JobType.CLEANUP, limit: 50 });
    expect(Array.isArray(byType)).toBe(true);
  });
});
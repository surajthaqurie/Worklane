import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BackgroundJobsService } from './background-jobs.service.js';
import { JobStatus, JobType } from './dto/background-job.dto.js';

/**
 * Unit tests for the dispatch/idempotency/retry/recovery orchestration layer.
 * The BullMQ queue and the repository are mocked so no Redis or Postgres is
 * required; the full queue round-trip is covered by background-jobs.spec.ts.
 */
describe('BackgroundJobsService (unit)', () => {
  let repo: any;
  let queue: any;
  let service: BackgroundJobsService;
  let rows: Map<string, any>;

  function seedRow(overrides: Partial<any> = {}): any {
    const row = {
      id: crypto.randomUUID(),
      jobType: JobType.CLEANUP,
      idempotencyKey: null,
      status: JobStatus.PENDING,
      payload: {},
      result: null,
      errorMessage: null,
      attempts: 0,
      maxRetries: 3,
      progress: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      ...overrides,
    };
    rows.set(row.id, row);
    return row;
  }

  beforeEach(() => {
    rows = new Map();

    repo = {
      createJob: vi.fn(async (dto: any) => {
        if (dto.idempotencyKey) {
          const existing = Array.from(rows.values()).find(
            (r) => r.idempotencyKey === dto.idempotencyKey,
          );
          if (existing) return { job: existing, isDuplicate: true };
        }
        const job = seedRow({
          jobType: dto.jobType,
          idempotencyKey: dto.idempotencyKey ?? null,
          payload: dto.payload ?? {},
          maxRetries: dto.maxRetries ?? 3,
        });
        return { job, isDuplicate: false };
      }),
      findById: vi.fn(async (id: string) => rows.get(id) ?? null),
      updateJob: vi.fn(async (id: string, updates: any) => {
        const row = rows.get(id);
        if (!row) return null;
        Object.assign(row, updates);
        return row;
      }),
      getJobs: vi.fn(async () => Array.from(rows.values())),
      findStaleProcessing: vi.fn(async () => []),
    };

    queue = {
      enqueue: vi.fn(async (_dto: any, dbJobId: string) => `bull:${dbJobId}`),
      removeJobIfExists: vi.fn(async () => 0),
      enqueueDeadLetter: vi.fn(),
    };

    service = new BackgroundJobsService(repo, queue);
  });

  it('dispatches a job: creates a PENDING row and enqueues it to BullMQ', async () => {
    const res = await service.dispatchJob({
      jobType: JobType.CSV_IMPORT,
      payload: { rowCount: 100 },
      maxRetries: 3,
    });

    expect(res.isDuplicate).toBe(false);
    expect(res.job.status).toBe(JobStatus.PENDING);
    expect(res.job.attempts).toBe(0);

    // The BullMQ jobId is the DB row id so a concurrent producer cannot enqueue
    // the same job twice.
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    const [enqueuedDto, enqueuedJobId] = queue.enqueue.mock.calls[0];
    expect(enqueuedJobId).toBe(res.job.id);
    expect(enqueuedDto).toMatchObject({ jobType: JobType.CSV_IMPORT, maxRetries: 3 });
  });

  it('enforces idempotency: a duplicate idempotencyKey is not enqueued twice', async () => {
    const sharedKey = `idem-${Date.now()}`;
    const first = await service.dispatchJob({
      jobType: JobType.CSV_IMPORT,
      payload: { rowCount: 10 },
      idempotencyKey: sharedKey,
    });
    const second = await service.dispatchJob({
      jobType: JobType.CSV_IMPORT,
      payload: { rowCount: 10 },
      idempotencyKey: sharedKey,
    });

    expect(second.isDuplicate).toBe(true);
    expect(second.job.id).toBe(first.job.id);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('returns job status and throws NotFoundException for unknown jobs', async () => {
    const { job } = await service.dispatchJob({ jobType: JobType.CLEANUP });
    await expect(service.getJobStatus(job.id)).resolves.toMatchObject({ id: job.id });
    await expect(service.getJobStatus('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('rejects retry attempts for jobs that are not FAILED or DEAD_LETTER', async () => {
    const { job } = await service.dispatchJob({
      jobType: JobType.EMAIL_NOTIFICATION,
      payload: { recipient: 'a@b.c' },
    });
    await expect(service.retryJob(job.id)).rejects.toThrow(BadRequestException);
    expect(queue.enqueue).toHaveBeenCalledTimes(1); // only the original dispatch
  });

  it('retries a FAILED job: resets state, drops the old bull job, re-enqueues', async () => {
    const job = seedRow({ status: JobStatus.FAILED, attempts: 2, errorMessage: 'boom' });

    const retried = await service.retryJob(job.id);

    expect(retried.status).toBe(JobStatus.PENDING);
    expect(retried.attempts).toBe(0);
    expect(retried.errorMessage).toBeNull();
    expect(retried.progress).toBe(0);
    expect(queue.removeJobIfExists).toHaveBeenCalledWith(job.id);
    const [dto, jobId] = queue.enqueue.mock.calls[0];
    expect(jobId).toBe(job.id);
    expect(dto.jobType).toBe(JobType.CLEANUP);
    expect(dto.maxRetries).toBe(3);
  });

  it('retries a DEAD_LETTER job', async () => {
    const job = seedRow({ status: JobStatus.DEAD_LETTER, attempts: 3 });

    const retried = await service.retryJob(job.id);

    expect(retried.status).toBe(JobStatus.PENDING);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('recovers stale PROCESSING jobs by resetting and re-queuing them', async () => {
    const stale1 = seedRow({ status: JobStatus.PROCESSING, attempts: 1, startedAt: new Date().toISOString() });
    const stale2 = seedRow({ status: JobStatus.PROCESSING, attempts: 3, startedAt: new Date().toISOString() });
    repo.findStaleProcessing.mockResolvedValue([stale1, stale2]);

    const result = await service.recoverStaleJobs(15);

    expect(result).toEqual({ recovered: 2, jobIds: [stale1.id, stale2.id] });
    expect(rows.get(stale1.id).status).toBe(JobStatus.PENDING);
    expect(rows.get(stale2.id).status).toBe(JobStatus.PENDING);
    expect(queue.enqueue).toHaveBeenCalledTimes(2);
    expect(queue.removeJobIfExists).toHaveBeenCalledTimes(2);
  });

  it('delegates listing jobs to the repository', async () => {
    seedRow({ status: JobStatus.COMPLETED });
    await service.listJobs({ status: JobStatus.COMPLETED, limit: 20 });
    expect(repo.getJobs).toHaveBeenCalledWith({ status: JobStatus.COMPLETED, limit: 20 });
  });
});
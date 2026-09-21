import { describe, it, expect } from 'vitest';
import { BackgroundJobsProcessor } from './background-jobs.processor.js';
import { JobType } from './dto/background-job.dto.js';

/**
 * Unit tests for the per-type job handlers — DB-free variants only (email with
 * an explicit recipient, CSV import, attachment processing, and the test-only
 * `shouldFail` hook). Handlers that require Postgres are covered by the
 * integration spec.
 */
describe('BackgroundJobsProcessor (unit)', () => {
  const processor = new BackgroundJobsProcessor();

  function makeJob(type: JobType, payload: Record<string, any>, attempts = 1) {
    return {
      id: 'job-uuid',
      jobType: type,
      payload,
      attempts,
      maxRetries: 3,
      progress: 0,
    } as any;
  }

  async function collectProgress(job: any): Promise<number[]> {
    const progress: number[] = [];
    await processor.executeJobTask(job, job.attempts, async (p: number) => {
      progress.push(p);
    });
    return progress;
  }

  it('reports incremental progress and a successful deliverable for email jobs', async () => {
    const job = makeJob(JobType.EMAIL_NOTIFICATION, {
      recipient: 'ops@worklane.dev',
      subject: 'Deploy complete',
    });

    const progress = await collectProgress(job);
    const result = await processor.executeJobTask(job, 1, async () => {});

    expect(progress).toEqual([25, 75]);
    expect(result).toMatchObject({
      delivered: true,
      recipient: 'ops@worklane.dev',
      subject: 'Deploy complete',
    });
  });

  it('fails without input for attachment processing (dead-letter trigger)', async () => {
    const job = makeJob(JobType.ATTACHMENT_PROCESSING, {});
    await expect(processor.executeJobTask(job, 1, async () => {})).rejects.toThrow(
      /valid fileKey/,
    );
  });

  it('rejects an invalid CSV import rowCount', async () => {
    const job = makeJob(JobType.CSV_IMPORT, { rowCount: 'NaN' });
    await expect(processor.executeJobTask(job, 1, async () => {})).rejects.toThrow(
      /Invalid rowCount/,
    );
  });

  it('imports a CSV with progress milestones', async () => {
    const job = makeJob(JobType.CSV_IMPORT, { rowCount: 100 });
    const result = await processor.executeJobTask(job, 1, async () => {});

    expect(result).toMatchObject({ importedCount: 100, status: 'SUCCESS' });

    const progress: number[] = [];
    await processor.executeJobTask(job, 1, async (p: number) => {
      progress.push(p);
    });
    expect(progress[0]).toBe(20);
    expect(progress[progress.length - 1]).toBe(95);
    expect(progress.length).toBeGreaterThanOrEqual(3);
  });

  it('simulates transient failures only until the configured attempt (retry seam)', async () => {
    const job = makeJob(
      JobType.EMAIL_NOTIFICATION,
      {
        recipient: 'retry@worklane.dev',
        shouldFail: true,
        failUntilAttempt: 1,
        failureMessage: 'SMTP timeout',
      },
      1,
    );

    await expect(processor.executeJobTask(job, 1, async () => {})).rejects.toThrow('SMTP timeout');

    const attempt2Job = makeJob(
      JobType.EMAIL_NOTIFICATION,
      {
        recipient: 'retry@worklane.dev',
        shouldFail: true,
        failUntilAttempt: 1,
        failureMessage: 'SMTP timeout',
      },
      2,
    );
    const result = await processor.executeJobTask(attempt2Job, 2, async () => {});
    expect(result.delivered).toBe(true);
  });
});
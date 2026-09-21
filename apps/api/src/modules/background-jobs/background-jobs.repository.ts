import { Injectable } from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { BackgroundJobDto, DispatchJobDto, GetJobsQueryDto, JobStatus } from './dto/background-job.dto.js';

@Injectable()
export class BackgroundJobsRepository {
  async createJob(data: DispatchJobDto): Promise<{ job: BackgroundJobDto; isDuplicate: boolean }> {
    if (data.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(data.idempotencyKey);
      if (existing) {
        return { job: existing, isDuplicate: true };
      }
    }

    try {
      const row = await db
        .insertInto('background_jobs')
        .values({
          job_type: data.jobType,
          idempotency_key: data.idempotencyKey || null,
          status: 'PENDING',
          payload: JSON.stringify(data.payload ?? {}),
          max_retries: data.maxRetries ?? 3,
          attempts: 0,
          progress: 0,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { job: this.mapToDto(row), isDuplicate: false };
    } catch (err: any) {
      // Handle race condition on unique idempotency_key constraint
      if (data.idempotencyKey && (err?.code === '23505' || err?.message?.includes('unique'))) {
        const existing = await this.findByIdempotencyKey(data.idempotencyKey);
        if (existing) {
          return { job: existing, isDuplicate: true };
        }
      }
      throw err;
    }
  }

  async findById(id: string): Promise<BackgroundJobDto | null> {
    const row = await db
      .selectFrom('background_jobs')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();

    return row ? this.mapToDto(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<BackgroundJobDto | null> {
    const row = await db
      .selectFrom('background_jobs')
      .where('idempotency_key', '=', key)
      .selectAll()
      .executeTakeFirst();

    return row ? this.mapToDto(row) : null;
  }

  async updateJob(
    id: string,
    updates: {
      status?: JobStatus | string;
      progress?: number;
      payload?: Record<string, any>;
      result?: Record<string, any> | null;
      errorMessage?: string | null;
      attempts?: number;
      startedAt?: Date | null;
      completedAt?: Date | null;
    },
  ): Promise<BackgroundJobDto | null> {
    const setObj: Record<string, any> = {};

    if (updates.status !== undefined) setObj.status = updates.status;
    if (updates.progress !== undefined) setObj.progress = updates.progress;
    if (updates.payload !== undefined) setObj.payload = JSON.stringify(updates.payload);
    if (updates.result !== undefined) setObj.result = updates.result ? JSON.stringify(updates.result) : null;
    if (updates.errorMessage !== undefined) setObj.error_message = updates.errorMessage;
    if (updates.attempts !== undefined) setObj.attempts = updates.attempts;
    if (updates.startedAt !== undefined) setObj.started_at = updates.startedAt;
    if (updates.completedAt !== undefined) setObj.completed_at = updates.completedAt;

    const row = await db
      .updateTable('background_jobs')
      .set(setObj)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    return row ? this.mapToDto(row) : null;
  }

  async getJobs(query: GetJobsQueryDto): Promise<BackgroundJobDto[]> {
    let q = db.selectFrom('background_jobs');

    if (query.status) {
      q = q.where('status', '=', query.status);
    }
    if (query.jobType) {
      q = q.where('job_type', '=', query.jobType);
    }

    const limit = typeof query.limit === 'number' ? query.limit : 20;
    const rows = await q
      .orderBy('created_at', 'desc')
      .limit(limit)
      .selectAll()
      .execute();

    return rows.map((r) => this.mapToDto(r));
  }

  /**
   * Finds jobs stuck in PROCESSING longer than `sinceMinutes` — typically the
   * result of a crashed worker — so the recovery routine can re-queue them.
   */
  async findStaleProcessing(sinceMinutes: number, now: Date = new Date()): Promise<BackgroundJobDto[]> {
    const cutoff = new Date(now.getTime() - sinceMinutes * 60 * 1000);
    const rows = await db
      .selectFrom('background_jobs')
      .where('status', '=', JobStatus.PROCESSING)
      .where('started_at', '<', cutoff)
      .selectAll()
      .execute();

    return rows.map((r) => this.mapToDto(r));
  }

  private mapToDto(row: any): BackgroundJobDto {
    let payload: any = {};
    if (typeof row.payload === 'string') {
      try {
        payload = JSON.parse(row.payload);
      } catch {
        payload = {};
      }
    } else if (typeof row.payload === 'object' && row.payload !== null) {
      payload = row.payload;
    }

    let result: any = null;
    if (typeof row.result === 'string') {
      try {
        result = JSON.parse(row.result);
      } catch {
        result = null;
      }
    } else if (typeof row.result === 'object' && row.result !== null) {
      result = row.result;
    }

    return {
      id: row.id,
      jobType: row.job_type,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      payload,
      result,
      errorMessage: row.error_message,
      attempts: row.attempts,
      maxRetries: row.max_retries,
      progress: row.progress,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    };
  }
}

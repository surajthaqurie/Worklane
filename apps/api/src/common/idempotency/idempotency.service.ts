import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db/kysely.js';

export interface RecordedIdempotentResponse {
  statusCode: number;
  body: any;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly inMemoryCache = new Map<string, RecordedIdempotentResponse>();

  /** Extracts idempotency key from request headers or body payload */
  extractKey(req: any): string | null {
    if (!req) return null;

    const headerKey =
      req.headers?.['idempotency-key'] ||
      req.headers?.['x-idempotency-key'] ||
      req.headers?.['Idempotency-Key'] ||
      req.headers?.['X-Idempotency-Key'];

    if (headerKey && typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }

    if (req.body && typeof req.body === 'object' && req.body.idempotencyKey) {
      const bodyKey = String(req.body.idempotencyKey).trim();
      if (bodyKey) return bodyKey;
    }

    return null;
  }

  /** Checks for a previously recorded idempotent response */
  async findRecordedResponse(
    key: string,
    userId: string,
  ): Promise<RecordedIdempotentResponse | null> {
    const cacheKey = `${userId}:${key}`;
    if (this.inMemoryCache.has(cacheKey)) {
      return this.inMemoryCache.get(cacheKey)!;
    }

    try {
      const record = await db
        .selectFrom('idempotency_keys')
        .where('key', '=', key)
        .where('user_id', '=', userId)
        .select(['response_status', 'response_body'])
        .executeTakeFirst();

      if (record) {
        let parsedBody = record.response_body;
        if (typeof parsedBody === 'string') {
          try {
            parsedBody = JSON.parse(parsedBody);
          } catch {
            // Keep raw string if not JSON
          }
        }

        const result: RecordedIdempotentResponse = {
          statusCode: Number(record.response_status),
          body: parsedBody,
        };

        this.inMemoryCache.set(cacheKey, result);
        return result;
      }
    } catch (err) {
      this.logger.debug(`Database idempotency check fallback: ${(err as Error).message}`);
    }

    return null;
  }

  /** Saves response for an idempotency key */
  async recordResponse(
    key: string,
    userId: string,
    path: string,
    statusCode: number,
    body: any,
  ): Promise<void> {
    const cacheKey = `${userId}:${key}`;
    const entry: RecordedIdempotentResponse = { statusCode, body };
    this.inMemoryCache.set(cacheKey, entry);

    try {
      const jsonBody = typeof body === 'object' ? JSON.stringify(body) : String(body);
      await db
        .insertInto('idempotency_keys')
        .values({
          key,
          user_id: userId,
          path,
          response_status: statusCode,
          response_body: jsonBody as any,
        })
        .onConflict((oc) =>
          oc.columns(['key', 'user_id']).doUpdateSet({
            response_status: statusCode,
            response_body: jsonBody as any,
          }),
        )
        .execute();
    } catch (err) {
      this.logger.debug(`Database idempotency record fallback: ${(err as Error).message}`);
    }
  }
}

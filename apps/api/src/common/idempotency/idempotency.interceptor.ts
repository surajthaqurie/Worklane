import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service.js';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const key = this.idempotencyService.extractKey(req);
    if (!key) {
      return next.handle();
    }

    const userId = req.user?.id || 'anonymous';
    const existing = await this.idempotencyService.findRecordedResponse(key, userId);

    if (existing) {
      if (res && typeof res.status === 'function') {
        res.status(existing.statusCode);
      }
      return of(existing.body);
    }

    return next.handle().pipe(
      tap((data) => {
        const statusCode = res?.statusCode ?? 200;
        void this.idempotencyService.recordResponse(
          key,
          userId,
          req.originalUrl || req.url || '',
          statusCode,
          data,
        );
      }),
    );
  }
}

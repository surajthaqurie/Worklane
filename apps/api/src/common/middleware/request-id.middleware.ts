import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      requestId?: string;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const incomingId = req.headers['x-request-id'] || req.headers['request-id'];
    const requestId = (typeof incomingId === 'string' && incomingId.trim().length > 0)
      ? incomingId.trim()
      : crypto.randomUUID();

    req.id = requestId;
    req.requestId = requestId;
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);

    const startTime = Date.now();
    const { method, originalUrl, ip } = req;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
      const logMessage = `[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms (${ip || 'unknown'})`;

      if (logLevel === 'error') {
        this.logger.error(logMessage);
      } else if (logLevel === 'warn') {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}

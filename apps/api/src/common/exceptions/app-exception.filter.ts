import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

export interface BaseErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  details?: unknown;
}

/** Canonical error body returned for every error response. */
export interface ErrorBody extends BaseErrorBody {
  timestamp: string;
  path: string;
  requestId?: string;
}

/**
 * Global exception filter that normalizes every error into a consistent shape:
 *
 *   { statusCode, message, error, timestamp, path, requestId?, details? }
 *
 * This preserves Nest's default payload while providing end-to-end tracing
 * and consistency across all controllers and exceptions.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('AppExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      request?.id ||
      request?.requestId ||
      (typeof request?.headers?.['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : undefined);

    const path = request?.originalUrl || request?.url || '';

    const baseBody =
      exception instanceof HttpException
        ? this.fromHttpException(exception)
        : exception instanceof ZodError
          ? this.fromZodError(exception)
          : this.fromUnknown(exception);

    const body: ErrorBody = {
      ...baseBody,
      timestamp: new Date().toISOString(),
      path,
      ...(requestId ? { requestId } : {}),
    };

    response.status(body.statusCode).json(body);
  }

  private fromHttpException(exception: HttpException): BaseErrorBody {
    const status = exception.getStatus();
    const res = exception.getResponse();

    if (typeof res === 'string') {
      return { statusCode: status, message: res, error: exception.name };
    }

    if (res !== null && typeof res === 'object') {
      const body = res as Record<string, unknown>;
      return {
        statusCode: status,
        message: Array.isArray(body.message) ? body.message : typeof body.message === 'string' ? body.message : exception.message,
        error: typeof body.error === 'string' ? body.error : exception.name,
        ...('details' in body ? { details: body.details } : {}),
      };
    }

    return { statusCode: status, message: exception.message, error: exception.name };
  }

  private fromZodError(error: ZodError): BaseErrorBody {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      error: 'BadRequestException',
      details: error.issues,
    };
  }

  private fromUnknown(exception: unknown): BaseErrorBody {
    const message = exception instanceof Error ? exception.message : 'Internal server error';
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(message, stack);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
    };
  }
}
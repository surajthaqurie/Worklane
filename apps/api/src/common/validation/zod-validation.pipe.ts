import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { z } from 'zod';

/**
 * Validates a route parameter (body, query, param) against a zod schema at the
 * API boundary. Unknown keys are stripped and the transformed value is returned
 * as the parsed output type.
 */
@Injectable()
export class ZodValidationPipe<T extends z.ZodType>
  implements PipeTransform<unknown, z.infer<T>>
{
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: result.error.issues,
      });
    }
    return result.data as z.infer<T>;
  }
}
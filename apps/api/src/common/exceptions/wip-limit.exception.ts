import { ConflictException } from '@nestjs/common';

export interface WipLimitInfo {
  columnId: string;
  columnName: string;
  currentCount: number;
  wipLimit: number;
}

/**
 * Raised when a move would push a board column past its WIP limit.
 *
 * Uses HTTP 409 so clients can distinguish "the board changed / limit hit"
 * (retryable after the column clears) from ordinary validation failures, and
 * always carries a structured `code` + counts under `details` so the UI can
 * surface precise, actionable feedback instead of silently dropping the move.
 */
export class WipLimitExceededException extends ConflictException {
  constructor(data: WipLimitInfo) {
    super({
      statusCode: 409,
      error: 'Conflict',
      message: `Cannot move work item to "${data.columnName}": the column is at its WIP limit (${data.currentCount}/${data.wipLimit}). Move an item out first, or override the limit.`,
      details: {
        code: 'WIP_LIMIT_EXCEEDED',
        columnId: data.columnId,
        columnName: data.columnName,
        currentCount: data.currentCount,
        wipLimit: data.wipLimit,
      },
    });
  }
}
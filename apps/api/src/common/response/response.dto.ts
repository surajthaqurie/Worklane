export type SuccessResponse = { success: true };

export const success = (): SuccessResponse => ({ success: true });

export interface CursorPageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface OffsetPageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
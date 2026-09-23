import { describe, expect, it } from 'vitest';
import { getWipBlockDetails, wipBlockMessage } from '../hooks/useBoards';
import { ApiError } from '@/shared/types/api';

describe('getWipBlockDetails', () => {
  it('returns null for errors that are not a 409', () => {
    expect(getWipBlockDetails(new ApiError('nope', 400))).toBeNull();
    expect(getWipBlockDetails(new ApiError('gone', 500))).toBeNull();
  });

  it('returns null for non-ApiError values', () => {
    expect(getWipBlockDetails(new Error('boom'))).toBeNull();
    expect(getWipBlockDetails(undefined)).toBeNull();
  });

  it('returns null when the structured code is not WIP_LIMIT_EXCEEDED', () => {
    const error = new ApiError('blocked', 409, { code: 'SOMETHING_ELSE', currentCount: 3, wipLimit: 2, columnName: 'Done' });
    expect(getWipBlockDetails(error)).toBeNull();
  });

  it('returns null when a WIP block is missing the column or limit numbers', () => {
    const error = new ApiError('blocked', 409, { code: 'WIP_LIMIT_EXCEEDED', columnName: 'Done' });
    expect(getWipBlockDetails(error)).toBeNull();
  });

  it('extracts WIP info from the nested details payload', () => {
    const error = new ApiError('blocked', 409, {
      details: {
        code: 'WIP_LIMIT_EXCEEDED',
        columnId: 'col-1',
        columnName: 'In Progress',
        currentCount: 5,
        wipLimit: 4,
      },
    });
    expect(getWipBlockDetails(error)).toEqual({
      code: 'WIP_LIMIT_EXCEEDED',
      columnId: 'col-1',
      columnName: 'In Progress',
      currentCount: 5,
      wipLimit: 4,
    });
  });

  it('extracts WIP info from a flat details payload', () => {
    const error = new ApiError('blocked', 409, {
      code: 'WIP_LIMIT_EXCEEDED',
      columnId: 'col-2',
      columnName: 'Done',
      currentCount: 0,
      wipLimit: 0,
    });
    expect(getWipBlockDetails(error)).toEqual({
      code: 'WIP_LIMIT_EXCEEDED',
      columnId: 'col-2',
      columnName: 'Done',
      currentCount: 0,
      wipLimit: 0,
    });
  });
});

describe('wipBlockMessage', () => {
  it('renders a human-friendly instruction', () => {
    const message = wipBlockMessage({ columnId: 'c', columnName: 'In Progress', currentCount: 3, wipLimit: 2 });
    expect(message).toContain('"In Progress"');
    expect(message).toContain('3/2');
    expect(message).toContain('override');
  });
});
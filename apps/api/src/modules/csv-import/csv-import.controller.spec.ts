import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CsvImportController } from './csv-import.controller.js';
import { CsvImportService } from './csv-import.service.js';

describe('CsvImportController', () => {
  let controller: CsvImportController;
  let service: CsvImportService;

  beforeEach(() => {
    service = {
      parse: vi.fn().mockReturnValue({
        headers: ['Title', 'Type'],
        rows: [{ Title: 'Task 1', Type: 'TASK' }],
        totalRows: 1,
        delimiter: ',',
        sampleRows: [{ Title: 'Task 1', Type: 'TASK' }],
        suggestedMapping: { Title: 'title', Type: 'type' },
      }),
      validate: vi.fn().mockResolvedValue({
        totalRows: 1,
        validCount: 1,
        invalidCount: 0,
        validRows: [],
        errors: [],
        canImport: true,
        headers: ['Title'],
        suggestedMapping: { Title: 'title' },
      }),
      execute: vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        isAsync: false,
        importedCount: 1,
        failedCount: 0,
        skippedCount: 0,
        importedItems: [{ id: '1', seqNo: 1, title: 'Task 1' }],
        errors: [],
      }),
    } as unknown as CsvImportService;

    controller = new CsvImportController(service);
  });

  it('parses CSV from uploaded file buffer', async () => {
    const file = {
      buffer: Buffer.from('Title,Type\nTask 1,TASK'),
    };

    const result = await controller.parseCsv(file);

    expect(service.parse).toHaveBeenCalledWith('Title,Type\nTask 1,TASK');
    expect(result.totalRows).toBe(1);
  });

  it('parses CSV from body string', async () => {
    const result = await controller.parseCsv(undefined, 'Title\nItem');

    expect(service.parse).toHaveBeenCalledWith('Title\nItem');
    expect(result.totalRows).toBe(1);
  });

  it('delegates validation to service', async () => {
    const req = { user: { id: 'u-1' } };
    const body = {
      rows: [{ Title: 'Task 1' }],
      mapping: { Title: 'title' },
    };

    const result = await controller.validateCsv(req, 'p-1', body);

    expect(service.validate).toHaveBeenCalledWith('u-1', 'p-1', body.rows, body.mapping);
    expect(result.validCount).toBe(1);
  });

  it('delegates execution to service', async () => {
    const req = { user: { id: 'u-1' } };
    const body = {
      rows: [{ Title: 'Task 1' }],
      mapping: { Title: 'title' },
      mode: 'ALL_OR_NOTHING' as const,
    };

    const result = await controller.executeImport(req, 'p-1', body);

    expect(service.execute).toHaveBeenCalledWith(
      'u-1',
      'p-1',
      body.rows,
      body.mapping,
      'ALL_OR_NOTHING',
      false,
    );
    expect(result.status).toBe('COMPLETED');
  });
});

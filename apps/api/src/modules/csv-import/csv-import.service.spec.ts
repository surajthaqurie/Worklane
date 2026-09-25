import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CsvImportService } from './csv-import.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';
import { BackgroundJobsService } from '../background-jobs/background-jobs.service.js';
import { JobType } from '../background-jobs/dto/background-job.dto.js';
import { BadRequestException } from '@nestjs/common';

describe('CsvImportService', () => {
  let service: CsvImportService;
  let authz: AuthorizationService;
  let backgroundJobs: BackgroundJobsService;

  beforeEach(() => {
    authz = {
      requireProjectPermission: vi.fn().mockResolvedValue({
        projectId: 'p-1',
        userId: 'u-1',
        role: 'MEMBER',
      }),
    } as unknown as AuthorizationService;

    backgroundJobs = {
      dispatchJob: vi.fn().mockResolvedValue({
        job: { id: 'job-123', status: 'PENDING' },
        isDuplicate: false,
      }),
    } as unknown as BackgroundJobsService;

    service = new CsvImportService(authz, backgroundJobs);

    // Mock getProjectDomainContext
    vi.spyOn(service, 'getProjectDomainContext').mockResolvedValue({
      projectId: 'p-1',
      states: [
        { id: 's-1', key: 'TODO', name: 'To Do', is_done: false, category: 'PROPOSED' },
      ],
      defaultStateKey: 'TODO',
      areas: [{ id: 'a-1', name: 'General' }],
      defaultAreaId: 'a-1',
      iterations: [],
      members: [{ id: 'u-1', name: 'Alice', email: 'alice@worklane.dev' }],
      existingWorkItems: [],
    });
  });

  describe('Authorization', () => {
    it('enforces WORK_ITEM_CREATE permission', async () => {
      const rows = [{ Title: 'Task 1' }];
      const mapping = { Title: 'title' };

      await service.validate('u-1', 'p-1', rows, mapping);

      expect(authz.requireProjectPermission).toHaveBeenCalledWith(
        'p-1',
        'u-1',
        Permission.WORK_ITEM_CREATE,
      );
    });
  });

  describe('Transactional Execution & Modes', () => {
    it('executes synchronous transactional import for small row count', async () => {
      const rows = [
        { Title: 'Task 1', Type: 'TASK' },
        { Title: 'Task 2', Type: 'TASK' },
      ];
      const mapping = { Title: 'title', Type: 'type' };

      // Mock executeTransactionalImport
      vi.spyOn(service, 'executeTransactionalImport').mockResolvedValueOnce({
        status: 'COMPLETED',
        isAsync: false,
        importedCount: 2,
        failedCount: 0,
        skippedCount: 0,
        importedItems: [
          { id: 'item-1', seqNo: 1, title: 'Task 1' },
          { id: 'item-2', seqNo: 2, title: 'Task 2' },
        ],
        errors: [],
      });

      const result = await service.execute('u-1', 'p-1', rows, mapping, 'ALL_OR_NOTHING');

      expect(result.status).toBe('COMPLETED');
      expect(result.isAsync).toBe(false);
      expect(result.importedCount).toBe(2);
      expect(service.executeTransactionalImport).toHaveBeenCalledTimes(1);
    });

    it('rejects import in ALL_OR_NOTHING mode when validation errors exist', async () => {
      const rows = [
        { Title: 'Valid Task' },
        { Title: '' }, // Invalid
      ];
      const mapping = { Title: 'title' };

      await expect(
        service.execute('u-1', 'p-1', rows, mapping, 'ALL_OR_NOTHING'),
      ).rejects.toThrow(BadRequestException);
    });

    it('proceeds with valid rows in SKIP_INVALID mode', async () => {
      const rows = [
        { Title: 'Valid Task' },
        { Title: '' }, // Invalid: should be skipped
      ];
      const mapping = { Title: 'title' };

      vi.spyOn(service, 'executeTransactionalImport').mockResolvedValueOnce({
        status: 'COMPLETED',
        isAsync: false,
        importedCount: 1,
        failedCount: 0,
        skippedCount: 1,
        importedItems: [{ id: 'item-1', seqNo: 1, title: 'Valid Task' }],
        errors: [{ row: 2, field: 'title', message: 'Title is required' }],
      });

      const result = await service.execute('u-1', 'p-1', rows, mapping, 'SKIP_INVALID');

      expect(result.status).toBe('COMPLETED');
      expect(result.importedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    it('dispatches background job for large imports (> 25 rows)', async () => {
      const rows = Array.from({ length: 30 }, (_, i) => ({
        Title: `Task ${i + 1}`,
      }));
      const mapping = { Title: 'title' };

      const result = await service.execute('u-1', 'p-1', rows, mapping, 'ALL_OR_NOTHING');

      expect(result.isAsync).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(backgroundJobs.dispatchJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: JobType.CSV_IMPORT,
        }),
      );
    });
  });
});

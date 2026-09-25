import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { sql } from 'kysely';
import { db } from '../../db/kysely.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';
import { BackgroundJobsService } from '../background-jobs/background-jobs.service.js';
import { JobType } from '../background-jobs/dto/background-job.dto.js';
import { parseCsv } from './csv-parser.js';
import { validateCsvRows } from './csv-validator.js';
import type {
  CsvImportMode,
  CsvImportResult,
  CsvRowError,
  CsvValidationResult,
  ProjectDomainContext,
  ValidatedRow,
} from './csv-import.types.js';

export const ASYNC_IMPORT_THRESHOLD = 25;

@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(
    private readonly authz: AuthorizationService,
    @Optional()
    @Inject(forwardRef(() => BackgroundJobsService))
    private readonly backgroundJobs?: BackgroundJobsService,
  ) {}

  async getProjectDomainContext(projectId: string): Promise<ProjectDomainContext> {
    const [states, areas, iterations, members, existingWorkItems] = await Promise.all([
      db
        .selectFrom('work_item_states')
        .where('project_id', '=', projectId)
        .select(['id', 'key', 'name', 'is_done', 'category'])
        .orderBy('sort_order', 'asc')
        .execute(),
      db
        .selectFrom('areas')
        .where('project_id', '=', projectId)
        .select(['id', 'name'])
        .execute(),
      db
        .selectFrom('iterations')
        .where('project_id', '=', projectId)
        .select(['id', 'name'])
        .execute(),
      db
        .selectFrom('project_members')
        .innerJoin('users', 'users.id', 'project_members.user_id')
        .where('project_members.project_id', '=', projectId)
        .select(['users.id', 'users.name', 'users.email'])
        .execute(),
      db
        .selectFrom('work_items')
        .where('project_id', '=', projectId)
        .select(['id', 'seq_no', 'title', 'type'])
        .execute(),
    ]);

    const defaultState = states.find((s) => s.category === 'PROPOSED') || states[0];
    const defaultStateKey = defaultState ? defaultState.key : 'TODO';
    const defaultArea = areas[0];
    const defaultAreaId = defaultArea ? defaultArea.id : '';

    return {
      projectId,
      states,
      defaultStateKey,
      areas,
      defaultAreaId,
      iterations,
      members,
      existingWorkItems: existingWorkItems as any,
    };
  }

  parse(content: string, delimiter?: string) {
    if (!content || !content.trim()) {
      throw new BadRequestException('CSV file or content is empty');
    }
    return parseCsv(content, delimiter);
  }

  async validate(
    userId: string,
    projectId: string,
    rows: Record<string, string>[],
    mapping: Record<string, string>,
  ): Promise<CsvValidationResult> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_CREATE);

    if (!rows || rows.length === 0) {
      throw new BadRequestException('No rows provided for validation');
    }

    const context = await this.getProjectDomainContext(projectId);
    return validateCsvRows(rows, mapping, context);
  }

  async execute(
    userId: string,
    projectId: string,
    rows: Record<string, string>[],
    mapping: Record<string, string>,
    mode: CsvImportMode = 'ALL_OR_NOTHING',
    isAsyncPreferred = false,
  ): Promise<CsvImportResult> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_CREATE);

    const validation = await this.validate(userId, projectId, rows, mapping);

    if (mode === 'ALL_OR_NOTHING' && validation.invalidCount > 0) {
      throw new BadRequestException({
        message: `Validation failed for ${validation.invalidCount} rows in ALL_OR_NOTHING mode. Resolve errors or select SKIP_INVALID mode.`,
        errors: validation.errors,
      });
    }

    if (validation.validRows.length === 0) {
      throw new BadRequestException('No valid rows found to import');
    }

    const rowsToImport = validation.validRows;
    const shouldRunAsync = (rowsToImport.length > ASYNC_IMPORT_THRESHOLD || isAsyncPreferred) && Boolean(this.backgroundJobs);

    if (shouldRunAsync && this.backgroundJobs) {
      this.logger.log(
        `Dispatching background CSV import job for project ${projectId} (${rowsToImport.length} rows, mode: ${mode})`,
      );

      const { job } = await this.backgroundJobs.dispatchJob({
        jobType: JobType.CSV_IMPORT,
        payload: {
          projectId,
          userId,
          mode,
          validRows: rowsToImport,
          totalRows: rows.length,
          skippedCount: validation.invalidCount,
          initialErrors: validation.errors,
        },
      });

      return {
        status: 'COMPLETED',
        isAsync: true,
        jobId: job.id,
        importedCount: 0,
        failedCount: 0,
        skippedCount: validation.invalidCount,
        importedItems: [],
        errors: validation.errors,
        message: 'Import job dispatched to background queue. Track progress via background jobs API.',
      };
    }

    // Synchronous transactional import
    return await this.executeTransactionalImport(
      projectId,
      userId,
      rowsToImport,
      validation.invalidCount,
      validation.errors,
    );
  }

  async executeTransactionalImport(
    projectId: string,
    userId: string,
    validRows: ValidatedRow[],
    skippedCount: number,
    initialErrors: CsvRowError[],
  ): Promise<CsvImportResult> {
    try {
      const importedItems = await db.transaction().execute(async (trx) => {
        // 1. Reserve sequential IDs atomically
        const count = validRows.length;
        const project = await trx
          .updateTable('projects')
          .set((eb) => ({
            next_work_item_seq: sql<number>`${eb.ref('next_work_item_seq')} + ${count}`,
          }))
          .where('id', '=', projectId)
          .returning('next_work_item_seq')
          .executeTakeFirstOrThrow();

        const baseSeqNo = project.next_work_item_seq - count;

        const rowNumberToCreatedId = new Map<number, string>();
        const results: Array<{ id: string; seqNo: number; title: string }> = [];

        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          const seqNo = baseSeqNo + i;

          // Resolve parent if referencing an earlier row in the CSV
          let finalParentId = row.parentId;
          if (!finalParentId && row.parentRowNumber) {
            finalParentId = rowNumberToCreatedId.get(row.parentRowNumber) || null;
          }

          // Insert work item
          const item = await trx
            .insertInto('work_items')
            .values({
              project_id: projectId,
              seq_no: seqNo,
              title: row.title,
              type: row.type,
              state: row.state,
              description: row.description,
              assigned_to: row.assignedTo,
              area_id: row.areaId,
              iteration_id: row.iterationId,
              parent_id: finalParentId,
              priority: row.priority,
              severity: row.severity,
              points: row.points,
              remaining_work: row.remainingWork,
              completed_work: row.completedWork,
              start_date: row.startDate,
              target_date: row.targetDate,
              created_by: userId,
              backlog_order: seqNo,
            })
            .returning(['id', 'seq_no', 'title'])
            .executeTakeFirstOrThrow();

          rowNumberToCreatedId.set(row.rowNumber, item.id);
          results.push({ id: item.id, seqNo: item.seq_no, title: item.title });

          // Link tags
          if (row.tags && row.tags.length > 0) {
            for (const tagName of row.tags) {
              let tag = await trx
                .selectFrom('tags')
                .where('project_id', '=', projectId)
                .where('name', '=', tagName)
                .select('id')
                .executeTakeFirst();

              if (!tag) {
                tag = await trx
                  .insertInto('tags')
                  .values({ project_id: projectId, name: tagName })
                  .returning('id')
                  .executeTakeFirstOrThrow();
              }

              await trx
                .insertInto('work_item_tags')
                .values({ work_item_id: item.id, tag_id: tag.id })
                .onConflict((oc) => oc.doNothing())
                .execute();
            }
          }

          // Record history creation
          await trx
            .insertInto('work_item_history')
            .values({
              work_item_id: item.id,
              user_id: userId,
              action: 'CREATED',
              field: null,
              old_value: null,
              new_value: item.title,
            })
            .execute();
        }

        return results;
      });

      return {
        status: 'COMPLETED',
        isAsync: false,
        importedCount: importedItems.length,
        failedCount: 0,
        skippedCount,
        importedItems,
        errors: initialErrors,
        message: `Successfully imported ${importedItems.length} work items.`,
      };
    } catch (err: any) {
      this.logger.error(`Transactional import failed for project ${projectId}: ${err.message}`, err.stack);
      throw new BadRequestException(`Import transaction failed and was rolled back: ${err.message}`);
    }
  }

  async executeImportJob(
    payload: Record<string, any>,
    onProgress: (progress: number) => Promise<void>,
  ): Promise<any> {
    const { projectId, userId, validRows, skippedCount, initialErrors } = payload;

    if (!projectId || !userId || !Array.isArray(validRows)) {
      throw new Error('Invalid CSV import job payload — required fields missing');
    }

    await onProgress(10);

    const total = validRows.length;
    // Execute atomic transactional import
    await onProgress(30);

    const result = await this.executeTransactionalImport(
      projectId,
      userId,
      validRows,
      Number(skippedCount || 0),
      initialErrors || [],
    );

    await onProgress(100);

    return {
      status: 'SUCCESS',
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
      failedCount: 0,
      importedItems: result.importedItems,
      errors: result.errors,
      completedAt: new Date().toISOString(),
    };
  }
}

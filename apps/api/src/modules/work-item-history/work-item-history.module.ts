import { Module } from '@nestjs/common';
import { WorkItemHistoryRepository } from './work-item-history.repository.js';
import { WorkItemHistoryService } from './work-item-history.service.js';

/**
 * Reusable, immutable work-item audit log. Any module that writes work-item
 * history (work-items, backlog, iterations) imports this module and records
 * through WorkItemHistoryService so every entry shares one structured
 * vocabulary — the foundation for future audit/reporting features.
 */
@Module({
  providers: [WorkItemHistoryRepository, WorkItemHistoryService],
  exports: [WorkItemHistoryService],
})
export class WorkItemHistoryModule {}
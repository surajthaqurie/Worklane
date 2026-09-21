import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BoardsRepository, BoardRow } from './boards.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { WorkItemsService } from '../work-items/work-items.service.js';
import { WorkItemTransitionsService } from '../work-items/work-item-transitions.service.js';
import { WipConstraint } from '../work-items/work-items.repository.js';
import {
  CreateBoardDto,
  UpdateBoardDto,
  MoveWorkItemDto,
  MoveWorkItemSchema,
  BoardColumn,
  CardFields,
  SwimlaneType,
  CreateBoardSchema,
  UpdateBoardSchema,
} from './dto/boards.dto.js';
import { WipLimitExceededException } from '../../common/exceptions/wip-limit.exception.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import type { WorkItemType } from '../work-items/work-item.types.js';

const DEFAULT_CARD_FIELDS: CardFields = {
  showType: true,
  showPriority: true,
  showAssignee: true,
  showPoints: true,
  showParent: true,
  showTags: true,
};

import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';

import { TeamsService } from '../teams/teams.service.js';

@Injectable()
export class BoardsService {
  constructor(
    private readonly repo: BoardsRepository,
    private readonly projectsService: ProjectsService,
    private readonly workItemsService: WorkItemsService,
    private readonly teamsService: TeamsService,
    private readonly transitionsService: WorkItemTransitionsService,
    private readonly gateway: NotificationsGateway,
    private readonly authz: AuthorizationService,
  ) {}

  async listBoards(userId: string, projectId: string, teamId?: string | null): Promise<BoardRow[]> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.BOARD_VIEW);
    if (teamId && teamId !== 'default' && teamId !== 'undefined') {
      await this.teamsService.assertTeamMember(projectId, teamId, userId);
    }
    const boards = await this.repo.listByProject(projectId, teamId);
    if (boards.length === 0) {
      const defaultBoard = await this.seedDefaultBoard(projectId, teamId);
      return [defaultBoard];
    }
    return boards;
  }

  async getBoard(userId: string, projectId: string, boardId: string): Promise<BoardRow> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.BOARD_VIEW);
    if (boardId === 'default') {
      const boards = await this.listBoards(userId, projectId);
      return boards[0];
    }
    const board = await this.repo.getById(projectId, boardId);
    if (!board) {
      throw new NotFoundException('Board not found');
    }
    if (board.teamId) {
      await this.teamsService.assertTeamMember(projectId, board.teamId, userId);
    }
    return board;
  }

  async createBoard(userId: string, projectId: string, dto: CreateBoardDto): Promise<BoardRow> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.BOARD_MANAGE);

    if (dto.teamId) {
      await this.teamsService.assertTeamMember(projectId, dto.teamId, userId);
    }

    const parsed = CreateBoardSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid board configuration');
    }
    const data = parsed.data;

    const projectStates = await this.repo.getProjectStates(projectId);
    const columns = data.columns || this.generateDefaultColumns(projectStates);
    this.validateColumns(columns, projectStates);

    const cardFields = data.cardFields
      ? { ...DEFAULT_CARD_FIELDS, ...data.cardFields }
      : DEFAULT_CARD_FIELDS;
    const filterConfig = data.filterConfig || {};

    const board = await this.repo.create({
      projectId,
      teamId: data.teamId || null,
      name: data.name,
      description: data.description?.trim() || null,
      isDefault: false,
      swimlane: (data.swimlane ?? 'none') as SwimlaneType,
      columns,
      cardFields,
      filterConfig,
    });

    await this.broadcastBoardChange(projectId, board.id, userId, 'created');
    return board;
  }

  async updateBoard(
    userId: string,
    projectId: string,
    boardId: string,
    dto: UpdateBoardDto,
  ): Promise<BoardRow> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.BOARD_MANAGE);

    const parsed = UpdateBoardSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid board configuration');
    }
    const data = parsed.data;

    const existing = await this.repo.getById(projectId, boardId);
    if (!existing) {
      throw new NotFoundException('Board not found');
    }

    if (existing.teamId) {
      await this.teamsService.assertTeamMember(projectId, existing.teamId, userId);
    }
    if (dto.teamId && dto.teamId !== existing.teamId) {
      await this.teamsService.assertTeamMember(projectId, dto.teamId, userId);
    }

    const projectStates = await this.repo.getProjectStates(projectId);
    let columns = existing.columns;
    if (data.columns !== undefined) {
      columns = data.columns;
      this.validateColumns(columns, projectStates);
    }

    let cardFields = existing.cardFields;
    if (data.cardFields !== undefined) {
      cardFields = { ...DEFAULT_CARD_FIELDS, ...existing.cardFields, ...data.cardFields };
    }

    let filterConfig = existing.filterConfig;
    if (data.filterConfig !== undefined) {
      filterConfig = { ...existing.filterConfig, ...data.filterConfig };
    }

    const board = await this.repo.update(boardId, {
      name: data.name,
      description: data.description,
      teamId: data.teamId,
      isDefault: data.isDefault,
      swimlane: data.swimlane,
      columns,
      cardFields,
      filterConfig,
    });

    await this.broadcastBoardChange(projectId, board.id, userId, 'updated');
    return board;
  }

  async deleteBoard(userId: string, projectId: string, boardId: string): Promise<{ success: boolean }> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.BOARD_MANAGE);
    const existing = await this.repo.getById(projectId, boardId);
    if (!existing) {
      throw new NotFoundException('Board not found');
    }

    if (existing.teamId) {
      await this.teamsService.assertTeamMember(projectId, existing.teamId, userId);
    }

    const allBoards = await this.repo.listByProject(projectId);
    if (allBoards.length <= 1) {
      throw new BadRequestException('Cannot delete the last board in a project');
    }

    await this.repo.remove(boardId);
    await this.broadcastBoardChange(projectId, boardId, userId, 'deleted');
    return { success: true };
  }

  async getBoardWorkItems(
    userId: string,
    projectId: string,
    boardId: string,
    queryFilters: Record<string, any> = {},
  ) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.BOARD_VIEW);

    let board: BoardRow;
    if (boardId === 'default') {
      const boards = await this.listBoards(userId, projectId, queryFilters.teamId);
      board = boards[0];
    } else {
      board = await this.getBoard(userId, projectId, boardId);
    }

    const teamId = queryFilters.teamId || board.teamId || undefined;
    if (teamId && teamId !== 'default' && teamId !== 'undefined') {
      await this.teamsService.assertTeamMember(projectId, teamId, userId);
    }

    const mergedFilters = {
      ...board.filterConfig,
      ...queryFilters,
      search: queryFilters.search ?? board.filterConfig?.search ?? undefined,
      assignedTo: queryFilters.assignedTo ?? board.filterConfig?.assignedTo ?? undefined,
      tags: queryFilters.tags ?? board.filterConfig?.tags ?? undefined,
      iterationId: queryFilters.iterationId ?? board.filterConfig?.iterationId ?? undefined,
      areaId: queryFilters.areaId ?? board.filterConfig?.areaId ?? undefined,
      teamId,
    };

    return this.workItemsService.findAll(userId, projectId, mergedFilters);
  }

  /**
   * WIP-aware board move: resolves the target column for the dragged card,
   * rejects moves that would push a limited column past its WIP boundary with
   * structured, actionable feedback, and otherwise delegates to the shared
   * state-transition pipeline (which enforces the limit atomically under a row
   * lock so concurrent drags cannot silently overshoot).
   */
  async moveWorkItem(
    userId: string,
    projectId: string,
    boardId: string,
    workItemId: string,
    dto: MoveWorkItemDto,
  ) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_CHANGE_STATE);

    const board =
      boardId === 'default'
        ? (await this.listBoards(userId, projectId))[0]
        : await this.getBoard(userId, projectId, boardId);

    const parsed = MoveWorkItemSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid move request');
    }
    const { state: rawTargetState, expectedVersion, bypassWip } = parsed.data;

    const targetState = this.normalizeStateKey(rawTargetState);
    const targetColumn = this.resolveColumnForState(board.columns, targetState);
    if (!targetColumn) {
      throw new BadRequestException(
        `State "${rawTargetState}" is not mapped to any column on board "${board.name}"`,
      );
    }

    const item = await this.repo.getWorkItemForMove(projectId, workItemId);
    if (!item) {
      throw new NotFoundException('Work item not found');
    }

    const currentColumn = this.resolveColumnForState(board.columns, item.state);
    const movingBetweenColumns = currentColumn?.id !== targetColumn.id;

    // Fast, non-locking pre-check for immediate client feedback. The atomic
    // check inside the transition transaction remains the source of truth.
    if (movingBetweenColumns && !bypassWip && targetColumn.wipLimit != null) {
      const typeScope = this.boardTypeScope(board);
      const currentCount = await this.repo.countItemsInStates(
        projectId,
        targetColumn.mappedStates,
        typeScope,
      );
      if (currentCount >= targetColumn.wipLimit) {
        throw new WipLimitExceededException({
          columnId: targetColumn.id,
          columnName: targetColumn.name,
          currentCount,
          wipLimit: targetColumn.wipLimit,
        });
      }
    }

    let wipConstraint: WipConstraint | undefined;
    if (movingBetweenColumns && !bypassWip && targetColumn.wipLimit != null) {
      wipConstraint = {
        projectId,
        columnId: targetColumn.id,
        columnName: targetColumn.name,
        targetStates: targetColumn.mappedStates,
        limit: targetColumn.wipLimit,
        excludeItemId: workItemId,
        typeScope: this.boardTypeScope(board),
      };
    }

    const updated = await this.transitionsService.transitionState(
      userId,
      workItemId,
      targetState,
      expectedVersion,
      wipConstraint,
    );

    await this.broadcastItemMoved(projectId, board.id, workItemId, targetState, userId);
    return updated;
  }

  private normalizeStateKey(raw: string): string {
    let key = raw;
    if (key.startsWith('col-')) key = key.slice('col-'.length);
    return key.toUpperCase();
  }

  private resolveColumnForState(
    columns: BoardColumn[],
    stateKey: string,
  ): BoardColumn | undefined {
    const exact = columns.find((c) => c.mappedStates.includes(stateKey));
    if (exact) return exact;
    const lower = stateKey.toLowerCase();
    return columns.find((c) => c.mappedStates.some((s) => s.toLowerCase() === lower));
  }

  private boardTypeScope(board: BoardRow): WorkItemType[] | undefined {
    const filter = board.filterConfig;
    if (filter.types && filter.types.length > 0) return filter.types as WorkItemType[];
    if (filter.backlogLevel === 'EPIC') return ['EPIC'];
    if (filter.backlogLevel === 'FEATURE') return ['FEATURE'];
    if (filter.backlogLevel === 'STORY') return ['STORY', 'BUG', 'TASK'];
    return undefined;
  }

  private async broadcastBoardChange(
    projectId: string,
    boardId: string,
    actorId: string,
    action: 'created' | 'updated' | 'deleted',
  ) {
    const memberIds = await this.repo.listProjectMemberIds(projectId);
    this.gateway?.sendToUsers?.(
      memberIds.filter((id) => id !== actorId),
      'board:updated',
      { projectId, boardId, action, actorId },
    );
  }

  private async broadcastItemMoved(
    projectId: string,
    boardId: string,
    workItemId: string,
    state: string,
    actorId: string,
  ) {
    const memberIds = await this.repo.listProjectMemberIds(projectId);
    this.gateway?.sendToUsers?.(
      memberIds.filter((id) => id !== actorId),
      'board:item-moved',
      { projectId, boardId, workItemId, state, actorId },
    );
  }

  private validateColumns(columns: BoardColumn[], projectStates: { key: string; name: string }[]) {
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new BadRequestException('A board must have at least one column');
    }

    const validStateKeys = new Set(projectStates.map((s) => s.key));
    const colIds = new Set<string>();

    for (const col of columns) {
      if (!col.id || !col.id.trim()) {
        throw new BadRequestException('Every board column must have an ID');
      }
      if (colIds.has(col.id)) {
        throw new BadRequestException(`Duplicate column ID: ${col.id}`);
      }
      colIds.add(col.id);

      if (!col.name || !col.name.trim()) {
        throw new BadRequestException('Every board column must have a name');
      }

      if (col.wipLimit !== undefined && col.wipLimit !== null) {
        if (typeof col.wipLimit !== 'number' || col.wipLimit < 0) {
          throw new BadRequestException(`Invalid WIP limit for column "${col.name}"`);
        }
      }

      if (!Array.isArray(col.mappedStates)) {
        throw new BadRequestException(`Column "${col.name}" must have mappedStates array`);
      }

      if (validStateKeys.size > 0) {
        for (const stateKey of col.mappedStates) {
          if (!validStateKeys.has(stateKey)) {
            throw new BadRequestException(
              `State "${stateKey}" mapped in column "${col.name}" is not defined in the project work-item workflow`,
            );
          }
        }
      }
    }

    // Board presentation maps workflow states to columns. Every state must be
    // covered by exactly one column so cards never disappear from the board or
    // render in multiple columns, and so drag targets stay unambiguous.
    if (validStateKeys.size > 0) {
      const coverage = new Map<string, { count: number; columns: string[] }>();
      for (const col of columns) {
        for (const stateKey of col.mappedStates) {
          const entry = coverage.get(stateKey) ?? { count: 0, columns: [] };
          entry.count += 1;
          entry.columns.push(col.name);
          coverage.set(stateKey, entry);
        }
      }

      const duplicated = [...coverage.entries()].filter(([, e]) => e.count > 1);
      if (duplicated.length > 0) {
        throw new BadRequestException(
          `Workflow state "${duplicated[0][0]}" is mapped to more than one column (${duplicated[0][1].columns.join(', ')}). Each state must map to exactly one column.`,
        );
      }

      const missing = [...validStateKeys].filter((key) => !coverage.has(key));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Every workflow state must map to a column. States not mapped: ${missing.join(', ')}`,
        );
      }
    }
  }

  private generateDefaultColumns(projectStates: { key: string; name: string }[]): BoardColumn[] {
    if (projectStates.length === 0) {
      return [
        { id: 'col-todo', name: 'To Do', mappedStates: ['TODO'], wipLimit: null },
        { id: 'col-in-progress', name: 'In Progress', mappedStates: ['IN_PROGRESS'], wipLimit: 5 },
        { id: 'col-done', name: 'Done', mappedStates: ['DONE'], wipLimit: null },
      ];
    }

    return projectStates.map((s, index) => ({
      id: `col-${s.key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: s.name,
      mappedStates: [s.key],
      wipLimit: index === 1 ? 5 : null,
    }));
  }

  private async seedDefaultBoard(projectId: string, teamId?: string | null): Promise<BoardRow> {
    const projectStates = await this.repo.getProjectStates(projectId);
    const columns = this.generateDefaultColumns(projectStates);

    return this.repo.create({
      projectId,
      teamId: teamId || null,
      name: 'Main Board',
      description: 'Default project kanban board',
      isDefault: true,
      swimlane: 'none',
      columns,
      cardFields: DEFAULT_CARD_FIELDS,
      filterConfig: { backlogLevel: 'STORY' },
    });
  }
}
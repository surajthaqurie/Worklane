import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BoardsRepository, BoardRow } from './boards.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { WorkItemsService } from '../work-items/work-items.service.js';
import { CreateBoardDto, UpdateBoardDto, BoardColumn, CardFields, FilterConfig } from './dto/boards.dto.js';

const DEFAULT_CARD_FIELDS: CardFields = {
  showType: true,
  showPriority: true,
  showAssignee: true,
  showPoints: true,
  showParent: true,
  showTags: true,
};

@Injectable()
export class BoardsService {
  constructor(
    private readonly repo: BoardsRepository,
    private readonly projectsService: ProjectsService,
    private readonly workItemsService: WorkItemsService,
  ) {}

  async listBoards(userId: string, projectId: string, teamId?: string | null): Promise<BoardRow[]> {
    await this.projectsService.assertProjectMember(projectId, userId);
    const boards = await this.repo.listByProject(projectId, teamId);
    if (boards.length === 0) {
      const defaultBoard = await this.seedDefaultBoard(projectId, teamId);
      return [defaultBoard];
    }
    return boards;
  }

  async getBoard(userId: string, projectId: string, boardId: string): Promise<BoardRow> {
    await this.projectsService.assertProjectMember(projectId, userId);
    if (boardId === 'default') {
      const boards = await this.listBoards(userId, projectId);
      return boards[0];
    }
    const board = await this.repo.getById(projectId, boardId);
    if (!board) {
      throw new NotFoundException('Board not found');
    }
    return board;
  }

  async createBoard(userId: string, projectId: string, dto: CreateBoardDto): Promise<BoardRow> {
    await this.projectsService.assertProjectMember(projectId, userId);
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('Board name is required');
    }

    const projectStates = await this.repo.getProjectStates(projectId);
    const columns = dto.columns || this.generateDefaultColumns(projectStates);
    this.validateColumns(columns, projectStates);

    const cardFields = { ...DEFAULT_CARD_FIELDS, ...(dto.cardFields || {}) };
    const filterConfig = dto.filterConfig || {};

    return this.repo.create({
      projectId,
      teamId: dto.teamId || null,
      name,
      description: dto.description?.trim() || null,
      isDefault: false,
      columns,
      cardFields,
      filterConfig,
    });
  }

  async updateBoard(
    userId: string,
    projectId: string,
    boardId: string,
    dto: UpdateBoardDto,
  ): Promise<BoardRow> {
    await this.projectsService.assertProjectMember(projectId, userId);
    const existing = await this.repo.getById(projectId, boardId);
    if (!existing) {
      throw new NotFoundException('Board not found');
    }

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Board name cannot be empty');
    }

    const projectStates = await this.repo.getProjectStates(projectId);
    let columns = existing.columns;
    if (dto.columns !== undefined) {
      columns = dto.columns;
      this.validateColumns(columns, projectStates);
    }

    let cardFields = existing.cardFields;
    if (dto.cardFields !== undefined) {
      cardFields = { ...DEFAULT_CARD_FIELDS, ...existing.cardFields, ...dto.cardFields };
    }

    let filterConfig = existing.filterConfig;
    if (dto.filterConfig !== undefined) {
      filterConfig = { ...existing.filterConfig, ...dto.filterConfig };
    }

    return this.repo.update(boardId, {
      name: dto.name?.trim(),
      description: dto.description,
      teamId: dto.teamId,
      isDefault: dto.isDefault,
      columns,
      cardFields,
      filterConfig,
    });
  }

  async deleteBoard(userId: string, projectId: string, boardId: string): Promise<{ success: boolean }> {
    await this.projectsService.assertProjectMember(projectId, userId);
    const existing = await this.repo.getById(projectId, boardId);
    if (!existing) {
      throw new NotFoundException('Board not found');
    }

    const allBoards = await this.repo.listByProject(projectId);
    if (allBoards.length <= 1) {
      throw new BadRequestException('Cannot delete the last board in a project');
    }

    await this.repo.remove(boardId);
    return { success: true };
  }

  async getBoardWorkItems(
    userId: string,
    projectId: string,
    boardId: string,
    queryFilters: Record<string, any> = {},
  ) {
    let board: BoardRow;
    if (boardId === 'default') {
      const boards = await this.listBoards(userId, projectId, queryFilters.teamId);
      board = boards[0];
    } else {
      board = await this.getBoard(userId, projectId, boardId);
    }

    const mergedFilters = {
      ...board.filterConfig,
      ...queryFilters,
      search: queryFilters.search ?? board.filterConfig?.search ?? undefined,
      assignedTo: queryFilters.assignedTo ?? board.filterConfig?.assignedTo ?? undefined,
      tags: queryFilters.tags ?? board.filterConfig?.tags ?? undefined,
      iterationId: queryFilters.iterationId ?? board.filterConfig?.iterationId ?? undefined,
      areaId: queryFilters.areaId ?? board.filterConfig?.areaId ?? undefined,
      teamId: queryFilters.teamId || board.teamId || undefined,
    };

    return this.workItemsService.findAll(userId, projectId, mergedFilters);
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
      columns,
      cardFields: DEFAULT_CARD_FIELDS,
      filterConfig: { backlogLevel: 'STORY' },
    });
  }
}

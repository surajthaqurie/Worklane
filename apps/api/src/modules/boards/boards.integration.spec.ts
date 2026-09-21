import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { BoardsService } from './boards.service.js';
import { BoardsRepository } from './boards.repository.js';
import { WorkItemsService } from '../work-items/work-items.service.js';
import { WorkItemTransitionsService } from '../work-items/work-item-transitions.service.js';
import { WorkItemsRepository } from '../work-items/work-items.repository.js';
import { WorkItemTypeRegistryService } from '../work-items/work-item-types.registry.js';
import { WorkItemHistoryRepository } from '../work-item-history/work-item-history.repository.js';
import { WorkItemHistoryService } from '../work-item-history/work-item-history.service.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TeamsRepository } from '../teams/teams.repository.js';
import { TeamsService } from '../teams/teams.service.js';
import { NotificationsRepository } from '../notifications/notifications.repository.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { WipLimitExceededException } from '../../common/exceptions/wip-limit.exception.js';
import { db } from '../../db/kysely.js';
import { vi } from 'vitest';

// Runs only when a real Postgres is available at DATABASE_URL / localhost:5434.
//   INTEGRATION=1 npx vitest run src/modules/boards/boards.integration.spec.ts
const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('Board swimlanes & WIP enforcement (DB integration)', () => {
  let boardsService: BoardsService;
  let workItemsService: WorkItemsService;
  let transitionsService: WorkItemTransitionsService;
  let teamsService: TeamsService;
  let gateway: {
    sendToUsers: ReturnType<typeof vi.fn>;
    sendNotificationToUser: ReturnType<typeof vi.fn>;
  };

  let project: { id: string; key: string };
  let owner: { id: string };
  let member: { id: string };
  let outsider: { id: string };

  const createdIds: string[] = [];
  const createdBoardIds: string[] = [];
  const createdStateIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await db.deleteFrom('work_items').where('id', '=', id).execute().catch(() => {});
    }
    for (const id of createdBoardIds) {
      await db.deleteFrom('boards').where('id', '=', id).execute().catch(() => {});
    }
    for (const id of createdStateIds) {
      await db
        .deleteFrom('work_item_states')
        .where('id', '=', id)
        .execute()
        .catch(() => {});
    }
  });

  beforeAll(async () => {
    gateway = {
      sendToUsers: vi.fn(),
      sendNotificationToUser: vi.fn(),
    };
    const history = new WorkItemHistoryService(new WorkItemHistoryRepository());
    const workItemsRepo = new WorkItemsRepository(history);
    const authz = new AuthorizationService();
    const notifications = new NotificationsService(
      new NotificationsRepository(),
      gateway as any,
      authz,
      { dispatchJob: async () => ({ job: {}, isDuplicate: false }) } as any,
    );

    const projectsRepo = new ProjectsRepository();
    const projectsService = new ProjectsService(projectsRepo, authz);
    teamsService = new TeamsService(new TeamsRepository(), projectsService, authz);

    const typeRegistry = new WorkItemTypeRegistryService();
    workItemsService = new WorkItemsService(
      workItemsRepo,
      projectsService,
      teamsService,
      authz,
      notifications,
      typeRegistry,
    );
    transitionsService = new WorkItemTransitionsService(workItemsRepo, authz, notifications);
    boardsService = new BoardsService(
      new BoardsRepository(),
      projectsService,
      workItemsService,
      teamsService,
      transitionsService,
      gateway as any,
      authz,
    );

    const users = await db
      .selectFrom('users')
      .select(['id'])
      .orderBy('created_at', 'asc')
      .limit(3)
      .execute();
    if (users.length < 3) {
      throw new Error('Seeded dev data missing (need at least 3 users)');
    }
    owner = users[0];
    member = users[1];
    outsider = users[2];

    project = await projectsRepo.createProject({
      name: `Board Project ${Date.now()}`,
      key: `BD${Date.now().toString().slice(-6)}`,
      description: 'Created by board integration test',
      created_by: owner.id,
      organization_id: '00000000-0000-0000-0000-000000000000',
    });
    await projectsService.addMember(owner.id, project.id, member.id, 'MEMBER');
  });

  afterAll(async () => {
    for (const id of createdBoardIds) {
      await db.deleteFrom('boards').where('id', '=', id).execute().catch(() => {});
    }
    for (const id of createdIds) {
      await db.deleteFrom('work_items').where('id', '=', id).execute().catch(() => {});
    }
    await db.deleteFrom('projects').where('id', '=', project.id).execute().catch(() => {});
  });

  const defaultColumns = [
    { id: 'c-todo', name: 'To Do', mappedStates: ['TODO'], wipLimit: null },
    { id: 'c-wip', name: 'In Progress', mappedStates: ['IN_PROGRESS'], wipLimit: null },
    { id: 'c-done', name: 'Done', mappedStates: ['DONE'], wipLimit: null },
  ];

  it('persists the swimlane mode on the board and rejects unknown modes', async () => {
    const board = await boardsService.createBoard(owner.id, project.id, {
      name: 'EPIC Swimlane',
      swimlane: 'epic',
      columns: defaultColumns,
    });
    createdBoardIds.push(board.id);
    expect(board.swimlane).toBe('epic');

    const row = await db
      .selectFrom('boards')
      .where('id', '=', board.id)
      .select('swimlane')
      .executeTakeFirst();
    expect(row?.swimlane).toBe('epic');

    await expect(
      boardsService.createBoard(owner.id, project.id, {
        name: 'Bad Swimlane',
        swimlane: 'galaxy' as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces per-column WIP limits on drag moves with structured feedback', async () => {
    const board = await boardsService.createBoard(owner.id, project.id, {
      name: `WIP ${Date.now()}`,
      columns: [
        { id: 'c-todo', name: 'To Do', mappedStates: ['TODO'], wipLimit: null },
        { id: 'c-wip', name: 'In Progress', mappedStates: ['IN_PROGRESS'], wipLimit: 1 },
        { id: 'c-done', name: 'Done', mappedStates: ['DONE'], wipLimit: null },
      ],
    });
    createdBoardIds.push(board.id);

    const a = await workItemsService.create(owner.id, project.id, {
      type: 'STORY',
      title: 'WIP Item A',
    });
    const b = await workItemsService.create(owner.id, project.id, {
      type: 'STORY',
      title: 'WIP Item B',
    });
    createdIds.push(a.id, b.id);

    // First move is under the limit → succeeds.
    await boardsService.moveWorkItem(owner.id, project.id, board.id, a.id, {
      state: 'IN_PROGRESS',
    });

    // Second move would exceed the limit → rejected with structured 409.
    await expect(
      boardsService.moveWorkItem(owner.id, project.id, board.id, b.id, {
        state: 'IN_PROGRESS',
      }),
    ).rejects.toThrow(WipLimitExceededException);

    try {
      await boardsService.moveWorkItem(owner.id, project.id, board.id, b.id, {
        state: 'IN_PROGRESS',
      });
      expect.unreachable('expected WIP rejection');
    } catch (err) {
      const body = (err as any).getResponse();
      expect(body.details.code).toBe('WIP_LIMIT_EXCEEDED');
      expect(body.details.columnName).toBe('In Progress');
      expect(body.details.currentCount).toBe(1);
      expect(body.details.wipLimit).toBe(1);
    }

    // The project-wide state transition endpoint must NOT enforce board WIP:
    // WIP is a board presentation rule, not a workflow rule.
    await expect(
      transitionsService.transitionState(owner.id, b.id, 'IN_PROGRESS'),
    ).resolves.toMatchObject({ state: 'IN_PROGRESS' });
    // Restore B to TODO so the next assertions are isolated.
    await transitionsService.transitionState(owner.id, b.id, 'TODO');

    // A member may override the limit explicitly and the move succeeds.
    const overridden = await boardsService.moveWorkItem(member.id, project.id, board.id, b.id, {
      state: 'IN_PROGRESS',
      bypassWip: true,
    });
    expect(overridden.state).toBe('IN_PROGRESS');
  });

  it('does not enforce WIP for same-column moves and broadcasts real-time events', async () => {
    // A column mapping two states: moving between them never changes the count.
    const inserted = await db
      .insertInto('work_item_states')
      .values({
        project_id: project.id,
        name: 'In Review',
        key: 'IN_REVIEW',
        color: '#A855F7',
        sort_order: 2,
        category: 'IN_PROGRESS',
        is_done: false,
        is_default: false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    createdStateIds.push(inserted.id);

    const board = await boardsService.createBoard(owner.id, project.id, {
      name: `SameCol ${Date.now()}`,
      columns: [
        { id: 'c-todo', name: 'To Do', mappedStates: ['TODO'], wipLimit: null },
        { id: 'c-wip', name: 'Active', mappedStates: ['IN_PROGRESS', 'IN_REVIEW'], wipLimit: 1 },
        { id: 'c-done', name: 'Done', mappedStates: ['DONE'], wipLimit: null },
      ],
    });
    createdBoardIds.push(board.id);

    const item = await workItemsService.create(owner.id, project.id, {
      type: 'STORY',
      title: 'Same-column item',
    });
    createdIds.push(item.id);

    // Fill the column to its limit.
    const filler = await workItemsService.create(owner.id, project.id, {
      type: 'STORY',
      title: 'Filler item',
    });
    createdIds.push(filler.id);
    await boardsService.moveWorkItem(owner.id, project.id, board.id, filler.id, {
      state: 'IN_PROGRESS',
    });

    // Moving INTO the full column from elsewhere is still blocked.
    await expect(
      boardsService.moveWorkItem(owner.id, project.id, board.id, item.id, {
        state: 'IN_PROGRESS',
      }),
    ).rejects.toThrow(WipLimitExceededException);

    // …but moving the filler between states INSIDE the same column is fine,
    // because the column count is unchanged.
    const moved = await boardsService.moveWorkItem(
      owner.id,
      project.id,
      board.id,
      filler.id,
      { state: 'IN_REVIEW' },
    );
    expect(moved.state).toBe('IN_REVIEW');

    // A successful move broadcasts to the other project member only.
    gateway.sendToUsers.mockClear();
    await boardsService.moveWorkItem(
      owner.id,
      project.id,
      board.id,
      filler.id,
      { state: 'DONE' },
    );
    expect(gateway.sendToUsers).toHaveBeenCalledWith(
      expect.arrayContaining([member.id]),
      'board:item-moved',
      expect.objectContaining({ projectId: project.id, state: 'DONE' }),
    );
    const recipients = gateway.sendToUsers.mock.calls[0][0];
    expect(recipients).not.toContain(owner.id);
  });

  it('enforces board configuration permissions across roles', async () => {
    // A plain MEMBER cannot create or reconfigure boards…
    await expect(
      boardsService.createBoard(member.id, project.id, { name: 'Member Board' }),
    ).rejects.toThrow(ForbiddenException);

    const board = await boardsService.createBoard(owner.id, project.id, {
      name: 'Perm Board',
      columns: defaultColumns,
    });
    createdBoardIds.push(board.id);

    await expect(
      boardsService.updateBoard(member.id, project.id, board.id, { name: 'Hijack' }),
    ).rejects.toThrow(ForbiddenException);

    // …and users outside the project cannot even view the board.
    await expect(
      boardsService.getBoard(outsider.id, project.id, board.id),
    ).rejects.toThrow(ForbiddenException);

    // Reconfiguration by an OWNER succeeds and is broadcast.
    gateway.sendToUsers.mockClear();
    const updated = await boardsService.updateBoard(owner.id, project.id, board.id, {
      name: 'Perm Board v2',
      swimlane: 'priority',
    });
    expect(updated.name).toBe('Perm Board v2');
    expect(updated.swimlane).toBe('priority');
    expect(gateway.sendToUsers).toHaveBeenCalledWith(
      expect.any(Array),
      'board:updated',
      expect.objectContaining({ boardId: board.id, action: 'updated' }),
    );
  });
});
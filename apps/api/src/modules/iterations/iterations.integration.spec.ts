import { BadRequestException } from '@nestjs/common';
import { IterationsService } from './iterations.service.js';
import { IterationsRepository } from './iterations.repository.js';
import { WorkItemHistoryRepository } from '../work-item-history/work-item-history.repository.js';
import { WorkItemHistoryService } from '../work-item-history/work-item-history.service.js';
import { db } from '../../db/kysely.js';

// Runs only when a real Postgres is available at DATABASE_URL / localhost:5434.
//   INTEGRATION=1 npx vitest run src/modules/iterations/iterations.integration.spec.ts
// Start it with `docker compose up -d db` and apply db/migrations/*.sql in order.
const INTEGRATION = process.env.INTEGRATION === '1';
const T = (ms: number) => new Date(Date.now() + ms).toISOString();

describe.skipIf(!INTEGRATION)('IterationsService (DB integration)', () => {
  let service: IterationsService;
  let projectId: string;
  let userId: string;
  let areaId: string;
  const createdIterationIds: string[] = [];
  const createdWorkItemIds: string[] = [];
  let makeIterationCalls = 0;

  beforeAll(async () => {
    service = new IterationsService(
      new IterationsRepository(
        new WorkItemHistoryService(new WorkItemHistoryRepository()),
      ),
      {
        assertTeamMember: async () => ({}),
        getTeamScope: async () => ({ areaIds: [], iterationIds: [] }),
      } as any,
      {
        requireProjectPermission: async () => ({ role: 'OWNER' }),
        requireProjectPermissionWithProject: async (pid: string) => ({
          project: { id: pid, key: 'APP' },
          membership: { projectId: pid, userId: 'user-id', role: 'OWNER' },
        }),
      } as any,
      {
        notifyIterationStarted: async () => {},
        notifyIterationCompleted: async () => {},
        notifyAddedToSprint: async () => {},
        notifyRemovedFromSprint: async () => {},
      } as any,
    );

    // Remove leftovers from any previous aborted run
    await db
      .deleteFrom('work_items')
      .where('title', 'in', ['Board story', 'Remove scoping story'])
      .execute()
      .catch(() => {});
    await db
      .deleteFrom('iterations')
      .where('name', 'like', 'IT %')
      .execute()
      .catch(() => {});
    await db
      .updateTable('iterations')
      .set({ state: 'PLANNED' })
      .where('state', '=', 'ACTIVE')
      .execute()
      .catch(() => {});

    const project = await db
      .selectFrom('projects')
      .select('id')
      .orderBy('created_at', 'asc')
      .limit(1)
      .executeTakeFirst();
    const user = await db.selectFrom('users').select('id').limit(1).executeTakeFirst();
    const area = await db.selectFrom('areas').select('id').limit(1).executeTakeFirst();
    if (!project || !user || !area) {
      throw new Error('Seeded dev data missing (org/user/project/area)');
    }
    projectId = project.id;
    userId = user.id;
    areaId = area.id;

    // Ensure the project has the default workflow states used by makeWorkItem
    // (fk_work_items_state requires the state to exist for the project).
    await db
      .insertInto('work_item_states')
      .values([
        { project_id: projectId, key: 'TODO', name: 'To Do', color: '#94A3B8', sort_order: 0, is_done: false, is_default: true },
        { project_id: projectId, key: 'IN_PROGRESS', name: 'In Progress', color: '#3B82F6', sort_order: 1, is_done: false },
        { project_id: projectId, key: 'DONE', name: 'Done', color: '#22C55E', sort_order: 2, is_done: true },
      ])
      .onConflict((oc) => oc.columns(['project_id', 'key']).doNothing())
      .execute();
  });

  afterAll(async () => {
    for (const id of createdWorkItemIds) {
      await db.deleteFrom('work_items').where('id', '=', id).execute().catch(() => {});
    }
    for (const id of createdIterationIds) {
      await db
        .deleteFrom('iterations')
        .where('id', '=', id)
        .execute()
        .catch(() => {});
    }
  });

  async function makeIteration(name: string, parentId?: string) {
    const window = (makeIterationCalls += 1) * 15; // days, unique per sibling group
    const it = await service.create(userId, projectId, {
      name,
      startDate: T((120 + window) * 86400000),
      endDate: T((130 + window) * 86400000),
      parentId,
    });
    createdIterationIds.push(it.id);
    return it;
  }

  async function makeWorkItem(title: string, state: string, iterationId?: string) {
    const project = await db
      .selectFrom('projects')
      .select('next_work_item_seq')
      .where('id', '=', projectId)
      .executeTakeFirstOrThrow();
    const seqNo = project.next_work_item_seq;
    const inserted = await db
      .insertInto('work_items')
      .values({
        project_id: projectId,
        area_id: areaId,
        seq_no: seqNo,
        parent_id: null,
        type: 'STORY',
        title,
        description: null,
        state,
        priority: 'MEDIUM',
        points: null,
        assigned_to: null,
        created_by: userId,
        iteration_id: iterationId ?? null,
        closed_at: null,
        backlog_order: seqNo,
        backlog_rank: seqNo * 1000,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    await db
      .updateTable('projects')
      .set({ next_work_item_seq: seqNo + 1 })
      .where('id', '=', projectId)
      .execute();
    createdWorkItemIds.push(inserted.id);
    return inserted.id;
  }

  // ─── Create / hierarchy / path ─────────────────────────────────────────────

  it('creates root and child iterations with correct paths and ordering', async () => {
    const root = await makeIteration(`IT Root ${Date.now()}`);
    expect(root.id).toBeTruthy();
    expect(root.parentId).toBeNull();

    const child = await makeIteration('IT Child', root.id);
    expect(child.parentId).toBe(root.id);

    const grandchild = await makeIteration('IT Grandchild', child.id);

    const all = await service.findAllByProject(userId, projectId);
    const map = new Map(all.map((i) => [i.id, i]));
    expect(map.get(root.id)?.path).toBe(root.name);
    expect(map.get(root.id)?.order).toBeGreaterThanOrEqual(1);
    expect(map.get(root.id)?.order).toBeLessThan(map.get(child.id)!.order!);
    expect(map.get(root.id)?.hasChildren).toBe(true);
    expect(map.get(child.id)?.path).toBe(`${root.name}\\IT Child`);
    expect(map.get(child.id)?.order).toBeLessThan(map.get(grandchild.id)!.order!);
    expect(map.get(child.id)?.hasChildren).toBe(true);
    expect(map.get(grandchild.id)?.path).toBe(
      `${root.name}\\IT Child\\IT Grandchild`,
    );
  });

  it('rejects creating a child into a parent from another project', async () => {
    await expect(
      service.create(userId, projectId, {
        name: 'Bad parent',
        startDate: T(140 * 86400000),
        endDate: T(150 * 86400000),
        parentId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Update + history ──────────────────────────────────────────────────────

  it('updates an iteration and records NAME_CHANGED history', async () => {
    const it = await makeIteration(`IT Update ${Date.now()}`);
    const updated = await service.update(userId, projectId, it.id, {
      name: 'IT Updated Name',
    });
    expect(updated.name).toBe('IT Updated Name');

    const history = await db
      .selectFrom('iteration_history')
      .where('iteration_id', '=', it.id)
      .selectAll()
      .execute();
    expect(history.some((h) => h.action === 'NAME_CHANGED')).toBe(true);
  });

  // ─── Activate (single active sprint per project) ───────────────────────────

  it('enforces a single active sprint per project, freed by completion', async () => {
    const a = await makeIteration(`IT Active A ${Date.now()}`);
    const b = await makeIteration(`IT Active B ${Date.now()}`);

    expect((await service.activate(userId, projectId, a.id)).state).toBe('ACTIVE');

    await expect(service.activate(userId, projectId, b.id)).rejects.toThrow(
      BadRequestException,
    );

    await service.completeIteration(userId, projectId, a.id, {
      incompleteAction: 'MOVE_TO_BACKLOG',
    });

    expect((await service.activate(userId, projectId, b.id)).state).toBe('ACTIVE');
    await service.completeIteration(userId, projectId, b.id, {
      incompleteAction: 'MOVE_TO_BACKLOG',
    });
  });

  // ─── Board / completion ────────────────────────────────────────────────────

  it('boards group items by state (including empty columns) and completion moves incomplete items out', async () => {
    const it = await makeIteration(`IT Board ${Date.now()}`);
    expect((await service.activate(userId, projectId, it.id)).state).toBe('ACTIVE');

    const wi = await makeWorkItem('Board story', 'IN_PROGRESS');
    await service.addWorkItems(userId, projectId, it.id, { workItemIds: [wi] });

    const board = await service.getSprintBoard(userId, projectId, it.id);
    expect(board.states.map((s) => s.key)).toEqual(expect.arrayContaining(['DONE', 'IN_PROGRESS']));
    expect(board.states.every((s) => s.id)).toBe(true);
    expect(board.total).toBe(1);
    expect(board.groups.find((g) => g.state.key === 'IN_PROGRESS')?.items).toHaveLength(1);
    expect(board.groups.find((g) => g.state.key === 'DONE')?.items).toHaveLength(0);

    const done = await service.completeIteration(userId, projectId, it.id, {
      incompleteAction: 'MOVE_TO_BACKLOG',
    });
    expect(done.movedCount).toBe(1);
    expect(done.iteration?.state).toBe('COMPLETED');

    const row = await db
      .selectFrom('work_items')
      .where('id', '=', wi)
      .select('iteration_id')
      .executeTakeFirst();
    expect(row?.iteration_id).toBeNull();
  });

  async function freeActiveSprint() {
    const active = await db
      .selectFrom('iterations')
      .where('project_id', '=', projectId)
      .where('state', '=', 'ACTIVE')
      .select('id')
      .executeTakeFirst();
    if (active) {
      await service.completeIteration(userId, projectId, active.id, {
        incompleteAction: 'MOVE_TO_BACKLOG',
      });
    }
  }

  it('rejects completing a sprint into itself', async () => {
    await freeActiveSprint();
    const it = await makeIteration(`IT Self ${Date.now()}`);
    await service.activate(userId, projectId, it.id);
    await expect(
      service.completeIteration(userId, projectId, it.id, {
        incompleteAction: 'MOVE_TO_NEXT',
        targetIterationId: it.id,
      }),
    ).rejects.toThrow(BadRequestException);
    await service.completeIteration(userId, projectId, it.id, {
      incompleteAction: 'MOVE_TO_BACKLOG',
    });
  });

  // ─── Remove work item scoping ──────────────────────────────────────────────

  it('only removes work items assigned to the iteration', async () => {
    const it = await makeIteration(`IT Remove ${Date.now()}`);
    const wi = await makeWorkItem('Remove scoping story', 'DONE');

    // Not assigned to this iteration → rejected
    await expect(
      service.removeWorkItem(userId, projectId, it.id, wi),
    ).rejects.toThrow(BadRequestException);

    // Assigned → removed back to the backlog
    await service.addWorkItems(userId, projectId, it.id, { workItemIds: [wi] });
    await service.removeWorkItem(userId, projectId, it.id, wi);
    const row = await db
      .selectFrom('work_items')
      .where('id', '=', wi)
      .select('iteration_id')
      .executeTakeFirst();
    expect(row?.iteration_id).toBeNull();
  });

  // ─── Delete guards ─────────────────────────────────────────────────────────

  it('blocks deleting an iteration with children', async () => {
    const root = await makeIteration(`IT Del Root ${Date.now()}`);
    const child = await makeIteration('IT Del Child', root.id);
    await expect(service.remove(userId, projectId, root.id)).rejects.toThrow(
      BadRequestException,
    );
    await service.remove(userId, projectId, child.id);
  });
});
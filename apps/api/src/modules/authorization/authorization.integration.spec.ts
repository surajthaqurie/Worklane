import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthorizationService } from './authorization.service.js';
import { Permission } from './permissions.js';
import { ProjectsService } from '../projects/projects.service.js';
import { db } from '../../db/kysely.js';

// Runs when DATABASE_URL / localhost:5434 is available.
// Run with: INTEGRATION=1 pnpm --filter api test -- --run
const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('Authorization Boundaries (DB Integration)', () => {
  let authzService: AuthorizationService;
  let projectsService: ProjectsService;

  let ownerUserId: string;
  let memberUserId: string;
  let nonMemberUserId: string;

  let projectAId: string;
  let projectBId: string;

  let itemInProjectA: string;
  let itemInProjectB: string;

  beforeAll(async () => {
    authzService = new AuthorizationService();

    // 1. Fetch seed users or create test users
    const users = await db.selectFrom('users').select('id').limit(3).execute();
    if (users.length < 3) {
      throw new Error('Seeded dev data requires at least 3 users');
    }
    ownerUserId = users[0].id;
    memberUserId = users[1].id;
    nonMemberUserId = users[2].id;

    // 2. Setup Project A owned by ownerUserId, with memberUserId as MEMBER
    projectsService = new ProjectsService(
      {
        getProjectById: async (id: string) => {
          const row = await db.selectFrom('projects').where('id', '=', id).selectAll().executeTakeFirst();
          return row ?? null;
        },
        createProject: async (data: any) => {
          const project = await db
            .insertInto('projects')
            .values({
              name: data.name,
              key: data.key,
              description: data.description || null,
              created_by: data.created_by,
              organization_id: data.organization_id,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

          await db
            .insertInto('project_members')
            .values({ project_id: project.id, user_id: data.created_by, role: 'OWNER' })
            .execute();

          return project;
        },
        updateProject: async () => {},
        deleteProject: async () => {},
        addMember: async (pid: string, uid: string, role: any) => {
          await db
            .insertInto('project_members')
            .values({ project_id: pid, user_id: uid, role })
            .onConflict((oc) => oc.columns(['project_id', 'user_id']).doUpdateSet({ role }))
            .execute();
        },
        getMembers: async (pid: string) => {
          return db
            .selectFrom('project_members')
            .innerJoin('users', 'project_members.user_id', 'users.id')
            .where('project_members.project_id', '=', pid)
            .select(['users.id as userId', 'project_members.role'])
            .execute();
        },
      } as any,
      authzService,
    );

    const projA = await projectsService.create(ownerUserId, {
      name: 'Authz Project A',
      key: `AUTHA${Date.now() % 10000}`,
    });
    projectAId = projA.id;

    await projectsService.addMember(ownerUserId, projectAId, memberUserId, 'MEMBER');

    // 3. Setup Project B owned by nonMemberUserId
    const projB = await projectsService.create(nonMemberUserId, {
      name: 'Authz Project B',
      key: `AUTHB${Date.now() % 10000}`,
    });
    projectBId = projB.id;

    // Create a work item in Project A
    const areaA = await db.selectFrom('areas').where('project_id', '=', projectAId).select('id').executeTakeFirstOrThrow();
    const itemA = await db
      .insertInto('work_items')
      .values({
        project_id: projectAId,
        area_id: areaA.id,
        seq_no: 1,
        type: 'STORY',
        title: 'Item in Project A',
        state: 'New',
        created_by: ownerUserId,
        backlog_order: 1,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    itemInProjectA = itemA.id;

    // Create a work item in Project B
    const areaB = await db.selectFrom('areas').where('project_id', '=', projectBId).select('id').executeTakeFirstOrThrow();
    const itemB = await db
      .insertInto('work_items')
      .values({
        project_id: projectBId,
        area_id: areaB.id,
        seq_no: 1,
        type: 'EPIC',
        title: 'Item in Project B',
        state: 'New',
        created_by: nonMemberUserId,
        backlog_order: 1,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    itemInProjectB = itemB.id;
  });

  afterAll(async () => {
    await db.deleteFrom('work_items').where('id', 'in', [itemInProjectA, itemInProjectB]).execute().catch(() => {});
    await db.deleteFrom('projects').where('id', 'in', [projectAId, projectBId]).execute().catch(() => {});
  });

  // ─── 1. Cross-Project Access ───────────────────────────────────────────────

  it('prevents non-members from reading work items in another project', async () => {
    await expect(
      authzService.requireProjectPermission(projectAId, nonMemberUserId, Permission.WORK_ITEM_VIEW),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents setting parent from a different project (cross-project parent assignment)', async () => {
    // Attempt to set itemInProjectB (Project B) as parent for itemInProjectA (Project A)
    const workItemsService = new WorkItemsService(
      {
        getWorkItemById: async (id: string) => {
          const item = await db.selectFrom('work_items').where('id', '=', id).selectAll().executeTakeFirst();
          return item ? { ...item, tags: [] } : undefined;
        },
      } as any,
      projectsService,
      {} as any,
      authzService,
    );

    await expect(
      workItemsService.update(ownerUserId, itemInProjectA, { parentId: itemInProjectB }),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── 2. Role-Based Action Permissions ─────────────────────────────────────

  it('prevents MEMBER from deleting work items (requires ADMIN or OWNER)', async () => {
    const workItemsService = new WorkItemsService(
      {
        getWorkItemById: async (id: string) => {
          const item = await db.selectFrom('work_items').where('id', '=', id).selectAll().executeTakeFirst();
          return item ? { ...item, tags: [] } : undefined;
        },
      } as any,
      projectsService,
      {} as any,
      authzService,
    );

    // memberUserId has MEMBER role in Project A
    await expect(
      workItemsService.remove(memberUserId, itemInProjectA),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows OWNER/ADMIN to delete work items', async () => {
    const role = await authzService.getProjectRole(projectAId, ownerUserId);
    expect(role).toBe('OWNER');

    const perm = await authzService.requireProjectPermission(
      projectAId,
      ownerUserId,
      Permission.WORK_ITEM_DELETE,
    );
    expect(perm.role).toBe('OWNER');
  });

  it('prevents MEMBER from creating iterations (requires ADMIN or OWNER)', async () => {
    const iterationsService = new IterationsService(
      {} as any,
      projectsService,
      {} as any,
      authzService,
    );

    await expect(
      iterationsService.create(memberUserId, projectAId, {
        name: 'Unauthorized Sprint',
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-02-14T00:00:00.000Z',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents MEMBER from managing teams (requires ADMIN or OWNER)', async () => {
    const teamsService = new TeamsService(
      {} as any,
      projectsService,
      authzService,
    );

    await expect(
      teamsService.create(memberUserId, projectAId, { name: 'Unauthorized Team' }),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── 3. State Transition Authorization ────────────────────────────────────

  it('prevents non-project member from transitioning work item state', async () => {
    const transitionsService = new WorkItemTransitionsService(
      {
        getWorkItemById: async (id: string) => {
          const item = await db.selectFrom('work_items').where('id', '=', id).selectAll().executeTakeFirst();
          return item ? { ...item, tags: [] } : undefined;
        },
      } as any,
      authzService,
    );

    await expect(
      transitionsService.transitionState(nonMemberUserId, itemInProjectA, 'Active'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows project member with WORK_ITEM_CHANGE_STATE permission to transition state', async () => {
    const transitionsService = new WorkItemTransitionsService(
      {
        getWorkItemById: async (id: string) => {
          const item = await db.selectFrom('work_items').where('id', '=', id).selectAll().executeTakeFirst();
          return item ? { ...item, tags: [] } : undefined;
        },
        updateState: async () => ({ id: itemInProjectA, state: 'Active' }),
      } as any,
      authzService,
    );

    const result = await transitionsService.transitionState(memberUserId, itemInProjectA, 'Active');
    expect(result.state).toBe('Active');
  });

  // ─── 4. Assignment Authorization ────────────────────────────────────────────

  async function makeWorkItemsService(overrides: Record<string, any> = {}) {
    return new WorkItemsService(
      {
        getWorkItemById: async (id: string) => {
          const item = await db.selectFrom('work_items').where('id', '=', id).selectAll().executeTakeFirst();
          return item ? { ...item, tags: [] } : undefined;
        },
        updateWorkItem: async () => undefined,
        ...overrides,
      } as any,
      projectsService,
      {} as any,
      authzService,
      { notifyAssigned: async () => {} } as any,
    );
  }

  it('grants WORK_ITEM_ASSIGN to any project member', async () => {
    const perm = await authzService.requireProjectPermission(
      projectAId,
      memberUserId,
      Permission.WORK_ITEM_ASSIGN,
    );
    expect(perm.role).toBe('MEMBER');
  });

  it('prevents a non-member from assigning work items', async () => {
    const service = await makeWorkItemsService();

    await expect(
      service.update(nonMemberUserId, itemInProjectA, { assignedTo: memberUserId }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents assigning a work item to an iteration in another project', async () => {
    const service = await makeWorkItemsService({ getIterationProjectId: async () => projectBId });

    await expect(
      service.update(ownerUserId, itemInProjectA, { iterationId: 'some-iteration-id' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents assigning a work item from another project to a local iteration', async () => {
    const service = await makeWorkItemsService({ getIterationProjectId: async () => projectAId });

    // Item lives in Project B, iteration in Project A → mismatched scope.
    await expect(
      service.update(ownerUserId, itemInProjectB, { iterationId: 'some-iteration-id' }),
    ).rejects.toThrow(ForbiddenException);
  });
});

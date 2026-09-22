import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeliveryPlansService } from './delivery-plans.service.js';
import { DeliveryPlansRepository } from './delivery-plans.repository.js';
import { db } from '../../db/kysely.js';

// Runs only when a real Postgres is available at DATABASE_URL / localhost:5434.
//   INTEGRATION=1 npx vitest run src/modules/delivery-plans/delivery-plans.integration.spec.ts
// The spec creates its own org/project/teams/iterations/work-items and cleans
// them up afterwards.
const INTEGRATION = process.env.INTEGRATION === '1';
const T = (ms: number) => new Date(Date.now() + ms).toISOString();

describe.skipIf(!INTEGRATION)('DeliveryPlansService (DB integration)', () => {
  let service: DeliveryPlansService;
  let userId: string;
  let projectId: string;
  let otherProjectId: string;
  let orgId: string;
  let areaInScope: string;
  let areaOutOfScope: string;
  let iterationInScope: string;
  let iterationOutOfScope: string;
  let teamInScope: string;
  let teamOutOfScope: string;
  let planId: string;
  let wi1: string; // area+iteration in scope
  let wi2: string; // area in scope with explicit dates
  let wi3: string; // area of the out-of-scope team
  let wi4: string; // area in scope, no iteration and no dates → excluded
  const cleanup: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    service = new DeliveryPlansService(
      new DeliveryPlansRepository(),
      {
        requireProjectPermission: async () => ({ role: 'OWNER' }),
        requireWorkItemInProject: async (workItemId: string, pid: string) => {
          const row = await db
            .selectFrom('work_items')
            .where('id', '=', workItemId)
            .where('project_id', '=', pid)
            .select('id')
            .executeTakeFirst();
          if (!row) throw new NotFoundException('Work item not found');
        },
      } as any,
    );

    const suffix = `dp${Date.now()}`;

    const org = await db
      .insertInto('organizations')
      .values({ name: `Delivery Plan Test Org ${suffix}` })
      .returning('id')
      .executeTakeFirstOrThrow();
    orgId = org.id;
    cleanup.push(async () => {
      await db.deleteFrom('organizations').where('id', '=', orgId).execute().catch(() => {});
    });

    const user = await db
      .insertInto('users')
      .values({ name: 'Plan Tester', email: `${suffix}@worklane.dev`, password_hash: null })
      .returning('id')
      .executeTakeFirstOrThrow();
    userId = user.id;
    cleanup.push(async () => {
      await db.deleteFrom('users').where('id', '=', userId).execute().catch(() => {});
    });

    async function makeProject(name: string) {
      const project = await db
        .insertInto('projects')
        .values({
          name,
          key: suffix.toUpperCase().slice(-6),
          created_by: userId,
          organization_id: orgId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await db
        .insertInto('project_members')
        .values({ project_id: project.id, user_id: userId, role: 'OWNER' })
        .execute();
      cleanup.push(async () => {
        await db
          .deleteFrom('project_members')
          .where('project_id', '=', project.id)
          .execute()
          .catch(() => {});
        await db.deleteFrom('projects').where('id', '=', project.id).execute().catch(() => {});
      });
      return project.id;
    }

    projectId = await makeProject('Delivery Plan Project');
    otherProjectId = await makeProject('Other Delivery Plan Project');

    // Workflow states required by work_items.state FK.
    await db
      .insertInto('work_item_states')
      .values([
        { project_id: projectId, key: 'TODO', name: 'To Do', color: '#94A3B8', sort_order: 0, is_done: false, is_default: true },
        { project_id: projectId, key: 'IN_PROGRESS', name: 'In Progress', color: '#3B82F6', sort_order: 1, is_done: false },
        { project_id: projectId, key: 'DONE', name: 'Done', color: '#22C55E', sort_order: 2, is_done: true },
      ])
      .onConflict((oc) => oc.columns(['project_id', 'key']).doNothing())
      .execute();

    // Areas
    const areaA = await db
      .insertInto('areas')
      .values({ project_id: projectId, name: 'Area A' })
      .returning('id')
      .executeTakeFirstOrThrow();
    areaInScope = areaA.id;
    const areaB = await db
      .insertInto('areas')
      .values({ project_id: projectId, name: 'Area B' })
      .returning('id')
      .executeTakeFirstOrThrow();
    areaOutOfScope = areaB.id;
    const otherArea = await db
      .insertInto('areas')
      .values({ project_id: otherProjectId, name: 'Other Area' })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Iterations
    const itA = await db
      .insertInto('iterations')
      .values({
        project_id: projectId,
        name: 'Sprint In Scope',
        start_date: T(10 * 86400000),
        end_date: T(30 * 86400000),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    iterationInScope = itA.id;
    const itB = await db
      .insertInto('iterations')
      .values({
        project_id: projectId,
        name: 'Sprint Out Of Scope',
        start_date: T(40 * 86400000),
        end_date: T(60 * 86400000),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    iterationOutOfScope = itB.id;

    // Teams + memberships + scopes
    const tIn = await db
      .insertInto('teams')
      .values({ project_id: projectId, name: 'Web Team' })
      .returning('id')
      .executeTakeFirstOrThrow();
    teamInScope = tIn.id;
    const tOut = await db
      .insertInto('teams')
      .values({ project_id: projectId, name: 'Mobile Team' })
      .returning('id')
      .executeTakeFirstOrThrow();
    teamOutOfScope = tOut.id;
    const otherTeam = await db
      .insertInto('teams')
      .values({ project_id: otherProjectId, name: 'Other Team' })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db.insertInto('team_members').values({ team_id: teamInScope, user_id: userId }).execute();
    await db.insertInto('team_areas').values([
      { team_id: teamInScope, area_id: areaInScope },
      { team_id: teamOutOfScope, area_id: areaOutOfScope },
    ]).execute();
    await db.insertInto('team_iterations').values([
      { team_id: teamInScope, iteration_id: iterationInScope },
      { team_id: teamOutOfScope, iteration_id: iterationOutOfScope },
    ]).execute();

    cleanup.push(async () => {
      await db
        .deleteFrom('team_members')
        .where('team_id', 'in', [teamInScope, teamOutOfScope, otherTeam.id])
        .execute()
        .catch(() => {});
      await db
        .deleteFrom('team_areas')
        .where('team_id', 'in', [teamInScope, teamOutOfScope, otherTeam.id])
        .execute()
        .catch(() => {});
      await db
        .deleteFrom('team_iterations')
        .where('team_id', 'in', [teamInScope, teamOutOfScope, otherTeam.id])
        .execute()
        .catch(() => {});
      await db
        .deleteFrom('teams')
        .where('id', 'in', [teamInScope, teamOutOfScope, otherTeam.id])
        .execute()
        .catch(() => {});
    });

    async function makeWorkItem(title: string, areaId: string, iterationId: string | null) {
      const seqNo = await db
        .selectFrom('projects')
        .select('next_work_item_seq')
        .where('id', '=', projectId)
        .executeTakeFirstOrThrow();
      const nextSeq = seqNo.next_work_item_seq;
      const inserted = await db
        .insertInto('work_items')
        .values({
          project_id: projectId,
          area_id: areaId,
          seq_no: nextSeq,
          parent_id: null,
          type: 'STORY',
          title,
          description: null,
          state: 'TODO',
          priority: 'MEDIUM',
          points: null,
          assigned_to: null,
          created_by: userId,
          iteration_id: iterationId,
          closed_at: null,
          backlog_order: nextSeq,
          backlog_rank: nextSeq * 1000,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await db
        .updateTable('projects')
        .set({ next_work_item_seq: nextSeq + 1 })
        .where('id', '=', projectId)
        .execute();
      cleanup.push(async () => {
        await db.deleteFrom('work_items').where('id', '=', inserted.id).execute().catch(() => {});
      });
      return inserted.id;
    }

    wi1 = await makeWorkItem('In-scope item', areaInScope, iterationInScope);
    wi2 = await makeWorkItem('Dated item', areaInScope, null);
    await db
      .updateTable('work_items')
      .set({ start_date: T(12 * 86400000), target_date: T(28 * 86400000) })
      .where('id', '=', wi2)
      .execute();
    wi3 = await makeWorkItem('Out-of-scope team item', areaOutOfScope, iterationOutOfScope);
    wi4 = await makeWorkItem('Unscoped item', areaInScope, null); // no dates → hidden

    // The other project also needs workflow states before we can insert items.
    await db
      .insertInto('work_item_states')
      .values([
        { project_id: otherProjectId, key: 'TODO', name: 'To Do', color: '#94A3B8', sort_order: 0, is_done: false, is_default: true },
      ])
      .onConflict((oc) => oc.columns(['project_id', 'key']).doNothing())
      .execute();

    // Create the delivery plan wiring together both teams.
    const plan = await service.create(userId, projectId, {
      name: `Delivery Plan ${suffix}`,
      description: 'Cross-team integration plan',
      teamIds: [teamInScope, teamOutOfScope],
    });
    planId = plan.id;
    cleanup.push(async () => {
      await db
        .deleteFrom('delivery_plans')
        .where('id', '=', planId)
        .execute()
        .catch(() => {});
    });

    // A work item on the OTHER project for cross-project link guards.
    await makeWorkItemOnProject(otherProjectId, otherArea.id, otherTeam.id, 'Other project item');
  });

  afterAll(async () => {
    for (const fn of cleanup.reverse()) {
      await fn();
    }
  });

  async function makeWorkItemOnProject(pid: string, areaId: string, _teamId: string, title: string) {
    const row = await db
      .selectFrom('projects')
      .select('next_work_item_seq')
      .where('id', '=', pid)
      .executeTakeFirstOrThrow();
    const nextSeq = row.next_work_item_seq;
    const inserted = await db
      .insertInto('work_items')
      .values({
        project_id: pid,
        area_id: areaId,
        seq_no: nextSeq,
        parent_id: null,
        type: 'STORY',
        title,
        description: null,
        state: 'TODO',
        priority: 'MEDIUM',
        created_by: userId,
        iteration_id: null,
        backlog_order: nextSeq,
        backlog_rank: nextSeq * 1000,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .updateTable('projects')
      .set({ next_work_item_seq: nextSeq + 1 })
      .where('id', '=', pid)
      .execute();
    cleanup.push(async () => {
      await db.deleteFrom('work_items').where('id', '=', inserted.id).execute().catch(() => {});
    });
    return inserted.id;
  }

  // ─── Plan CRUD ──────────────────────────────────────────────────────────────

  it('creates a plan with team counts and lists it back', async () => {
    expect(planId).toBeTruthy();

    const plans = await service.findAll(userId, projectId);
    const created = plans.find((p) => p.id === planId);
    expect(created).toBeTruthy();
    expect(created?.teamCount).toBe(2); // both teams on the plan
    expect(created?.userTeamCount).toBe(1); // but user is only in one
  });

  it('rejects a team that belongs to another project', async () => {
    const otherTeamId = await db
      .selectFrom('teams')
      .where('project_id', '=', otherProjectId)
      .select('id')
      .limit(1)
      .executeTakeFirst();
    await expect(
      service.create(userId, projectId, {
        name: 'Bad plan',
        teamIds: [teamInScope, otherTeamId!.id],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates a plan name and replaces its teams', async () => {
    const updated = await service.update(userId, projectId, planId, {
      name: 'Renamed plan',
      teamIds: [teamInScope],
    });
    expect(updated?.name).toBe('Renamed plan');

    const teams = await service.getPlanTeams(userId, projectId, planId);
    expect(teams.map((t) => t.id)).toEqual([teamInScope]);
    expect(teams[0].isMember).toBe(true);
  });

  // ─── Timeline scoping ───────────────────────────────────────────────────────

  it('scopes the timeline to the caller team memberships', async () => {
    // Reset teams back to both so the scoping is visible in this test.
    await service.setPlanTeams(userId, projectId, planId, {
      teamIds: [teamInScope, teamOutOfScope],
    });

    const timeline = await service.getTimeline(userId, projectId, planId, {});

    expect(timeline.hiddenTeamCount).toBe(1); // Mobile Team hidden
    expect(timeline.teams.map((t) => t.id)).toEqual([teamInScope]);

    const itemIds = timeline.workItems.map((w) => w.id);
    expect(itemIds).toContain(wi1); // area+iteration in scope
    expect(itemIds).toContain(wi2); // explicit dates in scope
    expect(itemIds).not.toContain(wi3); // out-of-scope team area
    expect(itemIds).not.toContain(wi4); // no iteration and no dates
  });

  it('filters the timeline by iteration', async () => {
    const timeline = await service.getTimeline(userId, projectId, planId, {
      iterationId: iterationInScope,
    });
    const itemIds = timeline.workItems.map((w) => w.id);
    expect(itemIds).toContain(wi1);
    expect(itemIds).toContain(wi2); // explicit dates are independent of iteration
  });

  it('paginates the timeline work items', async () => {
    const timeline = await service.getTimeline(userId, projectId, planId, {
      limit: 1,
      offset: 0,
    });
    expect(timeline.workItems.length).toBe(1);
    expect(timeline.totalWorkItems).toBe(2);
    expect(timeline.limit).toBe(1);
  });

  it('returns empty teams for a plan with no visible teams', async () => {
    await service.setPlanTeams(userId, projectId, planId, {
      teamIds: [teamOutOfScope],
    });
    const timeline = await service.getTimeline(userId, projectId, planId, {});
    expect(timeline.teams).toHaveLength(0);
    expect(timeline.hiddenTeamCount).toBe(1);
    expect(timeline.workItems).toHaveLength(0);
    await service.setPlanTeams(userId, projectId, planId, {
      teamIds: [teamInScope, teamOutOfScope],
    });
  });

  // ─── Dependencies ───────────────────────────────────────────────────────────

  it('creates and lists a dependency between in-scope items', async () => {
    const link = await service.createLink(userId, projectId, wi2, {
      targetWorkItemId: wi1,
      linkType: 'DEPENDS_ON',
    });
    expect(link?.sourceWorkItemId).toBe(wi2);
    expect(link?.targetWorkItemId).toBe(wi1);
    expect(link?.sourceKey).toMatch(/^[A-Z0-9]+-\d+$/);
    expect(link?.targetKey).toMatch(/^[A-Z0-9]+-\d+$/);

    const links = await service.getItemLinks(userId, projectId, wi1);
    expect(links.incoming.some((l) => l.sourceWorkItemId === wi2)).toBe(true);
    expect(links.outgoing).toHaveLength(0);
  });

  it('rejects a duplicate dependency', async () => {
    await expect(
      service.createLink(userId, projectId, wi2, {
        targetWorkItemId: wi1,
        linkType: 'DEPENDS_ON',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a self dependency', async () => {
    await expect(
      service.createLink(userId, projectId, wi1, {
        targetWorkItemId: wi1,
        linkType: 'DEPENDS_ON',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a dependency that would create a cycle', async () => {
    // wi2 → wi1 exists. Adding wi1 → wi2 closes the loop.
    await expect(
      service.createLink(userId, projectId, wi1, {
        targetWorkItemId: wi2,
        linkType: 'DEPENDS_ON',
      }),
    ).rejects.toThrow('cycle');
  });

  it('allows RELATED links without cycle checks', async () => {
    await expect(
      service.createLink(userId, projectId, wi1, {
        targetWorkItemId: wi2,
        linkType: 'RELATED',
      }),
    ).resolves.toBeTruthy();
  });

  it('removes a dependency', async () => {
    await expect(
      service.removeLink(userId, projectId, wi2, wi1),
    ).resolves.toEqual({ success: true });
    const links = await service.getItemLinks(userId, projectId, wi1);
    expect(links.incoming).toHaveLength(0);
  });

  it('rejects a dependency to a work item in another project', async () => {
    const otherItem = await db
      .selectFrom('work_items')
      .where('project_id', '=', otherProjectId)
      .select('id')
      .limit(1)
      .executeTakeFirst();
    await expect(
      service.createLink(userId, projectId, wi1, {
        targetWorkItemId: otherItem!.id,
        linkType: 'DEPENDS_ON',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
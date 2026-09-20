import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { WorkItemsRepository } from './work-items.repository.js';
import { WorkItemsService } from './work-items.service.js';
import { WorkItemTypeRegistryService } from './work-item-types.registry.js';
import { WorkItemTransitionsService } from './work-item-transitions.service.js';
import { WorkItemHistoryRepository } from '../work-item-history/work-item-history.repository.js';
import { WorkItemHistoryService } from '../work-item-history/work-item-history.service.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TeamsRepository } from '../teams/teams.repository.js';
import { TeamsService } from '../teams/teams.service.js';
import { IterationsRepository } from '../iterations/iterations.repository.js';
import { IterationsService } from '../iterations/iterations.service.js';
import { NotificationsRepository } from '../notifications/notifications.repository.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { db } from '../../db/kysely.js';

// Runs only when a real Postgres is available at DATABASE_URL / localhost:5434.
//   INTEGRATION=1 npx vitest run src/modules/work-items/workflow.integration.spec.ts
// Start it with `docker compose up -d db` and apply db/migrations/*.sql in order.
// Requires seeded dev data: at least two users in the `users` table.
const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('Work item workflow (DB integration)', () => {
  let workItemsService: WorkItemsService;
  let transitionsService: WorkItemTransitionsService;
  let iterationsService: IterationsService;
  let projectsService: ProjectsService;
  let history: WorkItemHistoryService;

  let project: { id: string; key: string };
  let owner: { id: string };
  let member: { id: string; name: string };
  let outsider: { id: string };

  let featureId: string;
  let storyId: string;
  let taskId: string;
  let iterationId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    history = new WorkItemHistoryService(new WorkItemHistoryRepository());
    const workItemsRepo = new WorkItemsRepository(history);
    const authz = new AuthorizationService();
    const notifications = new NotificationsService(
      new NotificationsRepository(),
      { sendNotificationToUser: () => {} } as any,
    );

    const projectsRepo = new ProjectsRepository();
    projectsService = new ProjectsService(projectsRepo, authz);
    const teamsService = new TeamsService(new TeamsRepository(), projectsService, authz);

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
    iterationsService = new IterationsService(
      new IterationsRepository(history),
      teamsService,
      authz,
      notifications,
    );

    const users = await db
      .selectFrom('users')
      .select(['id', 'name'])
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
      name: `Workflow Project ${Date.now()}`,
      key: `WF${Date.now().toString().slice(-6)}`,
      description: 'Created by workflow integration test',
      created_by: owner.id,
      organization_id: '00000000-0000-0000-0000-000000000000',
    });
    await projectsService.addMember(owner.id, project.id, member.id, 'MEMBER');
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await db.deleteFrom('work_items').where('id', '=', id).execute().catch(() => {});
    }
    if (iterationId) {
      await db.deleteFrom('iterations').where('id', '=', iterationId).execute().catch(() => {});
    }
    await db.deleteFrom('projects').where('id', '=', project.id).execute().catch(() => {});
  });

  it('creates a parent-child hierarchy and enforces its rules at the DB level', async () => {
    const epic = await workItemsService.create(owner.id, project.id, {
      type: 'EPIC',
      title: 'WF Epic',
      priority: 'HIGH',
    });
    createdIds.push(epic.id);

    const feature = await workItemsService.create(owner.id, project.id, {
      type: 'FEATURE',
      title: 'WF Feature',
      parentId: epic.id,
    });
    featureId = feature.id;
    createdIds.push(feature.id);

    const story = await workItemsService.create(owner.id, project.id, {
      type: 'STORY',
      title: 'WF Story',
      parentId: feature.id,
    });
    storyId = story.id;
    createdIds.push(story.id);

    const task = await workItemsService.create(owner.id, project.id, {
      type: 'TASK',
      title: 'WF Task',
      parentId: story.id,
    });
    taskId = task.id;
    createdIds.push(task.id);

    // Hierarchy rules apply on create: a TASK cannot live under an EPIC.
    await expect(
      workItemsService.create(owner.id, project.id, {
        type: 'TASK',
        title: 'WF Illegal Task',
        parentId: epic.id,
      }),
    ).rejects.toThrow(BadRequestException);

    // A non-member cannot touch the project at all.
    await expect(
      workItemsService.create(outsider.id, project.id, {
        type: 'TASK',
        title: 'WF Outsider Task',
      }),
    ).rejects.toThrow(ForbiddenException);

    // Parent-scoped reads return exactly the direct children.
    const children = await workItemsService.findAll(owner.id, project.id, {
      parentId: epic.id,
    });
    expect(children.map((c) => c.id)).toEqual([feature.id]);

    const keyed = await workItemsService.findOne(owner.id, task.id);
    expect(keyed.key).toContain(project.key);
  });

  it('assigns, transitions, sprints, and discusses a task end to end', async () => {
    // Assign the task to the member via the dedicated assignment path.
    const assigned = await workItemsService.update(owner.id, taskId, {
      assignedTo: member.id,
    });
    expect(assigned.assignedTo).toBe(member.id);

    const assigneeRow = await db
      .selectFrom('work_items')
      .where('id', '=', taskId)
      .select('assigned_to')
      .executeTakeFirst();
    expect(assigneeRow?.assigned_to).toBe(member.id);

    // A MEMBER may advance state through the transition endpoint…
    const inProgress = await transitionsService.transitionState(owner.id, taskId, 'IN_PROGRESS');
    expect(inProgress.state).toBe('IN_PROGRESS');

    // …but not through the generic update endpoint.
    await expect(
      workItemsService.update(owner.id, taskId, { state: 'DONE' } as any),
    ).rejects.toThrow(BadRequestException);

    // A MEMBER (not OWNER/ADMIN) cannot delete work items.
    await expect(workItemsService.remove(member.id, taskId)).rejects.toThrow(ForbiddenException);

    // Completing a state stamps the completion date.
    const done = await transitionsService.transitionState(owner.id, taskId, 'DONE');
    expect(done.state).toBe('DONE');
    expect(done.completed_at).toBeTruthy();

    // Move the story into an active sprint and confirm it lands on the board.
    iterationId = (
      await iterationsService.create(owner.id, project.id, {
        name: `WF Sprint ${Date.now()}`,
        startDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 45 * 86400000).toISOString(),
      })
    ).id;
    await iterationsService.activate(owner.id, project.id, iterationId);
    await iterationsService.addWorkItems(owner.id, project.id, iterationId, {
      workItemIds: [storyId, featureId],
    });

    const board = await iterationsService.getSprintBoard(owner.id, project.id, iterationId);
    const boardIds = board.groups.flatMap((g) => g.items.map((i: any) => i.id));
    expect(board.total).toBe(2);
    expect(boardIds).toEqual(expect.arrayContaining([storyId, featureId]));

    // A mention in a comment raises a notification for the mentioned member.
    await workItemsService.addComment(owner.id, taskId, `Hey @${member.name}, please follow up.`);
    const notification = await db
      .selectFrom('notifications')
      .where('user_id', '=', member.id)
      .where('type', '=', 'MENTIONED')
      .orderBy('created_at', 'desc')
      .selectAll()
      .executeTakeFirst();
    expect(notification).toBeDefined();
    expect(notification?.work_item_id).toBe(taskId);

    // The activity timeline records the whole journey in order.
    const activity = await history.getActivity(taskId);
    expect(activity.map((a) => a.action)).toEqual([
      'CREATED',
      'ASSIGNEE_CHANGED',
      'STATE_CHANGED',
      'STATE_CHANGED',
      'COMMENT_ADDED',
    ]);
  });
});
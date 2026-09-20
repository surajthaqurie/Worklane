import { describe, it, expect, beforeAll, vi } from 'vitest';
import { WorkItemsRepository } from './work-items.repository.js';
import { WorkItemsService } from './work-items.service.js';
import { WorkItemTypeRegistryService } from './work-item-types.registry.js';
import { WorkItemHistoryRepository } from '../work-item-history/work-item-history.repository.js';
import { WorkItemHistoryService } from '../work-item-history/work-item-history.service.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TeamsRepository } from '../teams/teams.repository.js';
import { TeamsService } from '../teams/teams.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { db } from '../../db/kysely.js';

const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('Hierarchy & Rollup Engine DB Integration', () => {
  let workItemsService: WorkItemsService;
  let workItemsRepo: WorkItemsRepository;

  let projectId: string;
  let ownerId: string;

  let epicId: string;
  let featureId: string;
  let story1Id: string;
  let story2Id: string;
  let task1Id: string;

  beforeAll(async () => {
    const history = new WorkItemHistoryService(new WorkItemHistoryRepository());
    workItemsRepo = new WorkItemsRepository(history);
    const authz = new AuthorizationService();

    const projectsRepo = new ProjectsRepository();
    const projectsService = new ProjectsService(projectsRepo, authz);
    const teamsService = new TeamsService(new TeamsRepository(), projectsService, authz);

    const typeRegistry = new WorkItemTypeRegistryService();
    workItemsService = new WorkItemsService(
      workItemsRepo,
      projectsService,
      teamsService,
      authz,
      { notifyAssigned: vi.fn() } as any,
      typeRegistry,
    );

    // Pick seed owner user
    const owner = await db.selectFrom('users').select('id').limit(1).executeTakeFirst();
    if (!owner) throw new Error('No user in database');
    ownerId = owner.id;

    // Create a fresh test project for clean state
    const proj = await db
      .insertInto('projects')
      .values({
        name: 'Hierarchy Integration Proj',
        key: `HIER${Date.now().toString().slice(-4)}`,
        created_by: ownerId,
        organization_id: '00000000-0000-0000-0000-000000000000',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    projectId = proj.id;

    await db.insertInto('project_members').values({
      project_id: projectId,
      user_id: ownerId,
      role: 'OWNER',
    }).execute();

    const area = await db.insertInto('areas').values({
      project_id: projectId,
      name: 'Root Area',
    }).returningAll().executeTakeFirstOrThrow();

    // Create workflow states
    await db.insertInto('work_item_states').values([
      { project_id: projectId, key: 'New', name: 'New', color: '#94A3B8', category: 'PROPOSED', sort_order: 1, is_done: false },
      { project_id: projectId, key: 'Active', name: 'Active', color: '#3B82F6', category: 'IN_PROGRESS', sort_order: 2, is_done: false },
      { project_id: projectId, key: 'Done', name: 'Done', color: '#10B981', category: 'COMPLETED', sort_order: 3, is_done: true },
    ]).execute();

    // Create Epic -> Feature -> Story1, Story2 (Done) -> Task1 (Done)
    const epic = await workItemsService.create(ownerId, projectId, {
      title: 'Root Epic',
      type: 'EPIC',
      areaId: area.id,
      points: 0,
    });
    epicId = epic.id;

    const feature = await workItemsService.create(ownerId, projectId, {
      title: 'Child Feature',
      type: 'FEATURE',
      parentId: epicId,
      areaId: area.id,
      points: 5,
      remainingWork: 10,
    });
    featureId = feature.id;

    const story1 = await workItemsService.create(ownerId, projectId, {
      title: 'Active Story 1',
      type: 'STORY',
      parentId: featureId,
      areaId: area.id,
      points: 8,
      remainingWork: 12,
      completedWork: 4,
    });
    story1Id = story1.id;

    const story2 = await workItemsService.create(ownerId, projectId, {
      title: 'Completed Story 2',
      type: 'STORY',
      parentId: featureId,
      areaId: area.id,
      points: 13,
      remainingWork: 0,
      completedWork: 13,
    });
    story2Id = story2.id;

    // Transition story2 to 'Done'
    await db.updateTable('work_items').set({ state: 'Done' }).where('id', '=', story2Id).execute();

    const task1 = await workItemsService.create(ownerId, projectId, {
      title: 'Completed Task 1 under Story 1',
      type: 'TASK',
      parentId: story1Id,
      areaId: area.id,
      points: 2,
      remainingWork: 0,
      completedWork: 5,
    });
    task1Id = task1.id;
    await db.updateTable('work_items').set({ state: 'Done' }).where('id', '=', task1Id).execute();
  });

  it('should calculate Recursive CTE rollups correctly for the Epic subtree', async () => {
    const rollup = await workItemsService.getWorkItemRollup(ownerId, projectId, epicId);

    // Epic descendants: Feature, Story1, Story2, Task1 = 4 descendants
    expect(rollup.descendantCount).toBe(4);

    // Completed count: Story2 (Done), Task1 (Done) = 2 completed descendants
    expect(rollup.completedCount).toBe(2);

    // Total points: Epic(0) + Feature(5) + Story1(8) + Story2(13) + Task1(2) = 28 points
    expect(rollup.totalPoints).toBe(28);

    // Completed points: Story2(13) + Task1(2) = 15 points
    expect(rollup.completedPoints).toBe(15);

    // Remaining work: Feature(10) + Story1(12) + Story2(0) + Task1(0) = 22
    expect(rollup.remainingWork).toBe(22);

    // Completed work: Story1(4) + Story2(13) + Task1(5) = 22
    expect(rollup.completedWork).toBe(22);

    // Completion %: (15 / 28) * 100 = 54%
    expect(rollup.completionPercentage).toBe(54);
  });

  it('should fetch batch rollups in a single query for multiple parent items', async () => {
    const batch = await workItemsService.getBatchWorkItemRollups(ownerId, projectId, [epicId, featureId, story1Id]);

    expect(batch[epicId].descendantCount).toBe(4);
    expect(batch[featureId].descendantCount).toBe(3); // Story1, Story2, Task1
    expect(batch[story1Id].descendantCount).toBe(1);  // Task1
  });

  it('should return complete hierarchy tree with ancestor and descendant paths', async () => {
    const tree = await workItemsService.getWorkItemHierarchy(ownerId, projectId, featureId);

    expect(tree.item.id).toBe(featureId);
    expect(tree.ancestors.length).toBe(1);
    expect(tree.ancestors[0].id).toBe(epicId);

    expect(tree.item.children.length).toBe(2); // Story 1 & Story 2
    const story1Node = tree.item.children.find((c: any) => c.id === story1Id);
    expect(story1Node.children.length).toBe(1); // Task 1
    expect(story1Node.children[0].id).toBe(task1Id);
  });
});

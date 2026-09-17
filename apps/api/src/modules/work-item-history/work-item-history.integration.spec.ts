import { WorkItemsRepository } from '../work-items/work-items.repository.js';
import { WorkItemHistoryRepository } from '../work-item-history/work-item-history.repository.js';
import { WorkItemHistoryService } from '../work-item-history/work-item-history.service.js';
import { WorkItemHistoryAction } from '../work-item-history/work-item-history.constants.js';
import { db } from '../../db/kysely.js';

// Runs only when a real Postgres is available at DATABASE_URL / localhost:5434.
//   INTEGRATION=1 npx vitest run src/modules/work-item-history/work-item-history.integration.spec.ts
// Start it with `docker compose up -d db` and apply db/migrations/*.sql in order.
const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('WorkItemHistory (DB integration)', () => {
  let repo: WorkItemsRepository;
  let history: WorkItemHistoryService;
  let project: { id: string; key: string };
  let user: { id: string };
  let secondUser: { id: string; name: string };
  let areaId: string;
  const createdWorkItemIds: string[] = [];

  beforeAll(async () => {
    history = new WorkItemHistoryService(new WorkItemHistoryRepository());
    repo = new WorkItemsRepository(history);

    const projectRow = await db
      .selectFrom('projects')
      .select(['id', 'key'])
      .orderBy('created_at', 'asc')
      .limit(1)
      .executeTakeFirst();
    const users = await db
      .selectFrom('users')
      .select(['id', 'name'])
      .orderBy('created_at', 'asc')
      .limit(2)
      .execute();
    const area = await db.selectFrom('areas').select('id').limit(1).executeTakeFirst();
    if (!projectRow || users.length < 1 || !area) {
      throw new Error('Seeded dev data missing (project/user(s)/area)');
    }
    project = projectRow;
    user = users[0];
    secondUser = users[users.length - 1];
    areaId = area.id;

    // Remove leftovers from any previous aborted run
    await db
      .deleteFrom('work_items')
      .where('title', 'in', ['HISTORY Parent', 'HISTORY Child', 'HISTORY Plain'])
      .execute()
      .catch(() => {});
  });

  afterAll(async () => {
    for (const id of createdWorkItemIds) {
      await db.deleteFrom('work_items').where('id', '=', id).execute().catch(() => {});
    }
  });

  async function makeItem(title: string, type: any) {
    const item = await repo.createWorkItem(project.id, user.id, {
      type,
      title,
      description: null,
      priority: 'MEDIUM',
      assignedTo: null,
      areaId,
    });
    createdWorkItemIds.push(item.id);
    return item;
  }

  async function activities(workItemId: string) {
    return history.getActivity(workItemId);
  }

  it('records every field change as structured, immutable history', async () => {
    const parent = await makeItem('HISTORY Parent', 'FEATURE');
    const item = await makeItem('HISTORY Child', 'STORY');

    await repo.updateWorkItem(item.id, user.id, {
      title: 'HISTORY Child v2',
      priority: 'HIGH',
      assignedTo: secondUser.id,
      description: 'A rich, detailed description.',
      tags: ['alpha', 'beta'],
    });
    await repo.updateWorkItem(item.id, user.id, { parentId: parent.id });

    const activity = await activities(item.id);
    const actions = activity.map((a) => a.action);

    expect(actions).toEqual([
      WorkItemHistoryAction.CREATED,
      WorkItemHistoryAction.TAGS_CHANGED,
      WorkItemHistoryAction.TITLE_CHANGED,
      WorkItemHistoryAction.PRIORITY_CHANGED,
      WorkItemHistoryAction.ASSIGNEE_CHANGED,
      WorkItemHistoryAction.DESCRIPTION_CHANGED,
      WorkItemHistoryAction.PARENT_CHANGED,
    ]);

    // Structured values are preserved verbatim (never pre-rendered away).
    const titleChange = activity.find((a) => a.action === 'TITLE_CHANGED')!;
    expect(titleChange.previousValue).toBe('HISTORY Child');
    expect(titleChange.newValue).toBe('HISTORY Child v2');
    expect(titleChange.description).toBe('renamed from "HISTORY Child" to "HISTORY Child v2"');

    const assigneeChange = activity.find((a) => a.action === 'ASSIGNEE_CHANGED')!;
    expect(assigneeChange.newValue).toBe(secondUser.id);
    expect(assigneeChange.newLabel).toBe(secondUser.name);
    expect(assigneeChange.description).toBe(`assigned to ${secondUser.name}`);

    const parentChange = activity.find((a) => a.action === 'PARENT_CHANGED')!;
    expect(parentChange.newValue).toBe(parent.id);
    expect(parentChange.newLabel).toContain(`${project.key}-${parent.seq_no}`);
    expect(parentChange.description).toContain(`linked under ${project.key}-${parent.seq_no}`);

    const tagChange = activity.find((a) => a.action === 'TAGS_CHANGED')!;
    expect(tagChange.previousValue).toBeNull();
    expect(tagChange.newValue).toBe('alpha,beta');
    expect(tagChange.description).toBe('added tags: alpha,beta');
  });

  it('records the full comment lifecycle in the activity timeline', async () => {
    const item = await makeItem('HISTORY Plain', 'TASK');

    const comment = await repo.createComment(item.id, user.id, 'First thoughts');
    await repo.updateComment(comment.id, user.id, 'Revised thoughts', comment.version);

    const commentActivity = await activities(item.id);
    expect(commentActivity.map((a) => a.action)).toEqual([
      WorkItemHistoryAction.CREATED,
      WorkItemHistoryAction.COMMENT_ADDED,
      WorkItemHistoryAction.COMMENT_UPDATED,
    ]);
    expect(commentActivity[1].newValue).toBe('First thoughts');
    expect(commentActivity[2].previousValue).toBe('First thoughts');
    expect(commentActivity[1].description).toBe('added a comment');
  });

  it('keeps work_item_id on the DELETED record and blocks mutation', async () => {
    const item = await makeItem('HISTORY to delete', 'TASK');

    await repo.deleteWorkItem(item.id, user.id);

    const rows = await db
      .selectFrom('work_item_history')
      .where('work_item_id', '=', item.id)
      .selectAll()
      .execute();
    const deleted = rows.find((r) => r.action === 'DELETED')!;
    expect(deleted).toBeDefined();
    // The id survives deletion so the trail stays attributable.
    expect(deleted.work_item_id).toBe(item.id);
    expect(deleted.old_value).toBe('HISTORY to delete');

    // Attempts to mutate or remove history are rejected by the DB trigger.
    const targetId = rows[0].id;
    await expect(
      db
        .updateTable('work_item_history')
        .set({ field: 'hacked' })
        .where('id', '=', targetId)
        .execute(),
    ).rejects.toThrow();
    await expect(
      db.deleteFrom('work_item_history').where('id', '=', targetId).execute(),
    ).rejects.toThrow();
  });
});
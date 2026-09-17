import { SearchRepository } from './search.repository.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { db } from '../../db/kysely.js';

// Runs only when a real Postgres is available at DATABASE_URL / localhost:5434.
//   INTEGRATION=1 npx vitest run src/modules/search/search.integration.spec.ts
const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('SearchRepository (DB integration)', () => {
  let repo: SearchRepository;
  let projectsRepo: ProjectsRepository;
  let userA: string;
  let userB: string;
  let projectA: { id: string; key: string };
  let projectB: { id: string; key: string };
  let areaA: string;
  let areaB: string;
  let itemInA: { id: string; seqNo: number };
  let itemInA2: { id: string; seqNo: number };
  let itemInB: { id: string; seqNo: number };
  const createdUsers: string[] = [];
  const createdProjects: string[] = [];

  beforeAll(async () => {
    repo = new SearchRepository();
    projectsRepo = new ProjectsRepository();

    // Remove leftovers from any previous aborted run.
    await db
      .deleteFrom('users')
      .where('email', 'like', 'search.%@worklane.test')
      .execute()
      .catch(() => {});

    const org = await db
      .selectFrom('organizations')
      .select('id')
      .limit(1)
      .executeTakeFirst();
    if (!org) throw new Error('Seeded organization missing');

    // Two distinct users so we can prove cross-project isolation.
    userA = (await createUser('Search Alpha User')).id;
    userB = (await createUser('Search Beta User')).id;

    projectA = await projectsRepo.createProject({
      name: 'Search Integration A',
      key: 'SRCHA',
      created_by: userA,
      organization_id: org.id,
    });
    projectB = await projectsRepo.createProject({
      name: 'Search Integration B',
      key: 'SRCHB',
      created_by: userB,
      organization_id: org.id,
    });
    createdProjects.push(projectA.id, projectB.id);

    const areaARow = await db
      .selectFrom('areas')
      .where('project_id', '=', projectA.id)
      .select('id')
      .limit(1)
      .executeTakeFirstOrThrow();
    const areaBRow = await db
      .selectFrom('areas')
      .where('project_id', '=', projectB.id)
      .select('id')
      .limit(1)
      .executeTakeFirstOrThrow();
    areaA = areaARow.id;
    areaB = areaBRow.id;

    itemInA = await makeWorkItem(projectA.id, areaA, userA, 'Searchable Alpha Widget', 'IN_PROGRESS', userA);
    itemInA2 = await makeWorkItem(projectA.id, areaA, userA, 'Confidential Blackbird Task', 'IN_PROGRESS', null);
    itemInB = await makeWorkItem(projectB.id, areaB, userB, 'Searchable Beta Widget', 'DONE', userB);

    // A tag only on the item in project A.
    const tag = await db
      .insertInto('tags')
      .values({ project_id: projectA.id, name: 'search-alpha-tag' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('work_item_tags')
      .values({ work_item_id: itemInA.id, tag_id: tag.id })
      .execute();
  });

  async function createUser(name: string) {
    const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    const user = await db
      .insertInto('users')
      .values({
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}.${suffix}@worklane.test`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    createdUsers.push(user.id);
    return user;
  }

  async function makeWorkItem(
    projectId: string,
    areaId: string,
    creator: string,
    title: string,
    state: string,
    assignedTo: string | null,
  ) {
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
        description: `Description for ${title}`,
        state,
        priority: 'MEDIUM',
        points: null,
        assigned_to: assignedTo,
        created_by: creator,
        iteration_id: null,
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
    return { id: inserted.id, seqNo };
  }

  afterAll(async () => {
    const itemIds = [];
    if (itemInA) itemIds.push(itemInA.id);
    if (itemInA2) itemIds.push(itemInA2.id);
    if (itemInB) itemIds.push(itemInB.id);
    if (itemIds.length > 0) {
      await db.deleteFrom('work_items').where('id', 'in', itemIds).execute().catch(() => {});
    }
    for (const id of createdProjects) {
      await db.deleteFrom('projects').where('id', '=', id).execute().catch(() => {});
    }
    for (const id of createdUsers) {
      await db.deleteFrom('users').where('id', '=', id).execute().catch(() => {});
    }
  });

  it('returns results only from projects the user can access', async () => {
    const res = await repo.searchWorkItems(userA, { q: 'Searchable' });

    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].id).toBe(itemInA.id);
    expect(res.items[0].project.id).toBe(projectA.id);
    expect(res.items[0].key).toBe(`SRCHA-${itemInA.seqNo}`);
    expect(res.items[0].project.name).toBe('Search Integration A');
    expect(res.items[0].assignedTo).toBe(userA);
    expect(res.items[0].assignedToName).toBe('Search Alpha User');
  });

  it('does not leak items from projects the user cannot access', async () => {
    // 'Blackbird' only exists on an item inside project A (owned by userA).
    // userB has no access to project A, so the item must not be returned.
    const res = await repo.searchWorkItems(userB, { q: 'Blackbird' });
    expect(res.total).toBe(0);
    expect(res.items).toHaveLength(0);

    // The same query returns the item for someone who can access project A.
    const ownerRes = await repo.searchWorkItems(userA, { q: 'Blackbird' });
    expect(ownerRes.items.map((i) => i.id)).toContain(itemInA2.id);
  });

  it('matches by project key + sequence number', async () => {
    const res = await repo.searchWorkItems(userA, { q: `SRCHA-${itemInA.seqNo}` });
    expect(res.items.map((i) => i.id)).toContain(itemInA.id);
  });

  it('searches by tag', async () => {
    const res = await repo.searchWorkItems(userA, { q: 'search-alpha-tag' });
    expect(res.items.map((i) => i.id)).toContain(itemInA.id);
  });

  it('filters by tag list', async () => {
    const res = await repo.searchWorkItems(userA, { tags: 'search-alpha-tag' });
    expect(res.items.map((i) => i.id)).toContain(itemInA.id);

    const noAccess = await repo.searchWorkItems(userA, { tags: 'does-not-exist' });
    expect(noAccess.items).toHaveLength(0);
  });

  it('searches by assigned user name', async () => {
    const res = await repo.searchWorkItems(userA, { q: 'Search Alpha User' });
    expect(res.items.map((i) => i.id)).toContain(itemInA.id);
  });

  it('supports type and state filters', async () => {
    const byType = await repo.searchWorkItems(userA, { q: 'Searchable', type: 'STORY' });
    expect(byType.items.map((i) => i.id)).toContain(itemInA.id);

    const wrongType = await repo.searchWorkItems(userA, { q: 'Searchable', type: 'BUG' });
    expect(wrongType.items).toHaveLength(0);

    const wrongState = await repo.searchWorkItems(userA, { q: 'Searchable', state: 'TODO' });
    expect(wrongState.items).toHaveLength(0);
  });

  it('scopes to a single project when projectId is provided', async () => {
    const res = await repo.searchWorkItems(userA, { q: 'Widget', projectId: projectA.id });
    expect(res.items.map((i) => i.id)).toEqual([itemInA.id]);
  });

  it('returns nothing when no criteria are provided', async () => {
    const res = await repo.searchWorkItems(userA, {});
    expect(res.items).toHaveLength(0);
    expect(res.total).toBe(0);
  });
});
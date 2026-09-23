import { test, expect, request as playwrightRequest } from '@playwright/test';
import { withDb, upsertUser, deleteE2EProject } from './helpers/db';
import {
  apiRequest,
  Api,
  API_URL,
  OWNER_ID,
  OWNER_NAME,
  OWNER_EMAIL,
  MEMBER_ID,
  MEMBER_NAME,
  MEMBER_EMAIL,
  uniqueKey,
} from './helpers/api';

type Project = { id: string; key: string; name: string };

function column(page: import('@playwright/test').Page, name: string) {
  const header = page.getByText(name, { exact: true }).first();
  return header.locator('..').locator('..');
}

/**
 * A swimlane is a full row of columns beneath its group header. The header
 * renders the lane title plus an optional subtitle; ascending two levels from
 * the header text lands on the lane container.
 */
function swimlane(page: import('@playwright/test').Page, headerText: string) {
  const header = page.getByText(headerText, { exact: true }).first();
  return header.locator('..').locator('..');
}

async function ensureE2EUsers() {
  await withDb(async (client) => {
    await upsertUser(client, { id: OWNER_ID, name: OWNER_NAME, email: OWNER_EMAIL });
    await upsertUser(client, { id: MEMBER_ID, name: MEMBER_NAME, email: MEMBER_EMAIL });
  });
}

async function createE2EProject(api: Api, nameLabel: string): Promise<Project> {
  const run = Date.now().toString().slice(-6);
  const project = await api.post<Project>('/projects', {
    name: `${nameLabel} ${run}`,
    key: uniqueKey('ADV'),
    description: 'Created by Playwright E2E',
  });
  await api.post(`/projects/${project.id}/members`, {
    userId: MEMBER_ID,
    role: 'MEMBER',
  });
  return project;
}

test.describe.configure({ mode: 'serial' });

test.describe('advanced boards: swimlanes & WIP', () => {
  const storyAssignedOwner = 'Swimlane story assigned to owner';
  const storyAssignedMember = 'Swimlane story assigned to member';
  const storyUnassigned = 'Swimlane story without assignee';
  let project: Project;

  test.beforeAll(async () => {
    await ensureE2EUsers();
    const ctx = await playwrightRequest.newContext({ baseURL: 'http://localhost:4000' });
    const api = apiRequest(ctx, OWNER_ID);
    project = await createE2EProject(api, 'Boards E2E');
  });

  test.afterAll(async () => {
    if (!project) return;
    await withDb(async (client) => {
      await deleteE2EProject(client, project.id, [OWNER_ID, MEMBER_ID]);
    });
  });

  test('renders assignee swimlanes grouping cards by their assignee', async ({ page }) => {
    const ctx = await playwrightRequest.newContext({ baseURL: 'http://localhost:4000' });
    const api = apiRequest(ctx, OWNER_ID);

    // Assignee swimlanes, with the assignee chip hidden on the card so the
    // member name appears only in the lane headers (deterministic selectors).
    const board = await api.post<{ id: string; name: string }>(`/projects/${project.id}/boards`, {
      name: `Assignee Swimlane ${Date.now().toString().slice(-6)}`,
      swimlane: 'assignee',
      cardFields: { showAssignee: false },
      columns: [
        { id: 'c-todo', name: 'To Do', mappedStates: ['TODO'], wipLimit: null },
        { id: 'c-wip', name: 'In Progress', mappedStates: ['IN_PROGRESS'], wipLimit: null },
        { id: 'c-done', name: 'Done', mappedStates: ['DONE'], wipLimit: null },
      ],
    });

    await api.post(`/projects/${project.id}/work-items`, {
      type: 'STORY',
      title: storyAssignedOwner,
      priority: 'HIGH',
      assignedTo: OWNER_ID,
    });
    await api.post(`/projects/${project.id}/work-items`, {
      type: 'STORY',
      title: storyAssignedMember,
      priority: 'MEDIUM',
      assignedTo: MEMBER_ID,
    });
    await api.post(`/projects/${project.id}/work-items`, {
      type: 'STORY',
      title: storyUnassigned,
      priority: 'LOW',
    });

    await page.setExtraHTTPHeaders({ 'x-user-id': OWNER_ID });
    await page.goto(`/projects/${project.id}/boards`);

    // Pick the newly created board from the header selector.
    const boardSelect = page.locator('select').filter({ hasText: '+ Create New Board' });
    await boardSelect.selectOption({ value: board.id });

    // One lane per assignee plus an Unassigned lane.
    await expect(page.getByText('Assigned work', { exact: true })).toHaveCount(2);
    await expect(page.getByText('No assignee set', { exact: true })).toBeVisible();

    // Each story lands in the lane of its own assignee.
    await expect(
      swimlane(page, OWNER_NAME).getByText(storyAssignedOwner, { exact: true }),
    ).toBeVisible();
    await expect(
      swimlane(page, MEMBER_NAME).getByText(storyAssignedMember, { exact: true }),
    ).toBeVisible();
    await expect(
      swimlane(page, 'No assignee set').getByText(storyUnassigned, { exact: true }),
    ).toBeVisible();
  });

  test('blocks dragging into a WIP-limited column and surfaces the block instead of dropping silently', async ({ page }) => {
    const ctx = await playwrightRequest.newContext({ baseURL: 'http://localhost:4000' });
    const api = apiRequest(ctx, OWNER_ID);

    const board = await api.post<{ id: string }>(`/projects/${project.id}/boards`, {
      name: `WIP Board ${Date.now().toString().slice(-6)}`,
      swimlane: 'none',
      columns: [
        { id: 'c-todo', name: 'To Do', mappedStates: ['TODO'], wipLimit: null },
        { id: 'c-wip', name: 'In Progress', mappedStates: ['IN_PROGRESS'], wipLimit: 1 },
        { id: 'c-done', name: 'Done', mappedStates: ['DONE'], wipLimit: null },
      ],
    });

    const filler = await api.post<{ id: string }>(`/projects/${project.id}/work-items`, {
      type: 'STORY',
      title: 'WIP filler',
      priority: 'HIGH',
    });
    await api.post(`/projects/${project.id}/work-items`, {
      type: 'STORY',
      title: 'WIP mover',
      priority: 'MEDIUM',
    });

    // Fill the single WIP slot via the API so the visible board shows a full column.
    await api.post(`/projects/${project.id}/boards/${board.id}/work-items/${filler.id}/move`, {
      state: 'IN_PROGRESS',
    });

    await page.setExtraHTTPHeaders({ 'x-user-id': OWNER_ID });
    await page.goto(`/projects/${project.id}/boards`);
    const boardSelect = page.locator('select').filter({ hasText: '+ Create New Board' });
    await boardSelect.selectOption({ value: board.id });

    const todoColumn = column(page, 'To Do');
    const inProgressColumn = column(page, 'In Progress');
    await expect(todoColumn.getByText('WIP mover', { exact: true })).toBeVisible();

    // Drag the mover into the full column: it must be rejected client-side with
    // structured feedback and the card must stay where it was.
    await todoColumn.getByText('WIP mover', { exact: true }).dragTo(inProgressColumn, {
      targetPosition: { x: 100, y: 200 },
    });
    await expect(page.getByText('Move blocked — WIP limit reached')).toBeVisible();
    await expect(todoColumn.getByText('WIP mover', { exact: true })).toBeVisible();
    await expect(inProgressColumn.getByText('WIP mover', { exact: true })).toHaveCount(0);
  });

  test('denies board reconfiguration to a plain member with 403', async ({ request }) => {
    const ownerCtx = await playwrightRequest.newContext({ baseURL: 'http://localhost:4000' });
    const ownerApi = apiRequest(ownerCtx, OWNER_ID);

    const board = await ownerApi.post<{ id: string }>(`/projects/${project.id}/boards`, {
      name: `Perm Board ${Date.now().toString().slice(-6)}`,
      columns: [
        { id: 'c-todo', name: 'To Do', mappedStates: ['TODO'], wipLimit: null },
        { id: 'c-done', name: 'Done', mappedStates: ['DONE'], wipLimit: null },
      ],
    });

    const member = await request.patch(`${API_URL}/projects/${project.id}/boards/${board.id}`, {
      headers: { 'x-user-id': MEMBER_ID, 'Content-Type': 'application/json' },
      data: { name: 'Hijacked' },
    });
    expect(member.status()).toBe(403);

    // The owner can still reconfigure the same board.
    const owner = await request.patch(`${API_URL}/projects/${project.id}/boards/${board.id}`, {
      headers: { 'x-user-id': OWNER_ID, 'Content-Type': 'application/json' },
      data: { name: `Perm Board v2 ${Date.now().toString().slice(-6)}` },
    });
    expect(owner.ok()).toBeTruthy();
    expect((await owner.json()).name).toContain('Perm Board v2');
  });
});
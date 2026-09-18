import { test, expect, request as playwrightRequest } from '@playwright/test';
import { withDb, upsertUser, deleteE2EProject } from './helpers/db';
import {
  apiRequest,
  Api,
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
  const header = page.getByText(name, { exact: true });
  return header.locator('..').locator('..');
}

async function ensureE2EUsers() {
  await withDb(async (client) => {
    await upsertUser(client, { id: OWNER_ID, name: OWNER_NAME, email: OWNER_EMAIL });
    await upsertUser(client, { id: MEMBER_ID, name: MEMBER_NAME, email: MEMBER_EMAIL });
  });
}

async function createE2EProject(
  api: Api,
  nameLabel: string,
): Promise<Project> {
  const run = Date.now().toString().slice(-6);
  const project = await api.post<Project>('/projects', {
    name: `${nameLabel} ${run}`,
    key: uniqueKey('E2E'),
    description: 'Created by Playwright E2E',
  });
  await api.post(`/projects/${project.id}/members`, {
    userId: MEMBER_ID,
    role: 'MEMBER',
  });
  return project;
}

async function createItem(api: Api, projectId: string, type: string, title: string) {
  return api.post<{ id: string; key: string }>(`/projects/${projectId}/work-items`, {
    type,
    title,
    priority: 'HIGH',
  });
}

test.describe.configure({ mode: 'serial' });

// ─── Board delivery workflow ─────────────────────────────────────────────────
test.describe('board delivery workflow', () => {
  const storyTitle = 'Sign-in page renders and validates';
  const bugTitle = 'Login flow broken on iOS';
  let project: Project;

  test.beforeAll(async () => {
    await ensureE2EUsers();
    const ctx = await playwrightRequest.newContext({ baseURL: 'http://localhost:4000' });
    const api = apiRequest(ctx, OWNER_ID);
    project = await createE2EProject(api, 'Board E2E');

    await createItem(api, project.id, 'EPIC', 'Account Authentication');
    await createItem(api, project.id, 'FEATURE', 'Sign-In Experience');
  });

  test.afterAll(async () => {
    if (!project) return;
    await withDb(async (client) => {
      await deleteE2EProject(client, project.id, [OWNER_ID, MEMBER_ID]);
    });
  });

  test('creates, assigns, drags, discusses, and audits a work item', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-user-id': OWNER_ID });

    // Open the project from the projects list.
    await page.goto('/projects');
    await page.getByRole('link').filter({ hasText: project.name }).first().click();
    await expect(page.getByText(project.name, { exact: true }).first()).toBeVisible();

    // Create a story and a bug through the modal.
    await page.goto(`/projects/${project.id}/work-items`);
    await page.getByRole('button', { name: '+ New Work Item' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByText('Title', { exact: true }).locator('..').locator('input').fill(storyTitle);
    await dialog.getByText('Type', { exact: true }).locator('..').locator('select').selectOption('STORY');
    await dialog.getByText('Priority', { exact: true }).locator('..').locator('select').selectOption('HIGH');
    await dialog.getByRole('button', { name: 'Create Item' }).click();
    await expect(page.getByText(storyTitle, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '+ New Work Item' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByText('Title', { exact: true }).locator('..').locator('input').fill(bugTitle);
    await dialog.getByText('Type', { exact: true }).locator('..').locator('select').selectOption('BUG');
    await dialog.getByRole('button', { name: 'Create Item' }).click();
    await expect(page.getByText(bugTitle, { exact: true })).toBeVisible();

    // Assign the story to the E2E member from the details drawer.
    const storyRow = page.getByRole('row').filter({ hasText: storyTitle });
    await storyRow.click();
    const drawer = page.getByRole('dialog');
    await drawer.getByText('Assignee', { exact: true }).locator('..').locator('select').selectOption(MEMBER_ID);
    await drawer.getByRole('button', { name: 'Close drawer' }).click();

    // Both items appear on the board in the To Do column.
    await page.goto(`/projects/${project.id}/boards`);
    const todoColumn = column(page, 'To Do');
    const inProgressColumn = column(page, 'In Progress');
    await expect(todoColumn.getByText(storyTitle, { exact: true })).toBeVisible();
    await expect(todoColumn.getByText(bugTitle, { exact: true })).toBeVisible();

    // Drag the story to In Progress.
    await todoColumn.getByText(storyTitle, { exact: true }).dragTo(inProgressColumn, {
      targetPosition: { x: 100, y: 200 },
    });
    await expect(inProgressColumn.getByText(storyTitle, { exact: true })).toBeVisible({ timeout: 15_000 });

    // Reload: the transition persists.
    await page.reload();
    const todoColumnAfterReload = column(page, 'To Do');
    const inProgressColumnAfterReload = column(page, 'In Progress');
    await expect(inProgressColumnAfterReload.getByText(storyTitle, { exact: true })).toBeVisible();
    await expect(todoColumnAfterReload.getByText(bugTitle, { exact: true })).toBeVisible();

    // Comment with a mention and confirm it lands.
    await page.goto(`/projects/${project.id}/work-items`);
    await page.getByRole('row').filter({ hasText: storyTitle }).click();
    const activityDrawer = page.getByRole('dialog');
    await expect(activityDrawer).toBeVisible();
    await activityDrawer.getByRole('button', { name: /Comments/ }).click();
    await activityDrawer
      .getByPlaceholder('Write a comment...')
      .fill(`Hey @${MEMBER_NAME}, please review the validation errors.`);
    await activityDrawer.getByRole('button', { name: 'Post Comment' }).click();
    await expect(
      activityDrawer.getByText(`Hey @${MEMBER_NAME}, please review the validation errors.`),
    ).toBeVisible();

    // The activity timeline records the whole journey.
    await activityDrawer.getByRole('button', { name: /Activity/ }).click();
    await expect(activityDrawer.getByText('created this work item')).toBeVisible();
    await expect(activityDrawer.getByText(/moved from [\s\S]+ to In Progress/)).toBeVisible();
    await expect(activityDrawer.getByText(/assigned to E2E Member/)).toBeVisible();
    await expect(activityDrawer.getByText('added a comment')).toBeVisible();
  });
});

// ─── Sprint planning workflow ────────────────────────────────────────────────
test.describe('sprint planning workflow', () => {
  const storyTitle = 'Password reset card UX';
  const bugTitle = 'Confirm email not sent on URGENT';
  let project: Project;
  let sprintName: string;

  test.beforeAll(async () => {
    await ensureE2EUsers();
    const ctx = await playwrightRequest.newContext({ baseURL: 'http://localhost:4000' });
    const api = apiRequest(ctx, OWNER_ID);
    project = await createE2EProject(api, 'Sprint E2E');

    await createItem(api, project.id, 'STORY', storyTitle);
    await createItem(api, project.id, 'BUG', bugTitle);
  });

  test.afterAll(async () => {
    if (!project) return;
    await withDb(async (client) => {
      await deleteE2EProject(client, project.id, [OWNER_ID, MEMBER_ID]);
    });
  });

  test('plans, starts, populates, and completes a sprint', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-user-id': OWNER_ID });

    // Create a sprint through the UI.
    await page.goto(`/projects/${project.id}/sprints`);
    await page.getByRole('button', { name: '+ New Sprint' }).first().click();
    sprintName = `E2E Sprint ${Date.now().toString().slice(-6)}`;
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Name *', { exact: true }).locator('..').locator('input').fill(sprintName);
    await dialog.getByRole('button', { name: 'Create Sprint' }).click();
    await expect(page.getByRole('link', { name: sprintName })).toBeVisible();
    await expect(page.getByText('Planned', { exact: true })).toBeVisible();

    // Start it.
    await page.getByRole('button', { name: 'Start Sprint' }).first().click();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();

    // Populate the sprint from the backlog: select all rows and bulk-assign.
    await page.goto(`/projects/${project.id}/backlogs`);
    await expect(page.getByText(storyTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(bugTitle, { exact: true })).toBeVisible();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('combobox').filter({ has: page.locator('option:has-text("Move to Iteration")') }).selectOption({ label: sprintName });

    // The sprint board shows the planned items.
    await page.goto(`/projects/${project.id}/sprints`);
    await page.getByRole('link', { name: sprintName }).click();
    await expect(page.getByText(/Iteration Backlog · 2 items/)).toBeVisible();
    const todoColumn = column(page, 'To Do');
    await expect(todoColumn.getByText(storyTitle, { exact: true })).toBeVisible();
    await expect(todoColumn.getByText(bugTitle, { exact: true })).toBeVisible();

    // Complete the sprint, moving leftover items to the backlog.
    await page.getByRole('button', { name: 'Complete Sprint' }).first().click();
    const completeDialog = page.getByRole('dialog');
    await expect(completeDialog.getByText('Move to backlog')).toBeVisible();
    await completeDialog.getByRole('button', { name: 'Complete Sprint' }).click();
    await expect(completeDialog.getByText('Sprint completed successfully.')).toBeVisible();

    // Back on the list the sprint is completed and the remaining filter
    // respects the completion state.
    await page.goto(`/projects/${project.id}/sprints`);
    const finishedCard = page.getByText('Completed', { exact: true }).first();
    await expect(finishedCard).toBeVisible();
  });
});
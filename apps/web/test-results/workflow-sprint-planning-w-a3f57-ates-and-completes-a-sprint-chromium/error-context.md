# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workflow.spec.ts >> sprint planning workflow >> plans, starts, populates, and completes a sprint
- Location: e2e\workflow.spec.ts:178:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Active', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Active', { exact: true }) with timeout 5000ms
  - waiting for getByText('Active', { exact: true })

```

```yaml
- link "Projects":
  - /url: /projects
- text: E2E290352 Sprint E2E 290352 Workspace
- combobox "Switch team":
  - option "All work" [selected]
  - option "Sprint E2E 290352 Team"
- navigation:
  - link "Overview":
    - /url: /projects/e6888323-fc9a-4221-8a50-75478ec5dcf5
  - link "Boards":
    - /url: /projects/e6888323-fc9a-4221-8a50-75478ec5dcf5undefined
  - link "Backlogs":
    - /url: /projects/e6888323-fc9a-4221-8a50-75478ec5dcf5/backlogs
  - link "Sprints":
    - /url: /projects/e6888323-fc9a-4221-8a50-75478ec5dcf5/sprints
  - link "Queries":
    - /url: /projects/e6888323-fc9a-4221-8a50-75478ec5dcf5/queries
- link "Project Settings":
  - /url: /projects/e6888323-fc9a-4221-8a50-75478ec5dcf5/settings
- link "Teams":
  - /url: /projects/e6888323-fc9a-4221-8a50-75478ec5dcf5/settings/teams
- banner:
  - searchbox "Search work items across projects..."
  - text: K
  - button "Notifications"
  - button "Switch to Dark Mode"
  - button "Open user menu SC"
- main:
  - heading "Sprints" [level=1]
  - paragraph: Plan and time-box iterations of work. Assign work items through iteration assignment.
  - button "+ New Sprint"
  - link "E2E Sprint 291633":
    - /url: /projects/e6888323-fc9a-4221-8a50-75478ec5dcf5/sprints/368ed2cc-348c-47a5-be49-c7186a9e1d31
  - text: Planned Sep 18, 2026 — Oct 2, 2026 0 items
  - button "Start Sprint"
  - link "View":
    - /url: /projects/e6888323-fc9a-4221-8a50-75478ec5dcf5/sprints/368ed2cc-348c-47a5-be49-c7186a9e1d31
  - button "Edit sprint"
  - button "Delete sprint"
- alert
```

# Test source

```ts
  93  |     await dialog.getByText('Priority', { exact: true }).locator('..').locator('select').selectOption('HIGH');
  94  |     await dialog.getByRole('button', { name: 'Create Item' }).click();
  95  |     await expect(page.getByText(storyTitle, { exact: true })).toBeVisible();
  96  | 
  97  |     await page.getByRole('button', { name: '+ New Work Item' }).click();
  98  |     dialog = page.getByRole('dialog');
  99  |     await dialog.getByText('Title', { exact: true }).locator('..').locator('input').fill(bugTitle);
  100 |     await dialog.getByText('Type', { exact: true }).locator('..').locator('select').selectOption('BUG');
  101 |     await dialog.getByRole('button', { name: 'Create Item' }).click();
  102 |     await expect(page.getByText(bugTitle, { exact: true })).toBeVisible();
  103 | 
  104 |     // Assign the story to the E2E member from the details drawer.
  105 |     const storyRow = page.getByRole('row').filter({ hasText: storyTitle });
  106 |     await storyRow.click();
  107 |     const drawer = page.getByRole('dialog');
  108 |     await drawer.getByText('Assignee', { exact: true }).locator('..').locator('select').selectOption(MEMBER_ID);
  109 |     await drawer.getByRole('button', { name: 'Close drawer' }).click();
  110 | 
  111 |     // Both items appear on the board in the To Do column.
  112 |     await page.goto(`/projects/${project.id}/boards`);
  113 |     const todoColumn = column(page, 'To Do');
  114 |     const inProgressColumn = column(page, 'In Progress');
  115 |     await expect(todoColumn.getByText(storyTitle, { exact: true })).toBeVisible();
  116 |     await expect(todoColumn.getByText(bugTitle, { exact: true })).toBeVisible();
  117 | 
  118 |     // Drag the story to In Progress.
  119 |     await todoColumn.getByText(storyTitle, { exact: true }).dragTo(inProgressColumn, {
  120 |       targetPosition: { x: 100, y: 200 },
  121 |     });
  122 |     await expect(inProgressColumn.getByText(storyTitle, { exact: true })).toBeVisible({ timeout: 15_000 });
  123 | 
  124 |     // Reload: the transition persists.
  125 |     await page.reload();
  126 |     const todoColumnAfterReload = column(page, 'To Do');
  127 |     const inProgressColumnAfterReload = column(page, 'In Progress');
  128 |     await expect(inProgressColumnAfterReload.getByText(storyTitle, { exact: true })).toBeVisible();
  129 |     await expect(todoColumnAfterReload.getByText(bugTitle, { exact: true })).toBeVisible();
  130 | 
  131 |     // Comment with a mention and confirm it lands.
  132 |     await page.goto(`/projects/${project.id}/work-items`);
  133 |     await page.getByRole('row').filter({ hasText: storyTitle }).click();
  134 |     const activityDrawer = page.getByRole('dialog');
  135 |     await expect(activityDrawer).toBeVisible();
  136 |     await activityDrawer.getByRole('button', { name: /Comments/ }).click();
  137 |     await activityDrawer
  138 |       .getByPlaceholder('Write a comment...')
  139 |       .fill(`Hey @${MEMBER_NAME}, please review the validation errors.`);
  140 |     await activityDrawer.getByRole('button', { name: 'Post Comment' }).click();
  141 |     await expect(
  142 |       activityDrawer.getByText(`Hey @${MEMBER_NAME}, please review the validation errors.`),
  143 |     ).toBeVisible();
  144 | 
  145 |     // The activity timeline records the whole journey.
  146 |     await activityDrawer.getByRole('button', { name: /Activity/ }).click();
  147 |     await expect(activityDrawer.getByText('created this work item')).toBeVisible();
  148 |     await expect(activityDrawer.getByText(/moved from [\s\S]+ to In Progress/)).toBeVisible();
  149 |     await expect(activityDrawer.getByText(/assigned to E2E Member/)).toBeVisible();
  150 |     await expect(activityDrawer.getByText('added a comment')).toBeVisible();
  151 |   });
  152 | });
  153 | 
  154 | // ─── Sprint planning workflow ────────────────────────────────────────────────
  155 | test.describe('sprint planning workflow', () => {
  156 |   const storyTitle = 'Password reset card UX';
  157 |   const bugTitle = 'Confirm email not sent on URGENT';
  158 |   let project: Project;
  159 |   let sprintName: string;
  160 | 
  161 |   test.beforeAll(async () => {
  162 |     await ensureE2EUsers();
  163 |     const ctx = await playwrightRequest.newContext({ baseURL: 'http://localhost:4000' });
  164 |     const api = apiRequest(ctx, OWNER_ID);
  165 |     project = await createE2EProject(api, 'Sprint E2E');
  166 | 
  167 |     await createItem(api, project.id, 'STORY', storyTitle);
  168 |     await createItem(api, project.id, 'BUG', bugTitle);
  169 |   });
  170 | 
  171 |   test.afterAll(async () => {
  172 |     if (!project) return;
  173 |     await withDb(async (client) => {
  174 |       await deleteE2EProject(client, project.id, [OWNER_ID, MEMBER_ID]);
  175 |     });
  176 |   });
  177 | 
  178 |   test('plans, starts, populates, and completes a sprint', async ({ page }) => {
  179 |     await page.setExtraHTTPHeaders({ 'x-user-id': OWNER_ID });
  180 | 
  181 |     // Create a sprint through the UI.
  182 |     await page.goto(`/projects/${project.id}/sprints`);
  183 |     await page.getByRole('button', { name: '+ New Sprint' }).first().click();
  184 |     sprintName = `E2E Sprint ${Date.now().toString().slice(-6)}`;
  185 |     const dialog = page.getByRole('dialog');
  186 |     await dialog.getByText('Name *', { exact: true }).locator('..').locator('input').fill(sprintName);
  187 |     await dialog.getByRole('button', { name: 'Create Sprint' }).click();
  188 |     await expect(page.getByRole('link', { name: sprintName })).toBeVisible();
  189 |     await expect(page.getByText('Planned', { exact: true })).toBeVisible();
  190 | 
  191 |     // Start it.
  192 |     await page.getByRole('button', { name: 'Start Sprint' }).first().click();
> 193 |     await expect(page.getByText('Active', { exact: true })).toBeVisible();
      |                                                             ^ Error: expect(locator).toBeVisible() failed
  194 | 
  195 |     // Populate the sprint from the backlog: select all rows and bulk-assign.
  196 |     await page.goto(`/projects/${project.id}/backlogs`);
  197 |     await expect(page.getByText(storyTitle, { exact: true })).toBeVisible();
  198 |     await expect(page.getByText(bugTitle, { exact: true })).toBeVisible();
  199 |     await page.getByRole('checkbox').first().check();
  200 |     await page.getByRole('combobox').filter({ has: page.locator('option:has-text("Move to Iteration")') }).selectOption({ label: sprintName });
  201 | 
  202 |     // The sprint board shows the planned items.
  203 |     await page.goto(`/projects/${project.id}/sprints`);
  204 |     await page.getByRole('link', { name: sprintName }).click();
  205 |     await expect(page.getByText(/Iteration Backlog · 2 items/)).toBeVisible();
  206 |     const todoColumn = column(page, 'To Do');
  207 |     await expect(todoColumn.getByText(storyTitle, { exact: true })).toBeVisible();
  208 |     await expect(todoColumn.getByText(bugTitle, { exact: true })).toBeVisible();
  209 | 
  210 |     // Complete the sprint, moving leftover items to the backlog.
  211 |     await page.getByRole('button', { name: 'Complete Sprint' }).first().click();
  212 |     const completeDialog = page.getByRole('dialog');
  213 |     await expect(completeDialog.getByText('Move to backlog')).toBeVisible();
  214 |     await completeDialog.getByRole('button', { name: 'Complete Sprint' }).click();
  215 |     await expect(completeDialog.getByText('Sprint completed successfully.')).toBeVisible();
  216 | 
  217 |     // Back on the list the sprint is completed and the remaining filter
  218 |     // respects the completion state.
  219 |     await page.goto(`/projects/${project.id}/sprints`);
  220 |     const finishedCard = page.getByText('Completed', { exact: true }).first();
  221 |     await expect(finishedCard).toBeVisible();
  222 |   });
  223 | });
```
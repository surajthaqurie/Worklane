import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardsController } from './dashboards.controller.js';
import { DashboardsService, DEFAULT_PROJECT_WIDGETS } from './dashboards.service.js';

describe('DashboardsController', () => {
  let controller: DashboardsController;
  let service: DashboardsService;

  beforeEach(() => {
    service = {
      getLayout: vi.fn().mockResolvedValue({
        projectId: 'p-1',
        widgets: DEFAULT_PROJECT_WIDGETS,
      }),
      saveLayout: vi.fn().mockImplementation((userId, projectId, widgets) =>
        Promise.resolve({ projectId, widgets }),
      ),
      resetLayout: vi.fn().mockResolvedValue({
        projectId: 'p-1',
        widgets: DEFAULT_PROJECT_WIDGETS,
      }),
      getDashboardData: vi.fn().mockResolvedValue({
        scope: { projectId: 'p-1', teamId: null },
        sprintSummary: null,
        burndown: null,
        velocity: null,
        myWorkItems: [],
        blockedItems: [],
        activity: [],
        teamProgress: [],
        generatedAt: '2026-09-25T12:00:00.000Z',
      }),
    } as unknown as DashboardsService;

    controller = new DashboardsController(service);
  });

  it('retrieves layout for user and projectId', async () => {
    const req = { user: { id: 'u-1' } };
    const query = { projectId: 'p-1' };

    const result = await controller.getLayout(req, query);

    expect(service.getLayout).toHaveBeenCalledWith('u-1', 'p-1');
    expect(result.widgets).toEqual(DEFAULT_PROJECT_WIDGETS);
  });

  it('persists layout via PUT', async () => {
    const req = { user: { id: 'u-1' } };
    const body = {
      projectId: 'p-1',
      widgets: [
        { id: 'w-1', type: 'MY_WORK_ITEMS' as const, position: 0, colSpan: 2, rowSpan: 1, visible: true },
      ],
    };

    const result = await controller.saveLayout(req, body);

    expect(service.saveLayout).toHaveBeenCalledWith('u-1', 'p-1', body.widgets);
    expect(result.widgets).toEqual(body.widgets);
  });

  it('resets layout via POST', async () => {
    const req = { user: { id: 'u-1' } };
    const body = { projectId: 'p-1' };

    const result = await controller.resetLayout(req, body);

    expect(service.resetLayout).toHaveBeenCalledWith('u-1', 'p-1');
    expect(result.widgets).toEqual(DEFAULT_PROJECT_WIDGETS);
  });

  it('fetches batched dashboard data and sets Cache-Control header', async () => {
    const req = { user: { id: 'u-1' } };
    const query = { projectId: 'p-1', teamId: undefined };
    const res = { setHeader: vi.fn() } as any;

    const result = await controller.getDashboardData(req, query, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, max-age=15, stale-while-revalidate=30',
    );
    expect(service.getDashboardData).toHaveBeenCalledWith('u-1', 'p-1', undefined);
    expect(result.scope.projectId).toBe('p-1');
  });
});

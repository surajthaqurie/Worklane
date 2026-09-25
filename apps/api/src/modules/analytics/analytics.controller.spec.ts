import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  const req = { user: { id: 'u1' } };
  const projectId = 'p1';

  beforeEach(() => {
    service = {
      getBurndown: vi.fn().mockResolvedValue({ iterationId: 'sprint-1' } as any),
      getVelocity: vi.fn().mockResolvedValue({ iterations: [] } as any),
      getCumulativeFlow: vi.fn().mockResolvedValue({ points: [] } as any),
      getCycleTime: vi.fn().mockResolvedValue({ items: [] } as any),
      getLeadTime: vi.fn().mockResolvedValue({ items: [] } as any),
      getSummary: vi.fn().mockResolvedValue({ completedInRange: 5 } as any),
      listSnapshots: vi.fn().mockResolvedValue([]),
      recalculate: vi.fn().mockResolvedValue({ rollupCompleted: true } as any),
    } as unknown as AnalyticsService;

    controller = new AnalyticsController(service);
  });

  it('delegates burndown requests to service', async () => {
    const query = { iterationId: 'sprint-1', teamId: 't1' };
    const res = await controller.burndown(req, projectId, query);

    expect(service.getBurndown).toHaveBeenCalledWith('u1', projectId, query);
    expect(res).toEqual({ iterationId: 'sprint-1' });
  });

  it('delegates velocity requests to service', async () => {
    const query = { from: '2026-01-01', to: '2026-06-01', teamId: 't1' };
    const res = await controller.velocity(req, projectId, query);

    expect(service.getVelocity).toHaveBeenCalledWith('u1', projectId, query);
    expect(res).toEqual({ iterations: [] });
  });

  it('delegates cumulativeFlow requests to service', async () => {
    const query = { from: '2026-01-01', to: '2026-06-01', bucketSizeDays: 1, groupBy: 'category' as const };
    const res = await controller.cumulativeFlow(req, projectId, query);

    expect(service.getCumulativeFlow).toHaveBeenCalledWith('u1', projectId, query);
    expect(res).toEqual({ points: [] });
  });

  it('delegates cycleTime and leadTime requests to service', async () => {
    const query = { from: '2026-01-01', to: '2026-06-01', type: 'BUG', limit: 100 };
    await controller.cycleTime(req, projectId, query);
    expect(service.getCycleTime).toHaveBeenCalledWith('u1', projectId, query);

    await controller.leadTime(req, projectId, query);
    expect(service.getLeadTime).toHaveBeenCalledWith('u1', projectId, query);
  });

  it('delegates summary requests to service', async () => {
    const query = { from: '2026-01-01', to: '2026-06-01' };
    const res = await controller.summary(req, projectId, query);

    expect(service.getSummary).toHaveBeenCalledWith('u1', projectId, query);
    expect(res).toEqual({ completedInRange: 5 });
  });

  it('delegates snapshots list to service', async () => {
    const query = { kind: 'velocity' };
    const res = await controller.snapshots(req, projectId, query);

    expect(service.listSnapshots).toHaveBeenCalledWith('u1', projectId, 'velocity');
    expect(res).toEqual([]);
  });

  it('delegates recompute requests to service', async () => {
    const body = { from: '2026-01-01', to: '2026-06-01' };
    const res = await controller.recompute(req, projectId, body);

    expect(service.recalculate).toHaveBeenCalledWith('u1', projectId, body);
    expect(res).toEqual({ rollupCompleted: true });
  });
});

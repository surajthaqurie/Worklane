import { describe, expect, it } from 'vitest';
import {
  computeBurndown,
  computeCumulativeFlow,
  computeSummary,
  computeTimeToDone,
  computeVelocity,
} from './analytics.calculations.js';
import {
  AnalyticsDataset,
  AnalyticsHistoryEvent,
  AnalyticsIteration,
  AnalyticsStateDef,
  AnalyticsWorkItem,
} from './dto/analytics.dto.js';

/**
 * Deterministic history fixtures.
 *
 * Every assertion below is the result of manually replaying the event log.
 * Times are UTC and intentionally offset from bucket boundaries so ordering is
 * exercised, never just coincidental-integer arithmetic.
 *
 * Sprint 1: 2026-06-01 → 2026-06-07   Sprint 2: 2026-06-08 → 2026-06-14
 *
 * Item A STORY 5pt  created 05-26T09:00 in sprint-1; IP 06-02T09:00, DONE 06-04T09:00
 * Item B BUG   3pt  created 06-01T09:00 in sprint-1; IP 06-02T09:00, DONE 06-03T16:00  (added after sprint start)
 * Item C TASK  2pt  created 06-05T10:00 in sprint-1; points 1→2 on 06-06T11:00; DONE 06-07T12:00  (mid-sprint add + scope change)
 * Item D STORY 8pt  created 05-20T08:00 in sprint-1; IP 06-02T08:00, never done
 * Item E STORY 4pt  created 05-20T08:00 in sprint-1; IP 06-02T08:00, DONE 06-03T15:00, moved to sprint-2 06-06T09:00
 * Item F BUG   2pt  created 06-09T09:00 in sprint-2 (completed_at only); DONE 06-10T12:00
 */
describe('analytics calculations (deterministic fixtures)', () => {
  const T = (s: string) => new Date(s).getTime();

  const states: AnalyticsStateDef[] = [
    { key: 'TODO', name: 'To Do', color: '#9ca3af', sortOrder: 1, category: 'PROPOSED', isDone: false, isDefault: true },
    { key: 'IN_PROGRESS', name: 'In Progress', color: '#3b82f6', sortOrder: 2, category: 'IN_PROGRESS', isDone: false, isDefault: false },
    { key: 'DONE', name: 'Done', color: '#10b981', sortOrder: 3, category: 'COMPLETED', isDone: true, isDefault: false },
  ];

  const iterations: AnalyticsIteration[] = [
    { id: 'sprint-1', projectId: 'p1', name: 'Sprint 1', startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-06-07T00:00:00Z'), state: 'COMPLETED' },
    { id: 'sprint-2', projectId: 'p1', name: 'Sprint 2', startDate: new Date('2026-06-08T00:00:00Z'), endDate: new Date('2026-06-14T00:00:00Z'), state: 'ACTIVE' },
  ];

  function item(partial: Partial<AnalyticsWorkItem> & { id: string }): AnalyticsWorkItem {
    return {
      projectId: 'p1',
      seqNo: 0,
      iterationId: null,
      areaId: 'area-1',
      type: 'STORY',
      title: partial.id,
      state: 'TODO',
      priority: 'MEDIUM',
      points: 0,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      completedAt: null,
      closedAt: null,
      deletedAt: null,
      targetDate: null,
      severity: null,
      assignedTo: null,
      ...partial,
    };
  }

  let seq = 0;
  function ev(
    workItemId: string,
    action: string,
    at: string,
    field: string | null = null,
    oldValue: string | null = null,
    newValue: string | null = null,
  ): AnalyticsHistoryEvent {
    const created = new Date(at);
    return {
      id: `e${++seq}`,
      workItemId,
      action,
      field,
      oldValue,
      newValue,
      createdAt: created,
      insertedAt: created,
    };
  }

  const items: AnalyticsWorkItem[] = [
    item({ id: 'a', seqNo: 1, type: 'STORY', title: 'Alpha', state: 'DONE', points: 5, iterationId: 'sprint-1', createdAt: new Date('2026-05-26T09:00:00Z'), completedAt: new Date('2026-06-04T09:00:00Z') }),
    item({ id: 'b', seqNo: 2, type: 'BUG', title: 'Beta', state: 'DONE', points: 3, iterationId: 'sprint-1', createdAt: new Date('2026-06-01T09:00:00Z'), completedAt: new Date('2026-06-03T16:00:00Z') }),
    item({ id: 'c', seqNo: 3, type: 'TASK', title: 'Gamma', state: 'DONE', points: 2, iterationId: 'sprint-1', createdAt: new Date('2026-06-05T10:00:00Z'), completedAt: new Date('2026-06-07T12:00:00Z') }),
    item({ id: 'd', seqNo: 4, type: 'STORY', title: 'Delta', state: 'IN_PROGRESS', points: 8, iterationId: 'sprint-1', createdAt: new Date('2026-05-20T08:00:00Z') }),
    item({ id: 'e', seqNo: 5, type: 'STORY', title: 'Echo', state: 'DONE', points: 4, iterationId: 'sprint-2', createdAt: new Date('2026-05-20T08:00:00Z'), completedAt: new Date('2026-06-03T15:00:00Z') }),
    item({ id: 'f', seqNo: 6, type: 'BUG', title: 'Foxtrot', state: 'DONE', points: 2, iterationId: 'sprint-2', createdAt: new Date('2026-06-09T09:00:00Z'), completedAt: new Date('2026-06-10T12:00:00Z') }),
  ];

  const history: AnalyticsHistoryEvent[] = [
    ev('a', 'STATE_CHANGED', '2026-06-02T09:00:00Z', 'state', 'TODO', 'IN_PROGRESS'),
    ev('a', 'STATE_CHANGED', '2026-06-04T09:00:00Z', 'state', 'IN_PROGRESS', 'DONE'),
    ev('b', 'STATE_CHANGED', '2026-06-02T09:00:00Z', 'state', 'TODO', 'IN_PROGRESS'),
    ev('b', 'STATE_CHANGED', '2026-06-03T16:00:00Z', 'state', 'IN_PROGRESS', 'DONE'),
    ev('c', 'POINTS_CHANGED', '2026-06-06T11:00:00Z', 'points', '1', '2'),
    ev('c', 'STATE_CHANGED', '2026-06-07T12:00:00Z', 'state', 'TODO', 'DONE'),
    ev('d', 'STATE_CHANGED', '2026-06-02T08:00:00Z', 'state', 'TODO', 'IN_PROGRESS'),
    ev('e', 'STATE_CHANGED', '2026-06-02T08:00:00Z', 'state', 'TODO', 'IN_PROGRESS'),
    ev('e', 'STATE_CHANGED', '2026-06-03T15:00:00Z', 'state', 'IN_PROGRESS', 'DONE'),
    ev('e', 'ITERATION_CHANGED', '2026-06-06T09:00:00Z', 'iteration_id', 'sprint-1', 'sprint-2'),
  ];

  const dataset: AnalyticsDataset = { iterations, states, items, history };

  describe('computeBurndown', () => {
    const bd = computeBurndown(dataset, 'sprint-1');

    it('reports opening scope from items already in the sprint at its start', () => {
      expect(bd.iterationName).toBe('Sprint 1');
      expect(bd.startDate).toBe('2026-06-01');
      expect(bd.endDate).toBe('2026-06-07');
      // A(5) + D(8) + E(4); B was created 09:00 after the start instant.
      expect(bd.totalScopePoints).toBe(17);
      expect(bd.totalScopeItems).toBe(3);
    });

    it('replays scope additions, points changes and mid-sprint removals day by day', () => {
      // Points are dated by the (start of) the bucket they describe:
      // scope line → 20 (06-01..06-04), 21 (+C 1pt @06-05), 18 (E departs @06-06).
      const byDate = new Map(bd.points.map((p) => [p.date, p]));
      expect(byDate.get('2026-06-01')?.scopePoints).toBe(20);
      expect(byDate.get('2026-06-05')?.scopePoints).toBe(21);
      expect(byDate.get('2026-06-05')?.scopeItems).toBe(5);
      expect(byDate.get('2026-06-06')?.scopePoints).toBe(18);
      // Remaining is not monotonic: C's 1→2 reestimate lifts 06-06 back to 10.
      expect(byDate.get('2026-06-05')?.remainingPoints).toBe(9);
      expect(byDate.get('2026-06-06')?.remainingPoints).toBe(10);
    });

    it('counts completed items only after their done transition', () => {
      const byDate = new Map(bd.points.map((p) => [p.date, p]));
      expect(byDate.get('2026-06-02')?.completedPoints).toBe(0);
      expect(byDate.get('2026-06-03')?.completedPoints).toBe(7); // B(3) + E(4)
      expect(byDate.get('2026-06-04')?.completedPoints).toBe(12); // + A(5)
    });

    it('excludes items that left the sprint mid-flight from trailing buckets', () => {
      const byDate = new Map(bd.points.map((p) => [p.date, p]));
      // E left for sprint-2 on 06-06T09:00 → its 4pt roll off sprint-1 scope.
      expect(byDate.get('2026-06-07')?.scopePoints).toBe(18); // A5+B3+C2+D8
      expect(byDate.get('2026-06-07')?.remainingPoints).toBe(8); // D(8) open, C done
      expect(byDate.get('2026-06-07')?.remainingItems).toBe(1);
    });

    it('finishes with correct totals and an ideal line', () => {
      expect(bd.completedPoints).toBe(10); // A+B+C (E departed, D open)
      expect(bd.remainingPoints).toBe(8); // D(8) still in progress
      expect(bd.isComplete).toBe(false);
      expect(bd.ideal).toHaveLength(bd.points.length);
      expect(bd.ideal[0].points).toBe(17);
      expect(bd.meta.source).toBe('live');
    });
  });

  describe('computeVelocity', () => {
    const vel = computeVelocity(dataset, T('2026-05-01T00:00:00Z'), T('2026-07-01T00:00:00Z'));

    it('counts committed scope at each sprint start instant', () => {
      const [s1, s2] = vel.iterations;
      expect(s1.committedPoints).toBe(17); // A,B-excluded,D,E
      expect(s1.committedItems).toBe(3);
      expect(s2.committedPoints).toBe(4); // only E was assigned to sprint-2 at its start
      expect(s2.committedItems).toBe(1);
    });

    it('attributes completions to the sprint the item belonged to at done time', () => {
      const [s1, s2] = vel.iterations;
      // A5 + B3 + C2 + E4 = 14. E counts for sprint-1 even though it ended in sprint-2.
      expect(s1.completedPoints).toBe(14);
      expect(s1.completedItems).toBe(4);
      expect(s2.completedPoints).toBe(2); // F (2)
      expect(s2.completedItems).toBe(1);
      expect(s1.completionRatio).toBeCloseTo(14 / 17, 4);
      expect(s2.completionRatio).toBeCloseTo(0.5, 4);
    });

    it('produces the summary block', () => {
      expect(vel.summary.iterations).toBe(2);
      expect(vel.summary.totalCommittedPoints).toBe(21);
      expect(vel.summary.totalCompletedPoints).toBe(16);
      expect(vel.summary.avgCompletedPoints).toBe(8);
      expect(vel.summary.lastIteration?.iterationId).toBe('sprint-2');
    });
  });

  describe('computeCumulativeFlow', () => {
    const cfd = computeCumulativeFlow(dataset, T('2026-06-01T00:00:00Z'), T('2026-06-08T00:00:00Z'), 1, 'category');

    function seriesByDate(date: string) {
      const m = new Map(cfd.points.map((p) => [p.date, p]));
      const point = m.get(date);
      if (!point) throw new Error(`No CFD point for ${date}`);
      return Object.fromEntries(point.series.map((s) => [s.key, s.value]));
    }

    it('reconstructs the category distribution per day from transitions', () => {
      expect(seriesByDate('2026-06-01')).toEqual({ PROPOSED: 4, IN_PROGRESS: 0, RESOLVED: 0, COMPLETED: 0 });
      expect(seriesByDate('2026-06-03')).toEqual({ PROPOSED: 0, IN_PROGRESS: 2, RESOLVED: 0, COMPLETED: 2 });
    });

    it('shows completed items only after their done transition', () => {
      expect(seriesByDate('2026-06-05')).toEqual({ PROPOSED: 1, IN_PROGRESS: 1, RESOLVED: 0, COMPLETED: 3 });
      // C done 06-07T12:00 → appears from the 06-07 day:
      expect(seriesByDate('2026-06-07')).toEqual({ PROPOSED: 0, IN_PROGRESS: 1, RESOLVED: 0, COMPLETED: 4 });
    });

    it('totals the trailing bucket', () => {
      expect(cfd.totals.find((t) => t.key === 'COMPLETED')?.value).toBe(4);
      expect(cfd.totals.find((t) => t.key === 'IN_PROGRESS')?.value).toBe(1);
    });
  });

  describe('computeTimeToDone', () => {
    const from = T('2026-05-20T00:00:00Z');
    const to = T('2026-06-15T00:00:00Z');

    describe('cycle time', () => {
      const cycle = computeTimeToDone(dataset, { kind: 'cycle', fromMs: from, toMs: to });

      it('includes every item completed in the window', () => {
        expect(cycle.stats.count).toBe(5); // A B C E F
        expect(cycle.items.map((i) => i.workItemId).sort()).toEqual(['a', 'b', 'c', 'e', 'f']);
      });

      it('measures from the first In Progress transition', () => {
        const byId = new Map(cycle.items.map((i) => [i.workItemId, i]));
        // A: 06-02T09:00 → 06-04T09:00
        expect(byId.get('a')?.durationDays).toBeCloseTo(2, 2);
        // C has no In Progress transition — falls back to creation.
        expect(byId.get('c')?.durationDays).toBeCloseTo(50 / 24, 2);
        expect(byId.get('c')?.startedAt).toBe('2026-06-05T10:00:00.000Z');
      });

      it('computes percentiles from sorted durations', () => {
        // sorted days: 1.13 (F), 1.29 (E), 1.29 (B), 2 (A), 2.08 (C)
        expect(cycle.stats.minDays).toBeCloseTo(27 / 24, 2);
        expect(cycle.stats.medianDays).toBeCloseTo(31 / 24, 2);
        expect(cycle.stats.p85Days).toBeCloseTo(50 / 24, 2);
        expect(cycle.stats.maxDays).toBeCloseTo(50 / 24, 2);
      });

      it('buckets durations for the distribution histogram', () => {
        const buckets = new Map(cycle.stats.distribution.map((b) => [b.label, b.count]));
        expect(buckets.get('<1d')).toBe(0);
        expect(buckets.get('1-2d')).toBe(3); // F E B
        expect(buckets.get('2-3d')).toBe(2); // A C
        expect(buckets.get('3-5d')).toBe(0);
      });
    });

    describe('lead time', () => {
      const lead = computeTimeToDone(dataset, { kind: 'lead', fromMs: from, toMs: to });

      it('measures from creation', () => {
        // E: created 05-20T08:00 → done 06-03T15:00 = 14d7h
        const e = lead.items.find((i) => i.workItemId === 'e');
        expect(e?.durationDays).toBeCloseTo(343 / 24, 2);
        // B: created 06-01T09:00 → done 06-03T16:00 = 2d7h
        const b = lead.items.find((i) => i.workItemId === 'b');
        expect(b?.durationDays).toBeCloseTo(55 / 24, 2);
      });

      it('computes stats over all completed items', () => {
        expect(lead.stats.count).toBe(5);
        // sorted hours: 27 (F), 50 (C), 55 (B), 216 (A), 343 (E)
        expect(lead.stats.medianHours).toBe(55);
        expect(lead.stats.p95Hours).toBe(343);
        expect(lead.stats.avgDays).toBeCloseTo(691 / 5 / 24, 2);
      });
    });

    it('respects the type filter', () => {
      const bugs = computeTimeToDone(dataset, { kind: 'lead', fromMs: from, toMs: to, type: 'BUG' });
      expect(bugs.stats.count).toBe(2); // B F
      expect(bugs.items.map((i) => i.workItemId).sort()).toEqual(['b', 'f']);
    });
  });

  describe('computeSummary', () => {
    const sum = computeSummary(dataset, T('2026-06-01T00:00:00Z'), T('2026-06-08T00:00:00Z'));

    it('rolls up velocity, flow and cycle/lead stats', () => {
      // Iterations overlapping [06-01, 06-08]: sprint-1 and sprint-2's start day.
      expect(sum.velocity.iterations).toBe(2);
      expect(sum.velocity.totalCompletedPoints).toBe(14); // A B C E (F done after window)
      expect(sum.velocity.avgCompletedPoints).toBe(7);
      expect(sum.completedInRange).toBe(4); // A B C E
      expect(sum.createdInRange).toBe(2); // B C
      expect(sum.flow.completed).toBe(4);
      expect(sum.flow.inProgress).toBe(1);
      expect(sum.cycleTime.count).toBe(4);
      expect(sum.leadTime.count).toBe(4);
    });
  });
});
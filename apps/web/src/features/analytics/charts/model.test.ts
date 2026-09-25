import { describe, expect, it } from 'vitest';
import {
  barHeight,
  barLayout,
  barY,
  formatDaysCompact,
  formatHoursCompact,
  guideLine,
  linePath,
  makeArea,
  niceCeil,
  niceTicks,
  scaleLinear,
  stackedAreaPaths,
} from './model';

const AREA = { left: 0, top: 0, width: 100, height: 100 };

describe('niceCeil / niceTicks', () => {
  it('rounds up to 1/2/5 × 10^k ceilings', () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(1.9)).toBe(2);
    expect(niceCeil(2.1)).toBe(5);
    expect(niceCeil(5)).toBe(5);
    expect(niceCeil(7)).toBe(10);
    expect(niceCeil(99)).toBe(100);
  });

  it('produces evenly spaced ticks from 0 to the ceiling', () => {
    expect(niceTicks(1.9)).toEqual({ values: [0, 0.5, 1, 1.5, 2], step: 0.5, max: 2, digits: 1 });
    expect(niceTicks(10).values).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(niceTicks(10).digits).toBe(0);
  });
});

describe('scaleLinear', () => {
  it('maps values linearly in pixel space', () => {
    expect(scaleLinear(0.5, 0, 1, 0, 100)).toBe(50);
    expect(scaleLinear(0, 0, 1, 0, 100)).toBe(0);
    expect(scaleLinear(1, 0, 1, 0, 100)).toBe(100);
  });

  it('falls back to the midpoint for degenerate ranges', () => {
    expect(scaleLinear(42, 42, 42, 0, 100)).toBe(50);
  });
});

describe('linePath', () => {
  it('connects points across the chart area', () => {
    expect(linePath([0, 1], AREA, 1)).toBe('M0,100 L100,0');
  });

  it('handles empty and single-point inputs', () => {
    expect(linePath([], AREA)).toBe('');
    expect(linePath([5], AREA, 10)).toBe('M50,50');
  });

  it('derives a max from the data when none is given', () => {
    expect(linePath([0, 10], AREA)).toBe('M0,100 L100,0');
  });
});

describe('guideLine', () => {
  it('emits a straight M/L segment', () => {
    expect(guideLine({ x: 0, y: 100 }, { x: 100, y: 0 })).toBe('M0,100 L100,0');
  });
});

describe('stackedAreaPaths', () => {
  // cumulative = [[0,1],[1,2]] → two bands; band #1 (top) peaks at 2.
  it('fills each stacked band between the previous and current cumulative', () => {
    const { paths, topEdge, maxY } = stackedAreaPaths([[0, 1], [1, 2]], AREA);
    expect(maxY).toBe(2);
    expect(paths[0]).toBe('M0,100 L100,50L100,100L0,100Z');
    expect(paths[1]).toBe('M0,50 L100,0L100,50L0,100Z');
    expect(topEdge).toBe('M0,50 L100,0');
  });

  it('stacks with a taller ceiling when provided', () => {
    const { maxY, topEdge } = stackedAreaPaths([[0, 1], [1, 2]], AREA, 4);
    expect(maxY).toBe(4);
    // top band peak (2) maps to the middle of the chart.
    expect(topEdge).toBe('M0,75 L100,50');
  });
});

describe('barLayout', () => {
  it('places grouped bars evenly across the area', () => {
    const groups = barLayout(3, 2, { left: 0, top: 0, width: 120, height: 100 });
    expect(groups).toHaveLength(3);
    expect(groups[0].x[0]).toBeCloseTo(9, 4);
    expect(groups[0].x[1]).toBeCloseTo(17.8, 4);
    expect(groups[1].x[0]).toBeCloseTo(49, 4);
    expect(groups[2].x[0]).toBeCloseTo(89, 4);
    expect(groups[0].width).toBeCloseTo(5.28, 4);
  });

  it('returns [] for no groups', () => {
    expect(barLayout(0, 2, AREA)).toEqual([]);
  });
});

describe('bar geometry', () => {
  it('computes bar tops and heights from the value scale', () => {
    const area = { ...AREA, top: 0, height: 100 };
    expect(barY(5, 10, area)).toBe(50);
    expect(barHeight(5, 10, area)).toBe(50);
    expect(barHeight(0, 10, area)).toBe(0);
  });
});

describe('duration formatting', () => {
  it('formats day/hour values compactly', () => {
    expect(formatDaysCompact(0.5)).toBe('12h');
    expect(formatDaysCompact(1.5)).toBe('1.5d');
    expect(formatHoursCompact(36)).toBe('1.5d');
    expect(formatHoursCompact(12.5)).toBe('12.5h');
  });
});

describe('makeArea', () => {
  it('carves margins out of the total width', () => {
    expect(makeArea(300)).toEqual({ left: 44, top: 12, width: 244, height: 218 });
  });

  it('clamps width and height to 0 for tiny containers', () => {
    expect(makeArea(20, 20)).toEqual({ left: 44, top: 12, width: 0, height: 0 });
  });
});

describe('boundary & edge cases', () => {
  it('handles negative or zero niceCeil gracefully', () => {
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(0)).toBe(1);
  });

  it('handles empty stackedAreaPaths', () => {
    const res = stackedAreaPaths([], AREA);
    expect(res.paths).toEqual([]);
    expect(res.topEdge).toBe('');
    expect(res.maxY).toBe(1);
  });

  it('handles single-column stackedAreaPaths', () => {
    const res = stackedAreaPaths([[5, 10]], AREA, 10);
    expect(res.paths).toHaveLength(1);
    expect(res.maxY).toBe(10);
  });
});
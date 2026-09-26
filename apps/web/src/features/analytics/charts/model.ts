/**
 * Pure SVG chart math for the analytics dashboard.
 *
 * Free of React / DOM on purpose so it can be unit-tested under the node
 * test environment. Components turn these paths/scales into SVG markup.
 */

export const CHART_HEIGHT = 260;
export const PAD_LEFT = 44;
export const PAD_RIGHT = 12;
export const PAD_TOP = 12;
export const PAD_BOTTOM = 30;

export interface ChartArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function makeArea(width: number, height: number = CHART_HEIGHT): ChartArea {
  return {
    left: PAD_LEFT,
    top: PAD_TOP,
    width: Math.max(0, width - PAD_LEFT - PAD_RIGHT),
    height: Math.max(0, height - PAD_TOP - PAD_BOTTOM),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Round a positive number up to a nice axis ceiling (1/2/5 × 10^k). */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

/**
 * Tick values from 0 up to `niceCeil(max)`. If max is 1.9 the ceiling is 2 and
 * we get [0, 0.5, 1, 1.5, 2]. `digits` keeps labels like 0.5 clean.
 */
export function niceTicks(max: number, target = 4): { values: number[]; step: number; max: number; digits: number } {
  const top = niceCeil(max);
  const step = top / target;
  const values: number[] = [];
  for (let i = 0; i <= target; i++) values.push(round2(i * step));
  const digits = step >= 1 ? 0 : step >= 0.5 ? 1 : 2;
  return { values, step, max: top, digits };
}

/** Linear interpolation in pixel space. */
export function scaleLinear(
  value: number,
  min: number,
  max: number,
  minPx: number,
  maxPx: number,
): number {
  if (max === min) return (minPx + maxPx) / 2;
  return minPx + ((value - min) / (max - min)) * (maxPx - minPx);
}

function xAt(i: number, count: number, area: ChartArea): number {
  return area.left + (count <= 1 ? area.width / 2 : (area.width / (count - 1)) * i);
}

export function yAt(value: number, max: number, area: ChartArea): number {
  return area.top + area.height - scaleLinear(value, 0, max, 0, area.height);
}

/** Single polyline ("M…L…") through `values` (uniformly spaced along x). */
export function linePath(values: number[], area: ChartArea, yMax?: number): string {
  if (values.length === 0) return '';
  const max = yMax ?? Math.max(...values, 1);
  return values
    .map((v, i) => {
      const x = xAt(i, values.length, area);
      const y = yAt(v, max, area);
      return `${i === 0 ? 'M' : 'L'}${round2(x)},${round2(y)}`;
    })
    .join(' ');
}

/** Straight dashed guide from (start) to (end) across the same x-axis. */
export function guideLine(start: { x: number; y: number }, end: { x: number; y: number }): string {
  return `M${round2(start.x)},${round2(start.y)} L${round2(end.x)},${round2(end.y)}`;
}

/**
 * Stacked area chart paths. `cumulative[column][pointIndex]` is the running
 * sum across series, so band `col` spans [cumulative[col-1], cumulative[col]].
 * Returns one filled path per column (bottom → top order) plus the top edge
 * polyline (optional) for the total line.
 */
export function stackedAreaPaths(
  cumulative: number[][],
  area: ChartArea,
  yMax?: number,
): { paths: string[]; topEdge: string; maxY: number } {
  const count = cumulative[0]?.length ?? 0;
  const lastCol = cumulative[cumulative.length - 1] ?? [];
  const maxY = yMax ?? Math.max(...lastCol, 1);
  const xs = Array.from({ length: count }, (_, i) => xAt(i, count, area));

  const paths = cumulative.map((col, colIndex) => {
    const prev = colIndex === 0 ? col.map(() => 0) : cumulative[colIndex - 1];
    const top = col
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${round2(xs[i])},${round2(yAt(v, maxY, area))}`)
      .join(' ');
    const bottom = `${count > 0 ? `L${round2(xs[count - 1])},${round2(yAt(prev[count - 1] ?? 0, maxY, area))}` : ''}${count > 0 ? `L${round2(xs[0])},${round2(yAt(prev[0] ?? 0, maxY, area))}` : ''}Z`;
    return `${top}${bottom}`;
  });

  const topEdge = lastCol
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${round2(xs[i])},${round2(yAt(v, maxY, area))}`)
    .join(' ');

  return { paths, topEdge, maxY };
}

export interface BarGroup {
  /** x-positions of the N bars inside one group. */
  x: number[];
  width: number;
}

/**
 * Layout for grouped bars across `groupCount` groups of `barCount` bars each,
 * leaving 60% of each group slot as padding.
 */
export function barLayout(
  groupCount: number,
  barCount: number,
  area: ChartArea,
  groupPaddingRatio = 0.45,
): BarGroup[] {
  if (groupCount === 0) return [];
  const slot = area.width / groupCount;
  const groupWidth = slot * (1 - groupPaddingRatio);
  const gap = groupWidth / (barCount + 0.5);
  const barWidth = gap * 0.6;
  return Array.from({ length: groupCount }, (_, g) => {
    const groupLeft = area.left + g * slot + (slot - groupWidth) / 2;
    const x: number[] = [];
    for (let b = 0; b < barCount; b++) {
      x.push(groupLeft + b * gap);
    }
    return { x, width: barWidth };
  });
}

/** Y pixel position of a bar's top edge. */
export function barY(value: number, max: number, area: ChartArea): number {
  return yAt(value, max, area);
}

export function barHeight(value: number, max: number, area: ChartArea): number {
  return area.top + area.height - barY(value, max, area);
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function formatDaysCompact(days: number): string {
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${round2(days)}d`;
}

export function formatHoursCompact(hours?: number | null): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return 'N/A';
  if (hours < 24) return `${round2(hours)}h`;
  return formatDaysCompact(hours / 24);
}
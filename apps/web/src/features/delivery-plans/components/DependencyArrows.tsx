'use client';

import { useMemo } from 'react';
import {
  TimelineDependency,
  TimelineWorkItem,
} from '@/shared/types/delivery-plans';
import {
  TimelineRow,
  TimelineRange,
  barForWorkItem,
} from './timelineModel';

interface ArrowPath {
  id: string;
  d: string;
  dashed: boolean;
}

/**
 * SVG overlay drawing dependency arrows between the work items that are
 * currently rendered (the visible row window). Only the visible slice is
 * ever rasterized, keeping the DOM lightweight for large timelines.
 */
export function DependencyArrows({
  rows,
  startIndex,
  endIndex,
  topOf,
  range,
  pxPerDay,
  dependencies,
  width,
  height,
}: {
  rows: TimelineRow[];
  startIndex: number;
  endIndex: number;
  topOf: (index: number) => number;
  range: TimelineRange;
  pxPerDay: number;
  dependencies: TimelineDependency[];
  width: number;
  height: number;
}) {
  const paths = useMemo<ArrowPath[]>(() => {
    const centerY = new Map<string, number>();
    const bar = new Map<string, { left: number; width: number }>();
    for (let i = startIndex; i < endIndex; i++) {
      const row = rows[i];
      if (row.workItem) {
        centerY.set(row.id, topOf(i) + row.height / 2);
        bar.set(row.id, barForWorkItem(row.workItem, range, pxPerDay));
      }
    }

    const result: ArrowPath[] = [];
    for (const dep of dependencies) {
      const sy = centerY.get(dep.sourceWorkItemId);
      const ty = centerY.get(dep.targetWorkItemId);
      if (sy == null || ty == null) continue;
      const sb = bar.get(dep.sourceWorkItemId)!;
      const tb = bar.get(dep.targetWorkItemId)!;
      const sCenter = sb.left + sb.width / 2;
      const tCenter = tb.left + tb.width / 2;
      const rightward = tCenter >= sCenter;
      const x1 = rightward ? sb.left + sb.width : sb.left;
      const x2 = rightward ? tb.left : tb.left + tb.width;
      const dx = Math.min(Math.max(Math.abs(x2 - x1) / 2, 14), 56) * (rightward ? 1 : -1);
      const d = `M ${x1.toFixed(1)} ${sy.toFixed(1)} C ${(x1 + dx).toFixed(1)} ${sy.toFixed(1)}, ${(x2 - dx).toFixed(1)} ${ty.toFixed(1)}, ${x2.toFixed(1)} ${ty.toFixed(1)}`;
      result.push({
        id: dep.id,
        d,
        dashed: dep.linkType === 'RELATED',
      });
    }
    return result;
  }, [rows, startIndex, endIndex, topOf, range, pxPerDay, dependencies]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="dep-arrow-solid"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--arrow-color, #64748b)" />
        </marker>
        <marker
          id="dep-arrow-dashed"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--arrow-rel-color, #94a3b8)" />
        </marker>
      </defs>
      <g style={{ ['--arrow-color' as string]: '#64748b', ['--arrow-rel-color' as string]: '#94a3b8' }}>
        {paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill="none"
            stroke={p.dashed ? 'var(--arrow-rel-color)' : 'var(--arrow-color)'}
            strokeWidth={p.dashed ? 1.25 : 1.75}
            strokeDasharray={p.dashed ? '4 3' : undefined}
            markerEnd={`url(#dep-arrow-${p.dashed ? 'dashed' : 'solid'})`}
          />
        ))}
      </g>
    </svg>
  );
}

export type { TimelineWorkItem };
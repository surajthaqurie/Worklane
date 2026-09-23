'use client';

import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  CHART_HEIGHT,
  ChartArea,
  round2,
  scaleLinear,
  yAt,
  niceTicks,
} from '../charts/model';

/**
 * Measures its container and re-renders the chart at the measured pixel
 * width so SVG text/scales stay crisp. SSR renders at a safe default.
 */
export function useContainerWidth(): { ref: React.RefObject<HTMLDivElement | null>; width: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(100, el.getBoundingClientRect().width || 640));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

export function ResponsiveChart({
  height = CHART_HEIGHT,
  ariaLabel,
  render,
}: {
  height?: number;
  ariaLabel: string;
  render: (width: number) => ReactNode;
}) {
  const { ref, width } = useContainerWidth();
  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="block max-w-full"
        style={{ minWidth: 120 }}
        focusable="false"
      >
        {render(width)}
      </svg>
    </div>
  );
}

function formatTick(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$/, '');
}

/** Horizontal gridlines + numeric labels at "nice" intervals. */
export function YAxis({ area, ticks }: { area: ChartArea; ticks: ReturnType<typeof niceTicks> }) {
  return (
    <g>
      {ticks.values.map((v, i) => {
        if (i === 0) return null; // baseline is the plot area edge
        const y = round2(yAt(v, ticks.max, area));
        return (
          <g key={`t-${v}`} aria-hidden="true">
            <line
              x1={area.left}
              x2={area.left + area.width}
              y1={y}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth={1}
              strokeDasharray={i === ticks.values.length - 1 ? undefined : '3 4'}
            />
            <text x={area.left - 8} y={y + 3.5} textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {formatTick(v, ticks.digits)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Evenly-spaced subset of x labels (max ~8) under the plot. */
export function XLabels({
  area,
  labels,
  max = 8,
}: {
  area: ChartArea;
  labels: string[];
  max?: number;
}) {
  const count = labels.length;
  if (count === 0) return null;
  const stride = Math.max(1, Math.ceil(count / max));
  const indices: number[] = [];
  for (let i = 0; i < count; i += stride) indices.push(i);
  if (indices[indices.length - 1] !== count - 1) indices.push(count - 1);

  return (
    <g aria-hidden="true">
      {indices.map((i) => {
        const x = area.left + (count <= 1 ? area.width / 2 : (area.width / (count - 1)) * i);
        return (
          <text
            key={`x-${i}`}
            x={round2(x)}
            y={area.top + area.height + 18}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-muted)"
          >
            {labels[i]}
          </text>
        );
      })}
    </g>
  );
}

export function Legend({ items, title }: { items: Array<{ key: string; label: string; color?: string }>; title?: string }) {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
      aria-label={title}
      role="list"
    >
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: item.color ?? 'var(--brand-primary)' }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Marginal helper used by charts to place dot markers on polylines. */
export function markerPosition(values: number[], i: number, area: ChartArea, max: number) {
  if (values.length <= 1) {
    return { x: area.left + area.width / 2, y: yAt(values[0] ?? 0, max, area) };
  }
  const x = area.left + (area.width / (values.length - 1)) * i;
  return { x, y: yAt(values[i], max, area) };
}

export { scaleLinear };
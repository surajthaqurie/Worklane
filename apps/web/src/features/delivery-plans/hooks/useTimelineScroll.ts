'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TimelineRow, computeRowWindow, rowOffsets } from '../components/timelineModel';

export interface TimelineScroll {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  scrollTop: number;
  scrollLeft: number;
  viewportHeight: number;
  onScroll: () => void;
}

/**
 * Tracks the scroll container's position and viewport height so the timeline
 * can render only the rows intersecting the viewport (custom row windowing —
 * no virtualization library is installed in this repo).
 */
export function useTimelineScroll(): TimelineScroll {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setScrollTop(el.scrollTop);
      setScrollLeft(el.scrollLeft);
      setViewportHeight(el.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    setScrollLeft(el.scrollLeft);
    setViewportHeight(el.clientHeight);
  }, []);

  return { scrollRef, scrollTop, scrollLeft, viewportHeight, onScroll };
}

export function useRowWindow(
  rows: TimelineRow[],
  scrollTop: number,
  viewportHeight: number,
) {
  const offsets = useMemo(() => rowOffsets(rows), [rows]);
  const totalHeight = offsets.length ? offsets[offsets.length - 1] + rows[rows.length - 1].height : 0;
  const window = useMemo(
    () => computeRowWindow(offsets, totalHeight, Math.max(0, scrollTop), Math.max(0, viewportHeight)),
    [offsets, totalHeight, scrollTop, viewportHeight],
  );
  // Row index → absolute top offset, exposed so rows can be positioned.
  const topOf = useCallback(
    (index: number) => (offsets[index] ?? 0),
    [offsets],
  );
  return { window, topOf, totalHeight };
}
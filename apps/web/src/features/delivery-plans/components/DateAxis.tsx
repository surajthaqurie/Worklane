'use client';

import { AxisCell, HEADER_HEIGHT, TimelineRange } from './timelineModel';
import { format, startOfDay, differenceInCalendarDays } from 'date-fns';

export function DateAxis({
  cells,
  range,
  pxPerDay,
  canvasWidth,
}: {
  cells: AxisCell[];
  range: TimelineRange;
  pxPerDay: number;
  canvasWidth: number;
}) {
  const todayStart = startOfDay(new Date());
  const todayX = Math.max(0, differenceInCalendarDays(todayStart, range.start) * pxPerDay);

  return (
    <div className="relative select-none" style={{ width: canvasWidth, height: HEADER_HEIGHT }}>
      {/* Vertical gridlines behind the labels */}
      <div className="absolute inset-y-0 left-0 right-0" aria-hidden="true">
        {cells.map((cell) => (
          <div
            key={cell.key}
            className="absolute inset-y-0 border-l border-[var(--border-subtle)]"
            style={{ left: cell.left, width: cell.width }}
          />
        ))}
      </div>

      {cells.map((cell) => {
        // The daily axis marks the cell that contains today.
        const containsToday =
          cells[0]?.width === pxPerDay &&
          todayX >= cell.left &&
          todayX < cell.left + cell.width;
        return (
          <div
            key={cell.key}
            className={`absolute inset-y-0 flex flex-col justify-center items-center gap-px border-r border-[var(--border-subtle)] ${
              containsToday
                ? 'text-[var(--brand-primary)]'
                : 'text-[var(--text-muted)]'
            }`}
            style={{ left: cell.left, width: cell.width }}
          >
            {cell.monthLabel && (
              <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">
                {cell.monthLabel}
              </span>
            )}
            <span className={`text-[10px] leading-tight ${containsToday ? 'font-semibold' : ''}`}>
              {cell.label}
            </span>
          </div>
        );
      })}

      {/* "Today" marker pill */}
      {todayX >= 0 && todayX <= canvasWidth && (
        <div
          className="absolute top-1 px-1 py-px bg-[var(--brand-primary)] text-white text-[9px] font-bold rounded-sm shadow-sm pointer-events-none"
          style={{ left: Math.min(todayX, Math.max(canvasWidth - 44, 0)) }}
          aria-label="Today"
        >
          Today {format(todayStart, 'MMM d')}
        </div>
      )}
    </div>
  );
}
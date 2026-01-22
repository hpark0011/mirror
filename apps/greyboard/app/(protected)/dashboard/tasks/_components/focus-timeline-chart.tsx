"use client";

import { useMemo } from "react";
import type { TimelineDay } from "@/lib/insights-utils";
import { formatDuration } from "@/features/timer";

interface FocusTimelineChartProps {
  data: TimelineDay[];
}

/**
 * Timeline chart showing focus sessions across hours of the day for multiple days.
 *
 * Displays horizontal bars representing work sessions, with each row being a day.
 * Shows both when work happened (time of day) and how much (duration).
 */
export function FocusTimelineChart({ data }: FocusTimelineChartProps) {
  const { minHour, maxHour } = useMemo(() => {
    let min = 24;
    let max = 0;

    for (const day of data) {
      for (const session of day.sessions) {
        min = Math.min(min, Math.floor(session.startHour));
        max = Math.max(max, Math.ceil(session.endHour));
      }
    }

    // Add padding and ensure reasonable range
    min = Math.max(0, min - 1);
    max = Math.min(24, max + 1);

    // Ensure minimum range of 8 hours
    if (max - min < 8) {
      const mid = (min + max) / 2;
      min = Math.max(0, Math.floor(mid - 4));
      max = Math.min(24, Math.ceil(mid + 4));
    }

    return { minHour: min, maxHour: max };
  }, [data]);

  const hourRange = maxHour - minHour;
  const hourLabels = useMemo(() => {
    const labels: { hour: number; label: string }[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      const isPM = h >= 12;
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const period = isPM ? "PM" : "AM";
      labels.push({ hour: h, label: `${displayHour}${period}` });
    }
    return labels;
  }, [minHour, maxHour]);

  const rowHeight = 48;
  const chartHeight = data.length * rowHeight;
  const chartPadding = { left: 100, right: 100, top: 30, bottom: 10 };
  const totalHeight = chartHeight + chartPadding.top + chartPadding.bottom;

  // Fixed chart width in pixels for consistent coordinate system
  const chartWidth = 800;
  const totalWidth = chartWidth + chartPadding.left + chartPadding.right;
  const chartAreaWidth = chartWidth;

  // Color mapping
  const getProjectColor = (color: string): string => {
    const colorMap: Record<string, string> = {
      gray: "#6b7280",
      red: "#ef4444",
      orange: "#f97316",
      yellow: "#eab308",
      green: "#22c55e",
      blue: "#3b82f6",
      purple: "#a855f7",
      pink: "#ec4899",
    };
    return colorMap[color] || colorMap.gray;
  };

  const hasData = data.some((day) => day.sessions.length > 0);

  if (!hasData) {
    return (
      <div className='flex items-center justify-center py-8 text-sm text-muted-foreground'>
        No focus sessions in the last 7 days
      </div>
    );
  }

  return (
    <div className='w-full overflow-x-auto'>
      <svg
        width='100%'
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className='text-xs'
        style={{ minWidth: "600px" }}
        preserveAspectRatio='xMinYMin meet'
      >
        <title>
          Focus timeline chart showing work sessions across hours of the day
        </title>
        {/* Hour grid lines and labels */}
        <g>
          {hourLabels.map(({ hour, label }) => {
            const x =
              chartPadding.left +
              ((hour - minHour) / hourRange) * chartAreaWidth;

            return (
              <g key={hour}>
                {/* Grid line */}
                <line
                  x1={x}
                  y1={chartPadding.top}
                  x2={x}
                  y2={chartPadding.top + chartHeight}
                  stroke='currentColor'
                  strokeWidth='1'
                  className='text-border'
                  opacity='0.3'
                />
                {/* Hour label */}
                <text
                  x={x}
                  y={chartPadding.top - 10}
                  textAnchor='middle'
                  className='fill-muted-foreground'
                  fontSize='12'
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>

        {/* Day rows */}
        {data.map((day, dayIndex) => {
          const y = chartPadding.top + dayIndex * rowHeight;
          const hasSessionsForDay = day.sessions.length > 0;

          return (
            <g key={day.dayLabel}>
              {/* Day label */}
              <text
                x={chartPadding.left - 10}
                y={y + rowHeight / 2}
                textAnchor='end'
                dominantBaseline='middle'
                className={
                  hasSessionsForDay
                    ? "fill-text-primary font-medium"
                    : "fill-muted-foreground"
                }
                fontSize='12'
              >
                {day.dayLabel}
              </text>

              {/* Row background */}
              <rect
                x={chartPadding.left}
                y={y}
                width={chartAreaWidth}
                height={rowHeight}
                fill='transparent'
              />

              {/* Session bars */}
              {day.sessions.map((session, sessionIndex) => {
                const startX =
                  chartPadding.left +
                  ((session.startHour - minHour) / hourRange) * chartAreaWidth;
                const durationHours = session.endHour - session.startHour;
                const barWidth = (durationHours / hourRange) * chartAreaWidth;

                const barY = y + rowHeight / 2 - 8;
                const barHeight = 16;

                return (
                  <g key={`${session.taskId}-${sessionIndex}`}>
                    <rect
                      x={startX}
                      y={barY}
                      width={Math.max(2, barWidth)}
                      height={barHeight}
                      rx='3'
                      fill={getProjectColor(session.projectColor)}
                      opacity='0.8'
                      className='hover:opacity-100 transition-opacity cursor-pointer'
                    >
                      <title>
                        {session.taskTitle}
                        {"\n"}
                        {formatDuration(session.duration)}
                        {"\n"}
                        {Math.floor(session.startHour)}:
                        {String(
                          Math.round((session.startHour % 1) * 60)
                        ).padStart(2, "0")}{" "}
                        - {Math.floor(session.endHour)}:
                        {String(
                          Math.round((session.endHour % 1) * 60)
                        ).padStart(2, "0")}
                      </title>
                    </rect>
                  </g>
                );
              })}

              {/* Daily total on the right */}
              {hasSessionsForDay && (
                <text
                  x={totalWidth - chartPadding.right + 20}
                  y={y + rowHeight / 2}
                  textAnchor='end'
                  dominantBaseline='middle'
                  className='fill-orange-400 font-mono'
                  fontSize='12'
                >
                  {formatDuration(day.totalDuration)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

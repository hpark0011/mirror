"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  calculateTotalDuration,
  getTasksCompletedOnDate,
  getTicketDurationForDate,
  getTimeEntriesForDate,
  getTimelineData,
  groupByProject,
} from "@/lib/insights-utils";
import { formatDuration } from "@/lib/timer-utils";
import { cn } from "@/lib/utils";
import type { Project, Ticket } from "@/types/board.types";
import { FocusTimelineChart } from "./focus-timeline-chart";

interface InsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tickets: Ticket[];
  projects: Project[];
}

export function InsightsDialog({
  open,
  onOpenChange,
  tickets,
  projects,
}: InsightsDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Filter tasks completed on selected date
  const completedTasks = useMemo(
    () => getTasksCompletedOnDate(tickets, selectedDate),
    [tickets, selectedDate]
  );

  // Calculate total duration for selected date only
  const totalDuration = useMemo(
    () => calculateTotalDuration(completedTasks, selectedDate),
    [completedTasks, selectedDate]
  );

  // Group by project with date-filtered durations
  const projectBreakdown = useMemo(
    () => groupByProject(completedTasks, projects, selectedDate),
    [completedTasks, projects, selectedDate]
  );

  // Get 7-day timeline data for visualization
  const timelineData = useMemo(
    () => getTimelineData(tickets, projects, selectedDate, 7),
    [tickets, projects, selectedDate]
  );

  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-xl pb-4 h-[calc(100vh-64px)] translate-y-[-50%]'>
        <DialogHeader className='relative pr-12 py-3 flex items-center w-full flex-row'>
          <DialogTitle className='text-sm'>Insights</DialogTitle>
          <DialogDescription className='sr-only'>
            View your focus time and completed tasks
          </DialogDescription>
          <DialogClose asChild>
            <Button
              variant='icon'
              size='sm'
              className='absolute right-2 top-2 h-6 w-6 p-0 [&_svg]:text-icon-light'
            >
              <Icon name='XmarkIcon' className='size-3.5' />
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogBody className='px-0'>
          {/* Stats Section */}
          <div className='space-y-4'>
            <div className='flex items-center justify-between gap-2 pl-4 pr-2'>
              <h3 className='text-sm font-medium text-muted-foreground'>
                {isToday ? "Today" : formattedDate}
              </h3>
              <div className='flex items-center gap-2'>
                {completedTasks.length > 0 && (
                  <span className='text-xs text-muted-foreground'>
                    {completedTasks.length}{" "}
                    {completedTasks.length === 1 ? "task" : "tasks"} completed
                  </span>
                )}
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='gap-2 rounded-md border-border-highlight'
                    >
                      <Icon name='CalendarFillIcon' className='size-4' />
                      <span className='text-xs font-medium'>
                        {isToday ? "Today" : formattedDate}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align='end' className='w-auto p-0'>
                    <Calendar
                      mode='single'
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (!date) return;
                        setSelectedDate(date);
                        setDatePickerOpen(false);
                      }}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {completedTasks.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-8 text-center'>
                <Icon
                  name='CalendarFillIcon'
                  className='size-12 text-muted-foreground/50 mb-3'
                />
                <p className='text-sm text-muted-foreground'>
                  No tasks completed on this day
                </p>
              </div>
            ) : (
              <>
                {/* Total Duration Card */}
                <div className='p-0 mb-8 px-4'>
                  <div className='flex items-center gap-3'>
                    <div className='flex flex-col gap-1'>
                      <p className='text-xs text-muted-foreground'>
                        Total Focus Time
                      </p>
                      <p className='text-2xl font-semibold text-text-primary'>
                        {formatDuration(totalDuration)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* <div className='border-b border-border mb-6' /> */}

                {/* Timeline Chart */}
                {/* <div className='mb-8 px-4'>
                  <h4 className='text-xs font-medium text-muted-foreground mb-4'>
                    7-Day Focus Timeline
                  </h4>
                  <FocusTimelineChart data={timelineData} />
                </div> */}

                <div className='border-b border-border mb-6' />
                {/* Project Breakdown */}
                {projectBreakdown.length > 0 && (
                  <div className='space-y-2 mb-8 px-4'>
                    <h4 className='text-xs font-medium text-muted-foreground mb-3'>
                      By Project
                    </h4>
                    <div className='space-y-2'>
                      {projectBreakdown.map((project) => (
                        <div
                          key={project.projectId || "unassigned"}
                          className='flex items-center justify-between px-0.5 text-sm'
                        >
                          <div className='flex items-center gap-1.5'>
                            <div className='flex items-center gap-1.5'>
                              <div
                                className={cn(
                                  "size-1.5 rounded-full",
                                  `bg-${project.projectColor}-500`
                                )}
                                style={{
                                  backgroundColor: getProjectColor(
                                    project.projectColor
                                  ),
                                }}
                              />
                              <span className='font-medium text-xs text-muted-foreground'>
                                {project.projectName}
                              </span>
                            </div>
                            <span className='text-xs'>
                              ({project.taskCount}{" "}
                              {project.taskCount === 1 ? "task" : "tasks"})
                            </span>
                          </div>
                          <span className='font-mono text-xs text-orange-400'>
                            {formatDuration(project.duration)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className='border-b border-border mb-6' />
                {/* Task List */}
                <div className='space-y-2 px-4'>
                  <h4 className='text-xs font-medium text-muted-foreground mb-3'>
                    Completed Tasks
                  </h4>
                  <div className='max-h-64 space-y-1.5 2overflow-y-auto'>
                    {completedTasks.map((task) => {
                      const project = task.projectId
                        ? projects.find((p) => p.id === task.projectId)
                        : null;

                      const timeEntries = getTimeEntriesForDate(
                        task,
                        selectedDate
                      );
                      const dailyDuration = getTicketDurationForDate(
                        task,
                        selectedDate
                      );

                      return (
                        <div key={task.id} className='px-0.5 text-sm space-y-2'>
                          <div className='flex items-center justify-between w-full'>
                            <div className='flex-1 space-y-1'>
                              <div className='flex items-center gap-2.5'>
                                {project && (
                                  <div className='flex items-center gap-1'>
                                    <div
                                      className='size-1.5 rounded-full'
                                      style={{
                                        backgroundColor: getProjectColor(
                                          project.color
                                        ),
                                      }}
                                    />
                                    <span className='text-xs text-muted-foreground'>
                                      {project.name}
                                    </span>
                                  </div>
                                )}
                                <span className='font-medium line-clamp-1'>
                                  {task.title}
                                </span>
                              </div>
                            </div>
                            <div>
                              {timeEntries.length > 0 ? (
                                <div className='space-y-1'>
                                  {timeEntries.map((entry) => {
                                    const start = new Date(entry.start);
                                    const end = new Date(entry.end);
                                    const startLabel = start.toLocaleTimeString(
                                      "en-US",
                                      {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      }
                                    );
                                    const endLabel = end.toLocaleTimeString(
                                      "en-US",
                                      {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      }
                                    );

                                    return (
                                      <div
                                        key={`${start.getTime()}-${end.getTime()}`}
                                        className='flex items-center gap-2 text-xs text-muted-foreground'
                                      >
                                        <span>
                                          {startLabel} - {endLabel}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className='ml-6 flex items-center gap-2 text-xs text-muted-foreground/60 italic'>
                                  <Icon
                                    name='InfoCircleIcon'
                                    className='size-3'
                                  />
                                  <span>No timer data recorded</span>
                                </div>
                              )}
                            </div>
                            <span className='font-mono text-xs text-orange-400 ml-3 shrink-0'>
                              {formatDuration(dailyDuration)}
                            </span>
                          </div>
                          {/* Time entries for this date */}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Maps project color names to actual color values
 * Falls back to CSS variable approach if Tailwind classes don't work
 */
function getProjectColor(color: string): string {
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
}

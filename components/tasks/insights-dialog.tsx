"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { formatDuration } from "@/lib/timer-utils";
import {
  getTasksCompletedOnDate,
  calculateTotalDuration,
  groupByProject,
} from "@/lib/insights-utils";
import type { Ticket, Project } from "@/types/board.types";
import { cn } from "@/lib/utils";

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

  // Filter tasks completed on selected date
  const completedTasks = useMemo(
    () => getTasksCompletedOnDate(tickets, selectedDate),
    [tickets, selectedDate]
  );

  // Calculate total duration
  const totalDuration = useMemo(
    () => calculateTotalDuration(completedTasks),
    [completedTasks]
  );

  // Group by project
  const projectBreakdown = useMemo(
    () => groupByProject(completedTasks, projects),
    [completedTasks, projects]
  );

  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isToday =
    selectedDate.toDateString() === new Date().toDateString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insights</DialogTitle>
          <DialogDescription>
            View your focus time and completed tasks
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-6">
          {/* Date Picker Section */}
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date > new Date()}
              className="rounded-md border"
            />
          </div>

          {/* Stats Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                {isToday ? "Today" : formattedDate}
              </h3>
              {completedTasks.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {completedTasks.length}{" "}
                  {completedTasks.length === 1 ? "task" : "tasks"} completed
                </span>
              )}
            </div>

            {completedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Icon
                  name="CalendarFillIcon"
                  className="size-12 text-muted-foreground/50 mb-3"
                />
                <p className="text-sm text-muted-foreground">
                  No tasks completed on this day
                </p>
              </div>
            ) : (
              <>
                {/* Total Duration Card */}
                <div className="rounded-lg border bg-accent/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Icon
                        name="ClockFillIcon"
                        className="size-5 text-primary"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Total Focus Time
                      </p>
                      <p className="text-2xl font-semibold">
                        {formatDuration(totalDuration)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Project Breakdown */}
                {projectBreakdown.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      By Project
                    </h4>
                    <div className="space-y-2">
                      {projectBreakdown.map((project) => (
                        <div
                          key={project.projectId || "unassigned"}
                          className="flex items-center justify-between rounded-md border p-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "size-2 rounded-full",
                                `bg-${project.projectColor}-500`
                              )}
                              style={{
                                backgroundColor: getProjectColor(
                                  project.projectColor
                                ),
                              }}
                            />
                            <span className="font-medium">
                              {project.projectName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({project.taskCount}{" "}
                              {project.taskCount === 1 ? "task" : "tasks"})
                            </span>
                          </div>
                          <span className="font-mono text-xs">
                            {formatDuration(project.duration)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Task List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Completed Tasks
                  </h4>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {completedTasks.map((task) => {
                      const project = task.projectId
                        ? projects.find((p) => p.id === task.projectId)
                        : null;

                      return (
                        <div
                          key={task.id}
                          className="flex items-start justify-between rounded-md border p-3 text-sm"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Icon
                                name="CheckCircleIcon"
                                className="size-4 text-green-500 shrink-0"
                              />
                              <span className="font-medium line-clamp-1">
                                {task.title}
                              </span>
                            </div>
                            {project && (
                              <div className="flex items-center gap-1.5 ml-6">
                                <div
                                  className="size-1.5 rounded-full"
                                  style={{
                                    backgroundColor: getProjectColor(
                                      project.color
                                    ),
                                  }}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {project.name}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="font-mono text-xs text-muted-foreground ml-2 shrink-0">
                            {formatDuration(task.duration || 0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            size="sm"
          >
            Close
          </Button>
        </DialogFooter>
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

"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useProjects } from "@/features/project-select";
import {
  BOARD_STORAGE_KEY,
  getInitialSerializedBoard,
  safelyDeserializeBoard,
} from "../../app/(protected)/dashboard/tasks/_utils";
import {
  calculateTotalDuration,
  getTasksCompletedOnDate,
  groupByProject,
} from "@feel-good/greyboard-core/insights";
import { InsightsDatePicker } from "./components/insights-date-picker";
import { InsightsEmptyState } from "./components/insights-empty-state";
import { InsightsTotalDuration } from "./components/insights-total-duration";
import { InsightsProjectBreakdown } from "./components/insights-project-breakdown";
import { InsightsTaskList } from "./components/insights-task-list";

interface InsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for viewing daily insights including focus time and completed tasks.
 */
export function InsightsDialog({ open, onOpenChange }: InsightsDialogProps) {
  const [rawBoard] = useLocalStorage<string>(
    BOARD_STORAGE_KEY,
    getInitialSerializedBoard()
  );
  const board = safelyDeserializeBoard(rawBoard);
  const tickets = Object.values(board).flat();
  const { projects } = useProjects();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const completedTasks = useMemo(
    () => getTasksCompletedOnDate(tickets, selectedDate),
    [tickets, selectedDate]
  );

  const totalDuration = useMemo(
    () => calculateTotalDuration(completedTasks, selectedDate),
    [completedTasks, selectedDate]
  );

  const projectBreakdown = useMemo(
    () => groupByProject(completedTasks, projects, selectedDate),
    [completedTasks, projects, selectedDate]
  );

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl pb-4 h-[calc(100vh-64px)] translate-y-[-50%]">
        <DialogHeader className="relative pr-12 py-3 flex items-center w-full flex-row">
          <DialogTitle className="text-sm">Insights</DialogTitle>
          <DialogDescription className="sr-only">
            View your focus time and completed tasks
          </DialogDescription>
          <DialogClose asChild>
            <Button
              variant="icon"
              size="sm"
              className="absolute right-2 top-2 h-6 w-6 p-0 [&_svg]:text-icon-light"
            >
              <Icon name="XmarkIcon" className="size-3.5" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogBody className="px-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 pl-4 pr-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {isToday ? "Today" : formattedDate}
              </h3>
              <div className="flex items-center gap-2">
                {completedTasks.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {completedTasks.length}{" "}
                    {completedTasks.length === 1 ? "task" : "tasks"} completed
                  </span>
                )}
                <InsightsDatePicker
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                />
              </div>
            </div>

            {completedTasks.length === 0 ? (
              <InsightsEmptyState />
            ) : (
              <>
                <InsightsTotalDuration totalDuration={totalDuration} />
                <div className="border-b border-border mb-6" />
                <InsightsProjectBreakdown projectBreakdown={projectBreakdown} />
                {projectBreakdown.length > 0 && (
                  <div className="border-b border-border mb-6" />
                )}
                <InsightsTaskList
                  completedTasks={completedTasks}
                  projects={projects}
                  selectedDate={selectedDate}
                />
              </>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { StopWatchState, useStopWatchStore } from "@/store/stop-watch-store";

interface TicketTimerButtonProps {
  ticketId: string;
  ticketTitle: string;
  timerState: StopWatchState;
}

/**
 * Play/pause timer button for in-progress tickets
 */
export function TicketTimerButton({
  ticketId,
  ticketTitle,
  timerState,
}: TicketTimerButtonProps) {
  const startTimer = useStopWatchStore((state) => state.startTimer);
  const pauseTimer = useStopWatchStore((state) => state.pauseTimer);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          className={cn(
            // Layout & Alignment
            "flex items-center justify-center",
            // Sizing
            "min-w-3.5 w-fit h-3.5",
            // Spacing
            "mr-[4px]",
            // Positioning
            "relative top-[1px] left-[-1px]",
            // Shape
            "rounded-[5px]",
            // Background
            "bg-neutral-50 dark:bg-neutral-900",
            // Shadow
            "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6),_0_0_0_2px_rgba(0,0,0,0.1)]",
            "dark:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6),_0_0_0_2px_rgba(255,255,255,0.1)]",
            // Interactive States
            "group-hover",
            // Conditional: Running state
            timerState === StopWatchState.Running && "pulse-shadow gap-0.5"
          )}
          onClick={() => {
            if (timerState === StopWatchState.Running) {
              pauseTimer();
              return;
            }

            startTimer(ticketId, ticketTitle);
          }}
        >
          <Icon
            name={
              timerState === StopWatchState.Running
                ? "PauseFillIcon"
                : "PlayFillIcon"
            }
            className={cn(
              // Sizing
              "size-3 min-w-3",
              // Typography
              "text-icon-extra-light dark:text-neutral-500"
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {timerState === StopWatchState.Running ? "Pause Timer" : "Start Timer"}
      </TooltipContent>
    </Tooltip>
  );
}

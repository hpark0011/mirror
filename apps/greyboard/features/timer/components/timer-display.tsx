import { Icon } from "@/components/ui/icon";
import { formatDuration } from "../utils/format-duration";
import { StopWatchState } from "../store/stop-watch-store";

interface TimerDisplayProps {
  activeTicketTitle: string | null;
  timerState: StopWatchState;
  activeElapsedSeconds: number;
}

/**
 * Displays the active timer in the header with elapsed time and ticket title.
 * Only renders when a timer is running or paused (parent handles visibility).
 */
export function TimerDisplay({
  activeTicketTitle,
  timerState,
  activeElapsedSeconds,
}: TimerDisplayProps) {
  return (
    <button
      type="button"
      className="bg-card shadow-xs border-border-highlight dark:border-white/2 border rounded-sm h-[24px] hover:bg-base transition-all duration-200 ease-out cursor-pointer scale-100 flex items-center translate-y-[0px] hover:translate-y-[-1px] hover:shadow-lg overflow-hidden text-[14px] px-1 pr-2 gap-1 max-w-full"
    >
      <Icon
        name={timerState === StopWatchState.Paused
          ? "PlayFillIcon"
          : "PauseFillIcon"}
        className="size-3.5 text-icon-light min-w-3.5"
      />
      <span className="text-[12px] font-mono text-orange-400 text-left pr-0.5 w-fit">
        {formatDuration(activeElapsedSeconds)}
      </span>
      <div className="w-px self-stretch mx-1 bg-border-light dark:bg-border-light" />
      <span
        className="max-w-[220px] truncate text-left"
        title={activeTicketTitle ?? undefined}
      >
        {activeTicketTitle || "Stop watch running"}
      </span>
    </button>
  );
}

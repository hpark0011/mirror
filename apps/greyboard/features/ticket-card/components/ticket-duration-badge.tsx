import { formatDuration } from "@/features/timer";

interface TicketDurationBadgeProps {
  status: string;
  duration?: number;
}

/**
 * Displays the duration badge for completed tickets.
 * Only renders when the ticket is complete and has a valid duration > 0.
 */
export function TicketDurationBadge({
  status,
  duration,
}: TicketDurationBadgeProps) {
  if (status !== "complete" || !duration || duration <= 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center mr-1.5 relative bottom-px text-[11px] text-orange-300">
      <span className="font-mono">{formatDuration(duration)}</span>
    </span>
  );
}

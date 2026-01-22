import { useStopWatchStore } from "../store/stop-watch-store";

/**
 * Returns real-time elapsed seconds for a timer.
 * Handles subscription to store updates automatically.
 *
 * @param ticketId - The ticket ID to get elapsed time for
 * @returns Elapsed seconds, updating every second while timer runs
 *
 * @example
 * const elapsed = useTimerElapsedTime("ticket-123");
 * return <span>{formatDuration(elapsed)}</span>;
 */
export function useTimerElapsedTime(ticketId: string | null): number {
  // Subscribe to tick counter to trigger re-renders every second
  useStopWatchStore((state) => state._renderTick);
  const getElapsedTime = useStopWatchStore((state) => state.getElapsedTime);

  if (!ticketId) return 0;
  return getElapsedTime(ticketId);
}

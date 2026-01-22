import { useStopWatchStore } from "../store/stop-watch-store";

/**
 * Synchronizes timer title when a ticket's title changes.
 *
 * Only updates the timer if there's an active timer for this ticket
 * and the title actually changed.
 *
 * @param ticketId - ID of the ticket being updated
 * @param oldTitle - Previous title of the ticket
 * @param newTitle - New title of the ticket
 *
 * @example
 * syncTimerOnTicketUpdate("ticket-123", "Old title", "New title");
 */
export function syncTimerOnTicketUpdate(
  ticketId: string,
  oldTitle: string,
  newTitle: string
): void {
  if (oldTitle === newTitle) return;

  const stopWatchStore = useStopWatchStore.getState();
  if (stopWatchStore.activeTicketId === ticketId) {
    stopWatchStore.updateActiveTicketTitle(ticketId, newTitle);
  }
}

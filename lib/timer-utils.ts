import type { BoardState, ColumnId } from "@/types/board.types";
import type { StopWatchStore } from "@/store/stop-watch-store";

/**
 * Formats duration in seconds to a readable time string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "12:34" for 12 min 34 sec or "1:23:45" for 1 hour 23 min 45 sec)
 *
 * @example
 * formatDuration(0) // "0:00"
 * formatDuration(65) // "1:05"
 * formatDuration(3661) // "1:01:01"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Records the final duration to a ticket in the board state
 *
 * Uses functional state update to avoid race conditions with concurrent board updates.
 *
 * @param ticketId - ID of the ticket to update
 * @param duration - Duration in seconds to record
 * @param setBoard - Board state setter function (functional update)
 */
export function recordDuration(
  ticketId: string,
  duration: number,
  setBoard: (updater: (board: BoardState) => BoardState) => void
): void {
  setBoard((currentBoard) => {
    const updatedBoard = { ...currentBoard };

    // Find the ticket and update its duration
    for (const [columnId, tickets] of Object.entries(updatedBoard)) {
      const ticketIndex = tickets.findIndex((t) => t.id === ticketId);
      if (ticketIndex !== -1) {
        const updatedTickets = [...tickets];
        updatedTickets[ticketIndex] = {
          ...updatedTickets[ticketIndex],
          duration: (updatedTickets[ticketIndex].duration || 0) + duration,
          updatedAt: new Date(),
        };
        updatedBoard[columnId] = updatedTickets;
        return updatedBoard;
      }
    }

    // Ticket not found, return unchanged board
    return currentBoard;
  });
}

/**
 * Resets the timer and clears the duration for a ticket
 *
 * Uses functional state update to avoid race conditions with concurrent board updates.
 *
 * @param ticketId - ID of the ticket to reset
 * @param stopWatchStore - Zustand stopwatch store instance
 * @param setBoard - Board state setter function (functional update)
 */
export function resetTimerForTicket(
  ticketId: string,
  stopWatchStore: StopWatchStore,
  setBoard: (updater: (board: BoardState) => BoardState) => void
): void {
  // Reset timer in store
  stopWatchStore.resetTimer(ticketId);

  // Clear duration in board using functional update
  setBoard((currentBoard) => {
    const updatedBoard = { ...currentBoard };

    for (const [columnId, tickets] of Object.entries(updatedBoard)) {
      const ticketIndex = tickets.findIndex((t) => t.id === ticketId);
      if (ticketIndex !== -1) {
        const updatedTickets = [...tickets];
        updatedTickets[ticketIndex] = {
          ...updatedTickets[ticketIndex],
          duration: 0,
          updatedAt: new Date(),
        };
        updatedBoard[columnId] = updatedTickets;
        return updatedBoard;
      }
    }

    // Ticket not found, return unchanged board
    return currentBoard;
  });
}

/**
 * Handles timer state changes triggered by ticket status transitions
 *
 * Uses functional state updates to avoid race conditions with concurrent board updates.
 *
 * Business rules:
 * - Moving to "complete" → record accumulated duration to ticket
 * - Moving to "backlog" or "to-do" → reset timer and clear duration
 * - Moving to "in-progress" → no automatic action (user must manually start timer)
 *
 * @param ticketId - ID of the ticket whose status changed
 * @param oldStatus - Previous status
 * @param newStatus - New status
 * @param stopWatchStore - Zustand stopwatch store instance
 * @param setBoard - Board state setter function (functional update)
 */
export function handleTimerOnStatusChange(
  ticketId: string,
  oldStatus: ColumnId,
  newStatus: ColumnId,
  stopWatchStore: StopWatchStore,
  setBoard: (updater: (board: BoardState) => BoardState) => void
): void {
  // No change, nothing to do
  if (oldStatus === newStatus) return;

  const isTimerActive = stopWatchStore.isTimerActive(ticketId);

  // Case 1: Moving to "complete" - record duration
  if (newStatus === "complete") {
    if (isTimerActive) {
      const elapsedTime = stopWatchStore.getElapsedTime(ticketId);
      if (elapsedTime > 0) {
        recordDuration(ticketId, elapsedTime, setBoard);
      }
      stopWatchStore.stopTimer();
    }
  }

  // Case 2: Moving to "backlog" or "to-do" - reset timer
  else if (newStatus === "backlog" || newStatus === "to-do") {
    if (isTimerActive) {
      resetTimerForTicket(ticketId, stopWatchStore, setBoard);
    }
  }

  // Case 3: Moving away from "in-progress" (but not to complete/backlog/to-do)
  // This case is handled above, but included for clarity
  else if (oldStatus === "in-progress" && isTimerActive) {
    // Auto-stop timer when leaving in-progress
    stopWatchStore.stopTimer();
  }
}

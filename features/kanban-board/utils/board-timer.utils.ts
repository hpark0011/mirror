import type { BoardState, Ticket, ColumnId } from "@/types/board.types";
import type { StopWatchStore } from "@/store/stop-watch-store";
import { useStopWatchStore } from "@/store/stop-watch-store";

export type BoardUpdater = (updater: (board: BoardState) => BoardState) => void;

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

function updateTicketInBoard(
  board: BoardState,
  ticketId: string,
  updateFn: (ticket: Ticket) => Ticket
): BoardState {
  for (const [columnId, tickets] of Object.entries(board)) {
    const ticketIndex = tickets.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      const updatedTickets = [...tickets];
      updatedTickets[ticketIndex] = updateFn(updatedTickets[ticketIndex]);
      return { ...board, [columnId]: updatedTickets };
    }
  }
  return board;
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
  setBoard: BoardUpdater
): void {
  setBoard((currentBoard) => {
    const now = new Date();

    if (duration <= 0) {
      return updateTicketInBoard(currentBoard, ticketId, (ticket) => ({
        ...ticket,
        completedAt: now,
        updatedAt: now,
      }));
    }

    const normalizedDuration = Math.max(0, Math.round(duration));
    const sessionStart = new Date(now.getTime() - normalizedDuration * 1000);

    return updateTicketInBoard(currentBoard, ticketId, (ticket) => ({
      ...ticket,
      duration: (ticket.duration || 0) + normalizedDuration,
      timeEntries: [
        ...(ticket.timeEntries ?? []),
        { start: sessionStart, end: now, duration: normalizedDuration },
      ],
      completedAt: now,
      updatedAt: now,
    }));
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
  setBoard: BoardUpdater
): void {
  stopWatchStore.resetTimer(ticketId);

  setBoard((currentBoard) =>
    updateTicketInBoard(currentBoard, ticketId, (ticket) => ({
      ...ticket,
      duration: 0,
      timeEntries: [],
      completedAt: null,
      updatedAt: new Date(),
    }))
  );
}

/**
 * Handles timer state changes triggered by ticket status transitions.
 *
 * Business rules:
 * - Moving to "complete": record accumulated duration to ticket
 * - Moving to "backlog" or "to-do": reset timer and clear duration
 * - Moving from "in-progress": stop timer (user must manually restart)
 */
export function handleTimerOnStatusChange(
  ticketId: string,
  oldStatus: ColumnId,
  newStatus: ColumnId,
  stopWatchStore: StopWatchStore,
  setBoard: BoardUpdater
): void {
  if (oldStatus === newStatus) return;

  const isTimerActive = stopWatchStore.isTimerActive(ticketId);
  if (!isTimerActive) return;

  if (newStatus === "complete") {
    const elapsedTime = stopWatchStore.getElapsedTime(ticketId);
    if (elapsedTime > 0) {
      recordDuration(ticketId, elapsedTime, setBoard);
    }
    stopWatchStore.stopTimer();
  } else if (newStatus === "backlog" || newStatus === "to-do") {
    resetTimerForTicket(ticketId, stopWatchStore, setBoard);
  } else if (oldStatus === "in-progress") {
    stopWatchStore.stopTimer();
  }
}

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

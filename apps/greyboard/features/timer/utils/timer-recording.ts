import type { BoardState, Ticket } from "@/types/board.types";
import type { StopWatchStore } from "../store/stop-watch-store";

export type BoardUpdater = (updater: (board: BoardState) => BoardState) => void;

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

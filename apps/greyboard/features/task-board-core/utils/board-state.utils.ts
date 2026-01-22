import type { BoardState, ColumnId, Ticket } from "@/types/board.types";

/**
 * Updates board state with a ticket, handling column movement.
 *
 * If the ticket stays in the same column, updates it in place.
 * If the ticket moves to a different column, removes it from the old
 * column and adds it to the new column.
 *
 * @param board - Current board state
 * @param ticket - Ticket to add or update
 * @param oldColumn - Column ID where the ticket currently exists (null for new tickets)
 * @param newColumn - Column ID where the ticket should be placed
 * @returns Updated board state
 *
 * @example
 * // Update ticket in same column
 * const updated = updateBoardWithTicket(board, ticket, "to-do", "to-do");
 *
 * // Move ticket between columns
 * const moved = updateBoardWithTicket(board, ticket, "to-do", "in-progress");
 */
export function updateBoardWithTicket(
  board: BoardState,
  ticket: Ticket,
  oldColumn: ColumnId | null,
  newColumn: ColumnId
): BoardState {
  // New ticket: just add to the target column
  if (oldColumn === null) {
    return {
      ...board,
      [newColumn]: [...(board[newColumn] || []), ticket],
    };
  }

  // Same column: update ticket in place
  if (oldColumn === newColumn) {
    return {
      ...board,
      [oldColumn]: board[oldColumn].map((t) =>
        t.id === ticket.id ? ticket : t
      ),
    };
  }

  // Different column: remove from old, add to new
  return {
    ...board,
    [oldColumn]: board[oldColumn].filter((t) => t.id !== ticket.id),
    [newColumn]: [...(board[newColumn] || []), ticket],
  };
}

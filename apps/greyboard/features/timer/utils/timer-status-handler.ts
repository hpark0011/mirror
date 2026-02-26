import type { ColumnId } from "@feel-good/greyboard-core/types";
import type { StopWatchStore } from "../store/stop-watch-store";
import { recordDuration, resetTimerForTicket, type BoardUpdater } from "./timer-recording";

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
    stopWatchStore.stopTimer(ticketId);
  } else if (newStatus === "backlog" || newStatus === "to-do") {
    resetTimerForTicket(ticketId, stopWatchStore, setBoard);
  } else if (oldStatus === "in-progress") {
    stopWatchStore.stopTimer(ticketId);
  }
}

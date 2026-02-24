"use client";

import { useCallback, useMemo, useRef } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  useProjectFilter,
  useLastSelectedProject,
} from "@/app/(protected)/dashboard/tasks/_hooks";
import { useStopWatchStore, handleTimerOnStatusChange } from "@/features/timer";
import { INITIAL_BOARD_STATE } from "@/config/board.config";
import type { BoardState, ColumnId, SubTask, Ticket } from "@/types/board.types";
import {
  BOARD_STORAGE_KEY,
  serializeBoardData,
  getInitialSerializedBoard,
  safelyDeserializeBoard,
} from "../utils/board-storage.utils";
import {
  downloadSnapshotFile,
  exportBoardSnapshot,
  importBoardSnapshot,
} from "../utils/board-io.utils";

export interface UseBoardStateReturn {
  board: BoardState;
  filteredBoard: BoardState;
  actions: {
    setBoard: (newBoard: BoardState | ((prev: BoardState) => BoardState)) => void;
    deleteTicket: (ticketId: string) => void;
    updateSubTasks: (ticketId: string, subTasks: SubTask[]) => void;
    clearBoard: () => void;
    clearColumn: (columnId: ColumnId) => void;
    handleStatusChange: (ticketId: string, oldStatus: ColumnId, newStatus: ColumnId) => void;
    setLastSelectedProjectId: (projectId: string | undefined) => void;
  };
  findColumn: (id: string, sourceBoard?: BoardState) => string | null;
  findTicket: (id: string) => Ticket | null;
  lastSelectedProjectId: string | undefined;
  imperativeActions: {
    exportBoard: () => void;
    importBoard: (jsonContent: string) => void;
    clearBoard: () => void;
  };
}

/**
 * Manages the Kanban board state including persistence, CRUD operations,
 * and timer integration.
 *
 * @example
 * const { board, filteredBoard, actions, findColumn } = useBoardState();
 * actions.deleteTicket("ticket-123");
 */
export function useBoardState(): UseBoardStateReturn {
  const [rawBoard, setRawBoard] = useLocalStorage<string>(
    BOARD_STORAGE_KEY,
    getInitialSerializedBoard()
  );

  const board = safelyDeserializeBoard(rawBoard);

  const setBoard = useCallback(
    (newBoard: BoardState | ((prev: BoardState) => BoardState)) => {
      setRawBoard((previousRaw) => {
        const previousBoard = safelyDeserializeBoard(previousRaw);
        const updatedBoard =
          typeof newBoard === "function" ? newBoard(previousBoard) : newBoard;
        return serializeBoardData(updatedBoard);
      });
    },
    [setRawBoard]
  );

  const { selectedProjectIds } = useProjectFilter();
  const { lastSelectedProjectId, setLastSelectedProjectId } =
    useLastSelectedProject();

  const filteredBoard = useMemo(() => {
    if (selectedProjectIds.length === 0) {
      return board;
    }

    const filtered: BoardState = {};
    for (const [columnId, tickets] of Object.entries(board)) {
      filtered[columnId] = tickets.filter((ticket) => {
        return ticket.projectId
          ? selectedProjectIds.includes(ticket.projectId)
          : false;
      });
    }
    return filtered;
  }, [board, selectedProjectIds]);

  // Refs allow callbacks to access current board state without being recreated on every
  // board change. This prevents infinite re-renders in dnd-kit's drag handlers.
  const boardRef = useRef(board);
  boardRef.current = board;

  // Build O(1) lookup indexes for drag operations. Single pass builds both indexes.
  const { ticketColumnIndex, ticketIndex } = useMemo(() => {
    const columnIndex = new Map<string, string>();
    const ticketMap = new Map<string, Ticket>();

    for (const [columnId, tickets] of Object.entries(board)) {
      for (const ticket of tickets) {
        columnIndex.set(ticket.id, columnId);
        ticketMap.set(ticket.id, ticket);
      }
    }

    return { ticketColumnIndex: columnIndex, ticketIndex: ticketMap };
  }, [board]);

  // Refs for stable callback references
  const ticketColumnIndexRef = useRef(ticketColumnIndex);
  const ticketIndexRef = useRef(ticketIndex);
  ticketColumnIndexRef.current = ticketColumnIndex;
  ticketIndexRef.current = ticketIndex;

  const findColumn = useCallback(
    (id: string, sourceBoard?: BoardState): string | null => {
      // O(1) lookup via index for external callers (drag handlers)
      // O(n) search when sourceBoard provided (inside setBoard updaters for fresh state)
      if (!sourceBoard) {
        return ticketColumnIndexRef.current.get(id) ?? null;
      }

      for (const [columnId, tickets] of Object.entries(sourceBoard)) {
        if (tickets.some((t) => t.id === id)) {
          return columnId;
        }
      }
      return null;
    },
    []
  );

  const findTicket = useCallback(
    (id: string): Ticket | null => {
      return ticketIndexRef.current.get(id) ?? null;
    },
    []
  );

  const deleteTicket = useCallback(
    (ticketId: string) => {
      // Stop timer if this ticket has an active timer
      const stopWatchStore = useStopWatchStore.getState();
      if (stopWatchStore.isTimerActive(ticketId)) {
        stopWatchStore.stopTimer(ticketId);
      }

      // Column lookup inside updater ensures we use fresh board state
      setBoard((currentBoard) => {
        const column = findColumn(ticketId, currentBoard);
        if (!column) return currentBoard;

        return {
          ...currentBoard,
          [column]: currentBoard[column].filter((t) => t.id !== ticketId),
        };
      });
    },
    [findColumn, setBoard]
  );

  const updateSubTasks = useCallback(
    (ticketId: string, subTasks: SubTask[]) => {
      setBoard((currentBoard) => {
        const columnId = findColumn(ticketId, currentBoard);
        if (!columnId) {
          return currentBoard;
        }

        const columnTickets = currentBoard[columnId];
        if (!columnTickets) {
          return currentBoard;
        }

        let hasChanges = false;
        const nextTickets = columnTickets.map((ticket) => {
          if (ticket.id !== ticketId) {
            return ticket;
          }

          const currentSerialized = JSON.stringify(ticket.subTasks ?? []);
          const nextSerialized = JSON.stringify(subTasks ?? []);

          if (currentSerialized === nextSerialized) {
            return ticket;
          }

          hasChanges = true;
          return {
            ...ticket,
            subTasks,
            updatedAt: new Date(),
          };
        });

        if (!hasChanges) {
          return currentBoard;
        }

        return {
          ...currentBoard,
          [columnId]: nextTickets,
        };
      });
    },
    [findColumn, setBoard]
  );

  const clearBoard = useCallback(() => {
    // Stop any active timers before clearing board
    useStopWatchStore.getState().stopAllTimers();

    setBoard(INITIAL_BOARD_STATE);
  }, [setBoard]);

  const clearColumn = useCallback(
    (columnId: ColumnId) => {
      // Stop timer if any ticket in this column has an active timer
      // Uses boardRef to avoid recreating callback on board changes
      const stopWatchStore = useStopWatchStore.getState();
      const ticketsInColumn = boardRef.current[columnId] || [];
      for (const ticket of ticketsInColumn) {
        if (stopWatchStore.isTimerActive(ticket.id)) {
          stopWatchStore.stopTimer(ticket.id);
        }
      }

      setBoard((currentBoard) => ({
        ...currentBoard,
        [columnId]: [],
      }));
    },
    [setBoard]
  );

  const handleStatusChange = useCallback(
    (ticketId: string, oldStatus: ColumnId, newStatus: ColumnId) => {
      handleTimerOnStatusChange(
        ticketId,
        oldStatus,
        newStatus,
        useStopWatchStore.getState(),
        setBoard
      );
    },
    [setBoard]
  );

  const exportBoard = useCallback(() => {
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `task-board-${timestamp}.json`;
    downloadSnapshotFile(exportBoardSnapshot(board), filename);
  }, [board]);

  const importBoard = useCallback(
    (jsonContent: string) => {
      const importedBoard = importBoardSnapshot(jsonContent);
      setBoard(importedBoard);
    },
    [setBoard]
  );

  // Memoize to prevent unnecessary store registrations
  const imperativeActions = useMemo(
    () => ({
      exportBoard,
      importBoard,
      clearBoard,
    }),
    [exportBoard, importBoard, clearBoard]
  );

  return {
    board,
    filteredBoard,
    actions: {
      setBoard,
      deleteTicket,
      updateSubTasks,
      clearBoard,
      clearColumn,
      handleStatusChange,
      setLastSelectedProjectId,
    },
    findColumn,
    findTicket,
    lastSelectedProjectId,
    imperativeActions,
  };
}

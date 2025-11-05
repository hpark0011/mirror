"use client";

import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type React from "react";
import {
  Fragment,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { COLUMNS, INITIAL_BOARD_STATE } from "@/config/board.config";
import { useLastSelectedProject } from "@/hooks/use-last-selected-project";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useProjectFilter } from "@/hooks/use-project-filter";
import {
  deserializeBoardData,
  downloadJsonFile,
  exportBoardAsJson,
  importBoardFromJson,
  serializeBoardData,
} from "@/lib/storage";
import { getStorageKey } from "@/lib/storage-keys";
import { handleTimerOnStatusChange } from "@/lib/timer-utils";
import { useStopWatchStore } from "@/store/stop-watch-store";
import type {
  BoardState,
  ColumnId,
  SubTask,
  Ticket,
} from "../../types/board.types";
import { BodyContainer } from "../layout/layout-ui";
import { BoardColumn } from "./board-column";
import { TicketCard } from "./ticket-card";
import { TicketFormDialog } from "./ticket-form-dialog";

const STORAGE_KEY = getStorageKey("TASKS", "BOARD_STATE");

const safelyDeserializeBoard = (raw: string): BoardState => {
  try {
    return deserializeBoardData(raw);
  } catch {
    return INITIAL_BOARD_STATE;
  }
};

export type BoardHandle = {
  importFromInput: (event: React.ChangeEvent<HTMLInputElement>) => void;
  exportBoard: () => void;
  clearBoard: () => void;
};

export const Board = forwardRef<BoardHandle>(function Board(_props, ref) {
  const [rawBoard, setRawBoard] = useLocalStorage<string>(
    STORAGE_KEY,
    serializeBoardData(INITIAL_BOARD_STATE)
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragSourceColumnRef = useRef<ColumnId | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [formColumnId, setFormColumnId] = useState<ColumnId>("backlog");

  // Project filter
  const { selectedProjectIds } = useProjectFilter();

  // Last selected project for default value
  const { lastSelectedProjectId, setLastSelectedProjectId } =
    useLastSelectedProject();

  // Filter board based on selected projects
  const filteredBoard = useMemo(() => {
    // If no filters are active, return the full board
    if (selectedProjectIds.length === 0) {
      return board;
    }

    // Filter each column's tickets
    const filtered: BoardState = {};
    for (const [columnId, tickets] of Object.entries(board)) {
      filtered[columnId] = tickets.filter((ticket) => {
        // Show tickets that match any of the selected projects
        // Also show tickets without a project if any filters are active
        return ticket.projectId
          ? selectedProjectIds.includes(ticket.projectId)
          : false;
      });
    }
    return filtered;
  }, [board, selectedProjectIds]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const findColumn = (
    id: string,
    sourceBoard: BoardState = board
  ): string | null => {
    for (const [columnId, tickets] of Object.entries(sourceBoard)) {
      if (tickets.some((t) => t.id === id)) {
        return columnId;
      }
    }
    return null;
  };

  const findTicket = (id: string): Ticket | null => {
    for (const tickets of Object.values(board)) {
      const ticket = tickets.find((t) => t.id === id);
      if (ticket) return ticket;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const ticketId = event.active.id as string;
    const sourceColumn = findColumn(ticketId);
    if (!sourceColumn) {
      // Reset drag state if we can't find the source column
      setActiveId(null);
      dragSourceColumnRef.current = null;
      return;
    }
    setActiveId(ticketId);
    dragSourceColumnRef.current = sourceColumn as ColumnId;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const activeColumn = findColumn(active.id as string);
    // Check if we're over a column directly or over a ticket in a column
    let overColumn: string | null;
    if (board[over.id as string]) {
      // Dragged over a column directly
      overColumn = over.id as string;
    } else {
      // Dragged over a ticket - find its column
      overColumn = findColumn(over.id as string);
    }

    if (!activeColumn || !overColumn || activeColumn === overColumn) {
      return;
    }

    setBoard((board) => {
      const activeSource = board[activeColumn];
      const overSource = board[overColumn];

      if (!activeSource || !overSource) {
        return board;
      }

      const activeItems = [...activeSource];
      const overItems = [...overSource];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      const activeItem = activeItems[activeIndex];

      if (activeIndex === -1 || !activeItem) {
        return board;
      }

      activeItems.splice(activeIndex, 1);

      const updatedActiveItem = {
        ...activeItem,
        status: overColumn as ColumnId,
        updatedAt: new Date(),
      };

      // Calculate insertion position based on what we're hovering over
      const isOverColumn = !!board[over.id as string];
      const overIndex = isOverColumn
        ? overItems.length // Hovering over empty column space → append to end
        : overItems.findIndex((t) => t.id === over.id); // Hovering over a ticket → insert at that position

      if (overIndex >= 0) {
        overItems.splice(overIndex, 0, updatedActiveItem);
      } else {
        // Fallback: append to end if index not found (shouldn't happen in normal use)
        overItems.push(updatedActiveItem);
      }

      return {
        ...board,
        [activeColumn]: activeItems,
        [overColumn]: overItems,
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      dragSourceColumnRef.current = null;
      return;
    }

    const activeColumn = findColumn(active.id as string);
    // Check if we're over a column directly or over a ticket in a column
    let overColumn: string | null;
    if (board[over.id as string]) {
      // Dragged over a column directly
      overColumn = over.id as string;
    } else {
      // Dragged over a ticket - find its column
      overColumn = findColumn(over.id as string);
    }

    if (!activeColumn || !overColumn) {
      setActiveId(null);
      dragSourceColumnRef.current = null;
      return;
    }

    if (dragSourceColumnRef.current === overColumn) {
      setBoard((board) => {
        const items = [...board[activeColumn]];
        const activeIndex = items.findIndex((t) => t.id === active.id);
        const overIndex = items.findIndex((t) => t.id === over.id);

        if (activeIndex !== overIndex) {
          return {
            ...board,
            [activeColumn]: arrayMove(items, activeIndex, overIndex),
          };
        }
        return board;
      });
    } else {
      // Status changed via drag - handle timer logic
      const ticketId = active.id as string;
      const oldStatus = dragSourceColumnRef.current;
      const newStatus = overColumn as ColumnId;

      // Defensive: only call timer handler if we have a valid source column
      if (oldStatus) {
        handleTimerOnStatusChange(
          ticketId,
          oldStatus,
          newStatus,
          useStopWatchStore.getState(),
          setBoard
        );
      }
    }

    setActiveId(null);
    dragSourceColumnRef.current = null;
  };

  const handleAddTicket = (columnId: ColumnId) => {
    setFormColumnId(columnId);
    setEditingTicket(null);
    setIsFormOpen(true);
  };

  const handleEditTicket = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setFormColumnId(ticket.status);
    setIsFormOpen(true);
  };

  const handleDeleteTicket = (ticketId: string) => {
    const column = findColumn(ticketId);
    if (!column) return;

    // Stop timer if this ticket has an active timer
    const stopWatchStore = useStopWatchStore.getState();
    if (stopWatchStore.isTimerActive(ticketId)) {
      stopWatchStore.stopTimer();
    }

    setBoard((board) => ({
      ...board,
      [column]: board[column].filter((t) => t.id !== ticketId),
    }));
  };

  const handleUpdateSubTasks = (ticketId: string, subTasks: SubTask[]) => {
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
  };

  const handleFormSubmit = (data: {
    title: string;
    description: string;
    status: ColumnId;
    projectId?: string;
    subTasks?: SubTask[];
  }) => {
    // Save the selected project as the last selected (for both create and edit)
    setLastSelectedProjectId(data.projectId);

    if (editingTicket) {
      const oldColumn = findColumn(editingTicket.id);
      if (!oldColumn) return;

      const oldStatus = editingTicket.status;
      const newStatus = data.status;

      setBoard((board) => {
        const updatedTicket: Ticket = {
          ...editingTicket,
          title: data.title,
          description: data.description,
          status: data.status,
          projectId: data.projectId,
          subTasks: data.subTasks,
          updatedAt: new Date(),
        };

        if (oldColumn === data.status) {
          return {
            ...board,
            [oldColumn]: board[oldColumn].map((t) =>
              t.id === editingTicket.id ? updatedTicket : t
            ),
          };
        } else {
          return {
            ...board,
            [oldColumn]: board[oldColumn].filter(
              (t) => t.id !== editingTicket.id
            ),
            [data.status]: [...board[data.status], updatedTicket],
          };
        }
      });

      // Handle timer logic if status changed (uses functional setBoard to avoid race conditions)
      if (oldStatus !== newStatus) {
        handleTimerOnStatusChange(
          editingTicket.id,
          oldStatus,
          newStatus,
          useStopWatchStore.getState(),
          setBoard
        );
      }
    } else {
      const newTicket: Ticket = {
        id: `ticket-${Date.now()}`,
        title: data.title,
        description: data.description,
        status: data.status,
        projectId: data.projectId,
        subTasks: data.subTasks,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setBoard((board) => ({
        ...board,
        [data.status]: [...board[data.status], newTicket],
      }));
    }

    setIsFormOpen(false);
  };

  const handleClearBoard = useCallback(() => {
    // Stop any active timer before clearing board
    const stopWatchStore = useStopWatchStore.getState();
    if (stopWatchStore.activeTicketId) {
      stopWatchStore.stopTimer();
    }

    setBoard(INITIAL_BOARD_STATE);
  }, [setBoard]);

  const handleClearColumn = useCallback(
    (columnId: ColumnId) => {
      // Stop timer if any ticket in this column has an active timer
      const stopWatchStore = useStopWatchStore.getState();
      const ticketsInColumn = board[columnId] || [];
      for (const ticket of ticketsInColumn) {
        if (stopWatchStore.isTimerActive(ticket.id)) {
          stopWatchStore.stopTimer();
          break; // Only one timer can be active at a time
        }
      }

      setBoard((board) => ({
        ...board,
        [columnId]: [],
      }));
    },
    [setBoard, board]
  );

  const handleExportBoard = useCallback(() => {
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `task-board-${timestamp}.json`;
    const data = exportBoardAsJson(board);
    downloadJsonFile(data, filename);
  }, [board]);

  const handleImportBoard = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const importedBoard = importBoardFromJson(content);
          setBoard(importedBoard);
        } catch (error) {
          console.error("Failed to import board:", error);
          alert("Failed to import board. Please check the file format.");
        }
      };
      reader.readAsText(file);
    },
    [setBoard]
  );

  useImperativeHandle(
    ref,
    () => ({
      importFromInput: handleImportBoard,
      exportBoard: handleExportBoard,
      clearBoard: handleClearBoard,
    }),
    [handleImportBoard, handleExportBoard, handleClearBoard]
  );

  const activeTicket = activeId ? findTicket(activeId) : null;

  // Memoize defaultValues to prevent unnecessary re-renders
  // Note: Even if editingTicket reference changes, useTicketForm only resets when dialog opens
  const defaultValues = useMemo(() => {
    if (editingTicket) {
      return {
        title: editingTicket.title,
        description: editingTicket.description,
        status: editingTicket.status,
        projectId: editingTicket.projectId,
        subTasks: editingTicket.subTasks || [],
      };
    }
    return {
      title: "",
      description: "",
      status: formColumnId,
      projectId: lastSelectedProjectId,
      subTasks: [],
    };
  }, [editingTicket, formColumnId, lastSelectedProjectId]);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <BodyContainer>
          {COLUMNS.map((column) => (
            <Fragment key={column.id}>
              <BoardColumn
                key={column.id}
                column={column}
                tickets={filteredBoard[column.id] || []}
                onAddTicket={() => handleAddTicket(column.id)}
                onEditTicket={handleEditTicket}
                onDeleteTicket={handleDeleteTicket}
                onClearColumn={
                  column.id === "complete"
                    ? () => handleClearColumn("complete")
                    : undefined
                }
                onUpdateSubTasks={handleUpdateSubTasks}
              />
              <div className='w-[1px] min-w-[1px] bg-neutral-200 dark:bg-neutral-900 last:hidden' />
            </Fragment>
          ))}
        </BodyContainer>
        <DragOverlay>
          {activeTicket ? (
            <TicketCard ticket={activeTicket} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TicketFormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          // Clear editingTicket only after dialog is closed
          if (!open) {
            setEditingTicket(null);
          }
        }}
        onSubmit={handleFormSubmit}
        defaultValues={defaultValues}
        mode={editingTicket ? "edit" : "create"}
      />
    </>
  );
});

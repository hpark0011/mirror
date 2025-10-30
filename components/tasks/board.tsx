"use client";

import {
  Fragment,
  forwardRef,
  useImperativeHandle,
  useState,
  useMemo,
} from "react";
import type React from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { BoardColumn } from "./board-column";
import { TicketCard } from "./ticket-card";
import { Ticket, BoardState, ColumnId, SubTask } from "../../types/board.types";
import { TicketFormDialog } from "./ticket-form-dialog";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  serializeBoardData,
  deserializeBoardData,
  exportBoardAsJson,
  importBoardFromJson,
  downloadJsonFile,
} from "@/lib/storage";
import { COLUMNS, INITIAL_BOARD_STATE } from "@/config/board.config";
import { BodyContainer } from "../layout/layout-ui";
import { getStorageKey } from "@/lib/storage-keys";
import { useProjectFilter } from "@/hooks/use-project-filter";
import { useLastSelectedProject } from "@/hooks/use-last-selected-project";

const STORAGE_KEY = getStorageKey("TASKS", "BOARD_STATE");

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

  const board = (() => {
    try {
      return deserializeBoardData(rawBoard);
    } catch {
      return INITIAL_BOARD_STATE;
    }
  })();

  const setBoard = (
    newBoard: BoardState | ((prev: BoardState) => BoardState)
  ) => {
    const updatedBoard =
      typeof newBoard === "function" ? newBoard(board) : newBoard;
    setRawBoard(serializeBoardData(updatedBoard));
  };
  const [activeId, setActiveId] = useState<string | null>(null);
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

  const findColumn = (id: string): string | null => {
    for (const [columnId, tickets] of Object.entries(board)) {
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
    setActiveId(event.active.id as string);
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
      const activeItems = [...board[activeColumn]];
      const overItems = [...board[overColumn]!];
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

      overItems.push(updatedActiveItem);

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
      return;
    }

    if (activeColumn === overColumn) {
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
    }

    setActiveId(null);
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

    setBoard((board) => ({
      ...board,
      [column]: board[column].filter((t) => t.id !== ticketId),
    }));
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

  const handleClearBoard = () => {
    setBoard(INITIAL_BOARD_STATE);
  };

  const handleClearColumn = (columnId: ColumnId) => {
    setBoard((board) => ({
      ...board,
      [columnId]: [],
    }));
  };

  const handleExportBoard = () => {
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `task-board-${timestamp}.json`;
    const data = exportBoardAsJson(board);
    downloadJsonFile(data, filename);
  };

  const handleImportBoard = (event: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  useImperativeHandle(
    ref,
    () => ({
      importFromInput: handleImportBoard,
      exportBoard: handleExportBoard,
      clearBoard: handleClearBoard,
    }),
    [board]
  );

  const activeTicket = activeId ? findTicket(activeId) : null;

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
        defaultValues={
          editingTicket
            ? {
                title: editingTicket.title,
                description: editingTicket.description,
                status: editingTicket.status,
                projectId: editingTicket.projectId,
                subTasks: editingTicket.subTasks || [],
              }
            : {
                title: "",
                description: "",
                status: formColumnId,
                projectId: lastSelectedProjectId,
                subTasks: [],
              }
        }
        mode={editingTicket ? "edit" : "create"}
      />
    </>
  );
});

"use client";

import { useState, useRef } from "react";
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
import { Ticket, BoardState, ColumnId } from "./types";
import { TicketForm } from "./ticket-form";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  serializeBoardData,
  deserializeBoardData,
  exportBoardAsJson,
  importBoardFromJson,
  downloadJsonFile,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const COLUMNS = [
  { id: "not-started" as ColumnId, title: "Not Started" },
  { id: "in-progress" as ColumnId, title: "In Progress" },
  { id: "complete" as ColumnId, title: "Complete" },
] as const;

const STORAGE_KEY = "trello-board-state";

const INITIAL_BOARD_STATE: BoardState = {
  "not-started": [],
  "in-progress": [],
  complete: [],
};

export function TrelloBoard() {
  const [rawBoard, setRawBoard, clearBoard] = useLocalStorage<string>(
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

  const setBoard = (newBoard: BoardState | ((prev: BoardState) => BoardState)) => {
    const updatedBoard = typeof newBoard === "function" ? newBoard(board) : newBoard;
    setRawBoard(serializeBoardData(updatedBoard));
  };
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [formColumnId, setFormColumnId] = useState<ColumnId>("not-started");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }) => {
    if (editingTicket) {
      const oldColumn = findColumn(editingTicket.id);
      if (!oldColumn) return;

      setBoard((board) => {
        const updatedTicket: Ticket = {
          ...editingTicket,
          title: data.title,
          description: data.description,
          status: data.status,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setBoard((board) => ({
        ...board,
        [data.status]: [...board[data.status], newTicket],
      }));
    }

    setIsFormOpen(false);
    setEditingTicket(null);
  };

  const handleClearBoard = () => {
    setBoard(INITIAL_BOARD_STATE);
  };

  const handleExportBoard = () => {
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `trello-board-${timestamp}.json`;
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
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const activeTicket = activeId ? findTicket(activeId) : null;

  return (
    <>
      <div className="flex justify-between items-center p-4 bg-white border-b">
        <h1 className="text-2xl font-bold">Trello Board</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Import Board
          </Button>
          <Button variant="outline" onClick={handleExportBoard}>
            Export Board
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Clear Board</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Board</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all tickets and reset the board to empty state. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearBoard}>
                  Clear Board
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportBoard}
          style={{ display: "none" }}
        />
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className='flex gap-4 p-4 overflow-x-auto min-h-screen bg-gray-50'>
          {COLUMNS.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tickets={board[column.id]}
              onAddTicket={() => handleAddTicket(column.id)}
              onEditTicket={handleEditTicket}
              onDeleteTicket={handleDeleteTicket}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTicket ? (
            <TicketCard ticket={activeTicket} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TicketForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingTicket
            ? {
                title: editingTicket.title,
                description: editingTicket.description,
                status: editingTicket.status,
              }
            : {
                title: "",
                description: "",
                status: formColumnId,
              }
        }
        mode={editingTicket ? "edit" : "create"}
      />
    </>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { BoardState, ColumnId, Ticket } from "@feel-good/greyboard-core/types";

export interface UseBoardDndOptions {
  board: BoardState;
  findColumn: (id: string, sourceBoard?: BoardState) => string | null;
  findTicket: (id: string) => Ticket | null;
  onBoardUpdate: (updater: (board: BoardState) => BoardState) => void;
  onStatusChange: (ticketId: string, oldStatus: ColumnId, newStatus: ColumnId) => void;
}

export interface UseBoardDndReturn {
  sensors: ReturnType<typeof useSensors>;
  handlers: {
    onDragStart: (event: DragStartEvent) => void;
    onDragOver: (event: DragOverEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
  };
  activeId: string | null;
  activeTicket: Ticket | null;
}

/**
 * Manages drag-and-drop functionality for the Kanban board.
 *
 * @example
 * const { sensors, handlers, activeTicket } = useBoardDnd({
 *   board,
 *   findColumn,
 *   findTicket,
 *   onBoardUpdate: actions.setBoard,
 *   onStatusChange: actions.handleStatusChange,
 * });
 */
export function useBoardDnd({
  board,
  findColumn,
  findTicket,
  onBoardUpdate,
  onStatusChange,
}: UseBoardDndOptions): UseBoardDndReturn {
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragSourceColumnRef = useRef<ColumnId | null>(null);

  // Using a ref to access board state for column existence checks.
  // Synchronous assignment ensures no timing gap where the ref holds stale data.
  const boardRef = useRef(board);
  boardRef.current = board;

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

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const ticketId = event.active.id as string;
      const sourceColumn = findColumn(ticketId);
      if (!sourceColumn) {
        setActiveId(null);
        dragSourceColumnRef.current = null;
        return;
      }
      setActiveId(ticketId);
      dragSourceColumnRef.current = sourceColumn as ColumnId;
    },
    [findColumn]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over) {
        return;
      }

      const activeColumn = findColumn(active.id as string);
      let overColumn: string | null;
      if (boardRef.current[over.id as string]) {
        overColumn = over.id as string;
      } else {
        overColumn = findColumn(over.id as string);
      }

      if (!activeColumn || !overColumn || activeColumn === overColumn) {
        return;
      }

      onBoardUpdate((board) => {
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

        const now = new Date();
        const targetColumn = overColumn as ColumnId;
        const updatedActiveItem = {
          ...activeItem,
          status: targetColumn,
          updatedAt: now,
          completedAt: targetColumn === "complete" ? now : null,
        };

        const isOverColumn = !!board[over.id as string];
        const overIndex = isOverColumn
          ? overItems.length
          : overItems.findIndex((t) => t.id === over.id);

        if (overIndex >= 0) {
          overItems.splice(overIndex, 0, updatedActiveItem);
        } else {
          overItems.push(updatedActiveItem);
        }

        return {
          ...board,
          [activeColumn]: activeItems,
          [overColumn]: overItems,
        };
      });
    },
    [findColumn, onBoardUpdate]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over) {
        setActiveId(null);
        dragSourceColumnRef.current = null;
        return;
      }

      const activeColumn = findColumn(active.id as string);
      let overColumn: string | null;
      if (boardRef.current[over.id as string]) {
        overColumn = over.id as string;
      } else {
        overColumn = findColumn(over.id as string);
      }

      if (!activeColumn || !overColumn) {
        setActiveId(null);
        dragSourceColumnRef.current = null;
        return;
      }

      if (dragSourceColumnRef.current === overColumn) {
        // Same column - just reorder
        onBoardUpdate((board) => {
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

        if (oldStatus) {
          onStatusChange(ticketId, oldStatus, newStatus);
        }
      }

      setActiveId(null);
      dragSourceColumnRef.current = null;
    },
    [findColumn, onBoardUpdate, onStatusChange]
  );

  const activeTicket = activeId ? findTicket(activeId) : null;

  return {
    sensors,
    handlers: {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
    },
    activeId,
    activeTicket,
  };
}

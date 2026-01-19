"use client";

import type { Column, BoardState, ColumnId, SubTask, Ticket } from "@/types/board.types";
import { ListLayout } from "./list-layout";
import { ListSection } from "./list-section";

interface ListViewProps {
  columns: Column[];
  board: BoardState;
  onAddTicket: (columnId: ColumnId) => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
  onClearColumn?: (columnId: ColumnId) => void;
  onUpdateSubTasks: (ticketId: string, subTasks: SubTask[]) => void;
}

/**
 * Main composition component for list view.
 * Renders collapsible sections for each column in vertical layout.
 */
export function ListView({
  columns,
  board,
  onAddTicket,
  onEditTicket,
  onDeleteTicket,
  onClearColumn,
  onUpdateSubTasks,
}: ListViewProps) {
  return (
    <ListLayout>
      {columns.map((column, index) => (
        <ListSection
          key={column.id}
          column={column}
          tickets={board[column.id] || []}
          onAddTicket={() => onAddTicket(column.id)}
          onEditTicket={onEditTicket}
          onDeleteTicket={onDeleteTicket}
          onClearColumn={
            column.id === "complete" && onClearColumn
              ? () => onClearColumn("complete")
              : undefined
          }
          onUpdateSubTasks={onUpdateSubTasks}
          isLastSection={index === columns.length - 1}
        />
      ))}
    </ListLayout>
  );
}

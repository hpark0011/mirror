"use client";

import { COLUMNS } from "@feel-good/greyboard-core/config";
import type { BoardState, ColumnId, SubTask, Ticket } from "@feel-good/greyboard-core/types";
import { ListLayout } from "./list-layout";
import { ListSection } from "./list-section";

interface ListViewProps {
  board: BoardState;
  onAddTicket: (columnId: ColumnId) => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
  onClearColumn?: (columnId: ColumnId) => void;
  onUpdateSubTasks: (ticketId: string, subTasks: SubTask[]) => void;
  onStartWork?: (ticketId: string) => void;
}

/**
 * Main composition component for list view.
 * Renders collapsible sections for each column in vertical layout.
 */
export function ListView({
  board,
  onAddTicket,
  onEditTicket,
  onDeleteTicket,
  onClearColumn,
  onUpdateSubTasks,
  onStartWork,
}: ListViewProps) {
  return (
    <ListLayout>
      {COLUMNS.map((column, index) => (
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
          onStartWork={onStartWork}
          isLastSection={index === COLUMNS.length - 1}
        />
      ))}
    </ListLayout>
  );
}

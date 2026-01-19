"use client";

import { Fragment } from "react";
import type { Column, BoardState, ColumnId, SubTask, Ticket } from "@/types/board.types";
import { BoardLayout } from "./board-layout";
import { BoardColumn } from "./board-column";

interface BoardViewProps {
  columns: Column[];
  board: BoardState;
  onAddTicket: (columnId: ColumnId) => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
  onClearColumn?: (columnId: ColumnId) => void;
  onUpdateSubTasks: (ticketId: string, subTasks: SubTask[]) => void;
}

/**
 * Main composition component for board view.
 * Renders horizontal columns with vertical dividers.
 */
export function BoardView({
  columns,
  board,
  onAddTicket,
  onEditTicket,
  onDeleteTicket,
  onClearColumn,
  onUpdateSubTasks,
}: BoardViewProps) {
  return (
    <BoardLayout>
      {columns.map((column) => (
        <Fragment key={column.id}>
          <BoardColumn
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
          />
          <div className='w-[1px] min-w-[1px] bg-border-medium last:hidden' />
        </Fragment>
      ))}
    </BoardLayout>
  );
}

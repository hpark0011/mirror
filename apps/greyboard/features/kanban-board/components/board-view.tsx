"use client";

import { Fragment } from "react";
import { COLUMNS } from "@feel-good/greyboard-core/config";
import type {
  BoardState,
  ColumnId,
  SubTask,
  Ticket,
} from "@feel-good/greyboard-core/types";
import { BoardLayout } from "./board-layout";
import { BoardColumn } from "./board-column";

interface BoardViewProps {
  board: BoardState;
  onAddTicket: (columnId: ColumnId) => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
  onClearColumn?: (columnId: ColumnId) => void;
  onUpdateSubTasks: (ticketId: string, subTasks: SubTask[]) => void;
  onStartWork?: (ticketId: string) => void;
}

/**
 * Main composition component for board view.
 * Renders horizontal columns with vertical dividers.
 */
export function BoardView({
  board,
  onAddTicket,
  onEditTicket,
  onDeleteTicket,
  onClearColumn,
  onUpdateSubTasks,
  onStartWork,
}: BoardViewProps) {
  return (
    <BoardLayout>
      {COLUMNS.map((column) => (
        <Fragment key={column.id}>
          <BoardColumn
            column={column}
            tickets={board[column.id] || []}
            onAddTicket={() => onAddTicket(column.id)}
            onEditTicket={onEditTicket}
            onDeleteTicket={onDeleteTicket}
            onClearColumn={column.id === "complete" && onClearColumn
              ? () => onClearColumn("complete")
              : undefined}
            onUpdateSubTasks={onUpdateSubTasks}
            onStartWork={onStartWork}
          />
          <div className="w-px min-w-px bg-border-medium last:hidden" />
        </Fragment>
      ))}
    </BoardLayout>
  );
}

"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TicketCard } from "@/features/ticket-card";
import { AddTicketButton } from "@/features/task-board-core";
import type { Column, SubTask, Ticket } from "@feel-good/greyboard-core/types";
import { BoardColumnHeader } from "./board-column-header";

interface BoardColumnProps {
  column: Column;
  tickets: Ticket[];
  onAddTicket: () => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
  onClearColumn?: () => void;
  onUpdateSubTasks: (ticketId: string, subTasks: SubTask[]) => void;
  onStartWork?: (ticketId: string) => void;
}

/**
 * Board view column with fixed width and vertical scrolling.
 * Displays tickets in a draggable, sortable list.
 */
export function BoardColumn({
  column,
  tickets,
  onAddTicket,
  onEditTicket,
  onDeleteTicket,
  onClearColumn,
  onUpdateSubTasks,
  onStartWork,
}: BoardColumnProps) {
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <Card
      className={cn(
        "flex flex-col bg-transparent shadow-none py-0 gap-0",
        "w-1/4 h-[calc(100vh-80px)] rounded-2xl border-none",
      )}
    >
      <BoardColumnHeader
        column={column}
        ticketCount={tickets.length}
        onAddTicket={onAddTicket}
        onClearColumn={onClearColumn}
      />
      <CardContent
        ref={setNodeRef}
        className="flex-1 p-0 px-4 overflow-hidden relative max-h-none overflow-y-scroll"
      >
        <div className="h-6 w-full bg-linear-to-t from-transparent to-background sticky top-0 left-0 z-10" />

        <SortableContext
          id={column.id}
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5 h-fit pb-4">
            {tickets.map((ticket, index) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                index={index}
                isInitialLoad={isInitialLoad}
                onEdit={() => onEditTicket(ticket)}
                onDelete={() => onDeleteTicket(ticket.id)}
                onClick={() => onEditTicket(ticket)}
                onStartWork={onStartWork
                  ? () => onStartWork(ticket.id)
                  : undefined}
                onSubTasksChange={(subTasks: SubTask[]) =>
                  onUpdateSubTasks(ticket.id, subTasks)}
              />
            ))}
            {column.id !== "complete" && (
              <AddTicketButton onAddTicket={onAddTicket} />
            )}
          </div>
        </SortableContext>

        <div className="h-4 w-full bg-linear-to-b from-transparent to-background fixed bottom-0 left-0" />
      </CardContent>
    </Card>
  );
}

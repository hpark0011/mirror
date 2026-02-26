"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TicketCard } from "@/features/ticket-card";
import { cn } from "@/lib/utils";
import type { Column, SubTask, Ticket } from "@feel-good/greyboard-core/types";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useState } from "react";
import { ListSectionHeader } from "./list-section-header";

interface ListSectionProps {
  column: Column;
  tickets: Ticket[];
  onAddTicket: () => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
  onClearColumn?: () => void;
  onUpdateSubTasks: (ticketId: string, subTasks: SubTask[]) => void;
  onStartWork?: (ticketId: string) => void;
  isLastSection: boolean;
}

/**
 * Collapsible section for list view containing tickets from a single column.
 * Manages expand/collapse state and renders ticket list.
 */
export function ListSection({
  column,
  tickets,
  onAddTicket,
  onEditTicket,
  onDeleteTicket,
  onClearColumn,
  onUpdateSubTasks,
  onStartWork,
  isLastSection,
}: ListSectionProps) {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <Card
      className={cn(
        "flex flex-col bg-transparent shadow-none py-0 gap-0",
        "w-full rounded-none border-x-0 border-none",
      )}
    >
      <ListSectionHeader
        column={column}
        ticketCount={tickets.length}
        onAddTicket={onAddTicket}
        onClearColumn={onClearColumn}
        isExpanded={isExpanded}
        isLastSection={isLastSection}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
      />
      <CardContent
        ref={setNodeRef}
        className={cn(
          "flex-1 px-4 overflow-hidden relative",
          !isExpanded && "max-h-0",
          isExpanded && "max-h-none py-4",
        )}
      >
        <SortableContext
          id={column.id}
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5 h-fit pb-0.5">
            {tickets.map((ticket, index) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                index={index}
                isInitialLoad={isInitialLoad}
                onEdit={() => onEditTicket(ticket)}
                onDelete={() => onDeleteTicket(ticket.id)}
                onClick={() => onEditTicket(ticket)}
                onStartWork={onStartWork ? () => onStartWork(ticket.id) : undefined}
                onSubTasksChange={(subTasks: SubTask[]) =>
                  onUpdateSubTasks(ticket.id, subTasks)}
              />
            ))}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}

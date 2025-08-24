"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { TicketCard } from "./ticket-card";
import { Ticket, Column } from "./types";

interface BoardColumnProps {
  column: Column;
  tickets: Ticket[];
  onAddTicket: () => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
}

export function BoardColumn({
  column,
  tickets,
  onAddTicket,
  onEditTicket,
  onDeleteTicket,
}: BoardColumnProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: column.id,
  });

  return (
    <Card className='w-80 min-h-[500px] flex flex-col bg-transparent shadow-none rounded-3xl py-0'>
      <CardHeader className='px-4 py-1'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-sm font-semibold'>
            {column.title}
          </CardTitle>
          <span className='text-sm text-muted-foreground bg-gray-100 px-2 py-1 rounded'>
            {tickets.length}
          </span>
        </div>
        <Button
          size='sm'
          variant='ghost'
          onClick={onAddTicket}
          className='w-full justify-start mt-2'
        >
          <PlusIcon className='h-4 w-4 mr-1' />
          Add Ticket
        </Button>
      </CardHeader>
      <CardContent ref={setNodeRef} className='flex-1 p-2'>
        <SortableContext
          id={column.id}
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className='space-y-2'>
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onEdit={() => onEditTicket(ticket)}
                onDelete={() => onDeleteTicket(ticket.id)}
              />
            ))}
          </div>
        </SortableContext>
        {tickets.length === 0 && (
          <div className='text-center text-muted-foreground py-8'>
            <p className='text-sm'>No tickets yet</p>
            <p className='text-xs mt-1'>
              Drop tickets here or create a new one
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

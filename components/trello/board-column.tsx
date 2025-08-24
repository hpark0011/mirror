"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TicketCard } from "./ticket-card";
import { Ticket, Column } from "./types";
import { Icon } from "@/components/ui/icon";
import { PlusIcon } from "lucide-react";

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
    <Card className='w-80 h-[calc(100vh-84px)] flex flex-col bg-transparent shadow-none rounded-2xl py-0 overflow-y-hidden gap-0'>
      <CardHeader className='pl-3.5 py-2 gap-0 pr-2'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-1'>
            <CardTitle className='text-sm font-semibold'>
              {column.title}
            </CardTitle>
            <span className='text-xs bg-light-inverse px-1.5 min-w-[20px] h-[20px] rounded-full flex items-center justify-center'>
              {tickets.length}
            </span>
          </div>
          <Button
            variant='ghost'
            onClick={onAddTicket}
            className='p-2 w-6 h-6 rounded-md'
          >
            <PlusIcon className='h-4 w-4' />
          </Button>
        </div>
      </CardHeader>
      <CardContent ref={setNodeRef} className='flex-1 p-2 overflow-y-scroll'>
        <SortableContext
          id={column.id}
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className='space-y-1'>
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onEdit={() => onEditTicket(ticket)}
                onDelete={() => onDeleteTicket(ticket.id)}
              />
            ))}
            <Button
              size='sm'
              variant='ghost'
              onClick={onAddTicket}
              className='w-full justify-start'
            >
              <PlusIcon className='h-4 w-4 mr-1' />
              Add Ticket
            </Button>
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

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { TicketCard } from "./ticket-card";
import { Column, Ticket } from "../../types/board";

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
    <Card className='w-1/3 h-[calc(100vh-96px)] flex flex-col bg-transparent shadow-none rounded-2xl py-0 gap-0 border-none'>
      <CardHeader className='pl-6 pb-2 gap-0 pr-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-baseline gap-0.5'>
            <CardTitle className='text-sm font-medium'>
              {column.title}
            </CardTitle>
            <span className='text-[13px] text-primary px-1.5 min-w-[20px] h-[20px] rounded-full flex items-center justify-center'>
              {tickets.length}
            </span>
          </div>
          <Button
            variant='ghost'
            onClick={onAddTicket}
            className='p-2 w-6 h-6 rounded-md'
          >
            <PlusIcon className='h-3.5 w-3.5' />
          </Button>
        </div>
      </CardHeader>
      <CardContent
        ref={setNodeRef}
        className='flex-1 p-0 px-5 overflow-y-scroll relative'
      >
        <div className='h-6 w-full bg-gradient-to-t from-transparent to-neutral-100 sticky top-0 left-0 z-10' />

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
              variant='outline'
              onClick={onAddTicket}
              className='w-full justify-start bg-transparent border-neutral-200 border p-0  rounded-xl h-[56px] has-[>svg]:pl-3.5 hover:bg-dq-gray-150'
            >
              <PlusIcon className='h-4 w-4' />
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
        <div className='h-2 w-full bg-gradient-to-b from-transparent to-neutral-100 sticky bottom-0 left-0' />
      </CardContent>
    </Card>
  );
}

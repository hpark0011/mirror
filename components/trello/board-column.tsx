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
      <CardHeader className='pl-7 pb-2 gap-0 pr-6'>
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
        className='flex-1 p-0 px-6 overflow-y-scroll relative'
      >
        <div className='h-6 w-full bg-gradient-to-t from-transparent to-neutral-100 sticky top-0 left-0 z-10' />

        <SortableContext
          id={column.id}
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className='space-y-1.5 h-full'>
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onEdit={() => onEditTicket(ticket)}
                onDelete={() => onDeleteTicket(ticket.id)}
              />
            ))}
            <button
              onClick={onAddTicket}
              className='flex w-full items-center flex-col justify-center bg-transparent border-neutral-200 border p-2 rounded-xl h-[50px] hover:bg-base/50 transition-all duration-200 ease-out hover:scale-102 shadow-none scale-100 active:scale-98 cursor-pointer relative group hover:border-white/100 inset-shadow-none hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.9),_0_14px_14px_-6px_rgba(0,0,0,0.3)]'
            >
              <div className='flex items-center gap-1 drop-shadow-none group-hover:drop-shadow-[2px_2px_0px_rgba(0,0,0,0.1)] transition-all duration-200 ease-out group-hover:scale-105 scale-100'>
                <PlusIcon className='size-4 text-text-muted group-hover:text-text-primary' />
                <span className='text-sm text-text-muted group-hover:text-text-primary'>
                  Add Ticket
                </span>
              </div>
            </button>
          </div>
        </SortableContext>

        <div className='h-2 w-full bg-gradient-to-b from-transparent to-neutral-100 sticky bottom-0 left-0' />
      </CardContent>
    </Card>
  );
}

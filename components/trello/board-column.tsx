"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { Column, Ticket } from "../../types/board.types";
import { Icon } from "../ui/icon";
import { TicketCard } from "./ticket-card";
import { TicketDetailDialog } from "./ticket-detail-dialog";

interface BoardColumnProps {
  column: Column;
  tickets: Ticket[];
  onAddTicket: () => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
  onClearColumn?: () => void;
}

export function BoardColumn({
  column,
  tickets,
  onAddTicket,
  onEditTicket,
  onDeleteTicket,
  onClearColumn,
}: BoardColumnProps) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    // Disable initial load animations after they complete
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 1000); // Adjust based on your animation duration
    
    return () => clearTimeout(timer);
  }, []);

  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
  };

  return (
    <Card className='w-1/3 h-[calc(100vh-80px)] flex flex-col bg-transparent shadow-none rounded-2xl py-0 gap-0 border-none pb-0'>
      <CardHeader className='pl-4.5 pb-2 gap-0 pr-4'>
        <div className='flex items-center justify-between h-6'>
          <div className='flex items-center gap-1'>
            <Icon
              name={column.icon}
              className={`${column.iconSize} ${column.iconColor}`}
            />
            <div className='flex items-baseline'>
              <CardTitle className='text-sm font-medium'>
                {column.title}
              </CardTitle>
              <span className='text-[13px] text-primary px-1.5 min-w-[20px] h-[20px] rounded-full flex items-center justify-center'>
                {tickets.length}
              </span>
            </div>
          </div>
          <div className='flex items-center gap-1'>
            {column.id === "complete" &&
              onClearColumn &&
              tickets.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      onClick={onClearColumn}
                      className='p-0 w-6 h-6 rounded-md cursor-pointer active:scale-90 transition-all duration-200 ease-out'
                    >
                      <Icon
                        name='XmarkIcon'
                        className='h-6 w-6 text-icon-light'
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear All Completed Tickets</TooltipContent>
                </Tooltip>
              )}
            {column.id !== "complete" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    onClick={onAddTicket}
                    className='p-2 w-6 h-6 rounded-md cursor-pointer active:scale-90 transition-all duration-200 ease-out'
                  >
                    <PlusIcon className='h-3.5 w-3.5 text-icon-light' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Ticket</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent
        ref={setNodeRef}
        className='flex-1 p-0 px-4 overflow-y-scroll relative'
      >
        <div className='h-6 w-full bg-gradient-to-t from-transparent to-background sticky top-0 left-0 z-10' />

        <SortableContext
          id={column.id}
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className='space-y-1.5 h-fit pb-4'>
            {tickets.map((ticket, index) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                index={index}
                isInitialLoad={isInitialLoad}
                onEdit={() => onEditTicket(ticket)}
                onDelete={() => onDeleteTicket(ticket.id)}
                onClick={() => handleTicketClick(ticket)}
              />
            ))}
            {column.id !== "complete" && (
              <button
                onClick={onAddTicket}
                className='flex w-full items-center flex-col justify-center bg-transparent border-none border p-2 rounded-xl h-[48px] hover:bg-base/50 transition-all duration-200 ease-out hover:scale-102 shadow-none scale-100 active:scale-98 cursor-pointer relative group hover:border-white/100 inset-shadow-none hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.9),_0_14px_14px_-6px_rgba(0,0,0,0.3)]'
              >
                <div className='flex items-center gap-1 drop-shadow-none group-hover:drop-shadow-[2px_2px_0px_rgba(0,0,0,0.1)] transition-all duration-200 ease-out group-hover:scale-105 scale-100'>
                  <PlusIcon className='size-4 text-icon-light group-hover:text-text-primary' />
                  <span className='text-sm text-text-muted group-hover:text-text-primary'>
                    Add Ticket
                  </span>
                </div>
              </button>
            )}
          </div>
        </SortableContext>

        <div className='h-4 w-full bg-gradient-to-b from-transparent to-background fixed bottom-0 left-0' />
      </CardContent>

      <TicketDetailDialog
        ticket={selectedTicket}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </Card>
  );
}

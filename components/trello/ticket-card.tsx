"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Edit, Trash } from "lucide-react";
import { Ticket } from "../../types/board";

interface TicketCardProps {
  ticket: Ticket;
  isDragging?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TicketCard({
  ticket,
  isDragging = false,
  onEdit,
  onDelete,
}: TicketCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSortableDragging ? transition : undefined,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative border border-white/90 hover:shadow-xl transition-all duration-200 translate-y-0 hover:translate-y-[-1px] scale-100 hover:scale-[1.02] ease-out group cursor-grab active:cursor-grabbing p-0 gap-0 bg-background hover:bg-base hover:border-white/100 inset-shadow-none shadow-[0_12px_12px_-6px_rgba(255,255,255,0.9),_0_14px_14px_-6px_rgba(0,0,0,0.3)]",
        isDragging &&
          "rotate-5 scale-105 shadow-[0_12px_12px_-6px_rgba(255,255,255,0.9),_0_14px_14px_-6px_rgba(0,0,0,0.3)]"
      )}
      {...attributes}
      {...listeners}
    >
      <CardHeader className={cn("p-4 pb-4 flex", ticket.description && "pb-2")}>
        <div className='flex items-start gap-2'>
          <div className='flex-1 min-w-0'>
            <CardTitle className='text-lg font-medium leading-none'>
              {ticket.title}
            </CardTitle>
          </div>
          {!isDragging && (
            <div className='absolute top-1.5 right-1.5 flex opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto border rounded-md p-0.5 border-extra-light shadow-lg'>
              <Button
                size='icon'
                variant='ghost'
                className='h-5 w-6 bg-transparent hover:bg-extra-light rounded-sm'
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
              >
                <Icon
                  name='SquareAndPencilIcon'
                  className='h-3 w-3 text-icon-dark'
                />
              </Button>
              <Button
                size='icon'
                variant='ghost'
                className='h-5 w-6 bg-transparent hover:bg-extra-light rounded-sm'
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
              >
                <Icon name='TrashIcon' className='h-3 w-3 text-icon-dark' />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {ticket.description && (
        <CardContent className='p-4 pt-0'>
          <p className='text-sm line-clamp-2 w-full leading-[140%]'>
            {ticket.description}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Edit, GripVertical, Trash } from "lucide-react";
import { Ticket } from "./types";

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
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white hover:shadow-md transition-shadow group cursor-grab active:cursor-grabbing",
        isDragging && "rotate-3 scale-105 shadow-xl"
      )}
      {...attributes}
      {...listeners}
    >
      <CardHeader className='p-3'>
        <div className='flex items-start gap-2'>
          <button
            className='cursor-grab active:cursor-grabbing mt-1 touch-none'
            type='button'
          >
            <GripVertical className='h-4 w-4 text-muted-foreground' />
          </button>
          <div className='flex-1 min-w-0'>
            <CardTitle className='text-sm font-medium leading-none'>
              {ticket.title}
            </CardTitle>
            {ticket.description && (
              <CardDescription className='text-xs mt-1.5 line-clamp-2'>
                {ticket.description}
              </CardDescription>
            )}
          </div>
          {!isDragging && (
            <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
              <Button
                size='icon'
                variant='ghost'
                className='h-6 w-6'
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
              >
                <Edit className='h-3 w-3' />
              </Button>
              <Button
                size='icon'
                variant='ghost'
                className='h-6 w-6 hover:text-destructive'
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
              >
                <Trash className='h-3 w-3' />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

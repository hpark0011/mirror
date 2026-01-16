"use client";

import { DragOverlay } from "@dnd-kit/core";
import { TicketCard } from "@/features/ticket-card";
import type { Ticket } from "@/types/board.types";

interface BoardDragOverlayProps {
  activeTicket: Ticket | null;
}

export function BoardDragOverlay({ activeTicket }: BoardDragOverlayProps) {
  return (
    <DragOverlay>
      {activeTicket ? <TicketCard ticket={activeTicket} isDragging /> : null}
    </DragOverlay>
  );
}

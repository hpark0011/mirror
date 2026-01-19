"use client";

import { DragOverlay } from "@dnd-kit/core";
import { TicketCard } from "@/features/ticket-card";
import type { Ticket } from "@/types/board.types";

interface DragOverlayWrapperProps {
  activeTicket: Ticket | null;
}

/**
 * Renders the dragged ticket overlay during drag operations.
 * View-agnostic primitive used by both board and list views.
 */
export function DragOverlayWrapper({ activeTicket }: DragOverlayWrapperProps) {
  return (
    <DragOverlay>
      {activeTicket ? <TicketCard ticket={activeTicket} isDragging /> : null}
    </DragOverlay>
  );
}

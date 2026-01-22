"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StopWatchState } from "@/features/timer";
import type { Ticket } from "@/types/board.types";
import { TicketActionToolbar } from "./ticket-action-toolbar";
import { TicketDurationBadge } from "./ticket-duration-badge";
import { TicketTimerButton } from "./ticket-timer-button";

interface TicketCardHeaderProps {
  ticket: Ticket;
  timerState: StopWatchState;
  isDragging: boolean;
  isSubTaskEditorOpen: boolean;
  onToggleSubTasks: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Header section of a ticket card containing title, timer, duration badge,
 * and action toolbar.
 */
export function TicketCardHeader({
  ticket,
  timerState,
  isDragging,
  isSubTaskEditorOpen,
  onToggleSubTasks,
  onEdit,
  onDelete,
}: TicketCardHeaderProps) {
  const hasContentBelow = ticket.description || isSubTaskEditorOpen;
  const isComplete = ticket.status === "complete";

  return (
    <CardHeader className={cn("p-2.5 py-2 flex", hasContentBelow && "pb-2 h-fit")}>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0 flex items-start">
          <CardTitle
            className={cn(
              "flex gap-px relative text-[14px] font-medium leading-[1.2]",
              isComplete && "block"
            )}
          >
            {ticket.status === "in-progress" && (
              <TicketTimerButton
                ticketId={ticket.id}
                ticketTitle={ticket.title}
                timerState={timerState}
              />
            )}
            <TicketDurationBadge
              status={ticket.status}
              duration={ticket.duration}
            />
            <span>{ticket.title}</span>
          </CardTitle>
        </div>
        <TicketActionToolbar
          isDragging={isDragging}
          isSubTaskEditorOpen={isSubTaskEditorOpen}
          onToggleSubTasks={onToggleSubTasks}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </CardHeader>
  );
}

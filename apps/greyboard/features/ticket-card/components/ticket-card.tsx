"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useState, type CSSProperties, type MouseEvent } from "react";

import { Card } from "@/components/ui/card";
import { useProjects } from "@/features/project-select";
import { useStopWatchStore } from "@/features/timer";
import type { SubTask, Ticket } from "@/types/board.types";
import { getCardClassName } from "../utils/ticket-card.config";
import { AnimatedTicketCardWrapper } from "./animated-ticket-card-wrapper";
import { TicketCardContent } from "./ticket-card-content";
import { TicketCardHeader } from "./ticket-card-header";
import { TicketProjectTag } from "./ticket-project-tag";

interface TicketCardProps {
  ticket: Ticket;
  isDragging?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  index?: number;
  isInitialLoad?: boolean;
  onSubTasksChange?: (subTasks: SubTask[]) => void;
}

/**
 * Main ticket card component for the Kanban board.
 *
 * Handles drag-and-drop, timer state, sub-task visibility,
 * and renders the card structure with header and content sections.
 */
export function TicketCard({
  ticket,
  isDragging = false,
  onEdit,
  onDelete,
  onClick,
  index = 0,
  isInitialLoad = false,
  onSubTasksChange,
}: TicketCardProps) {
  // Project lookup
  const { getProjectById } = useProjects();
  const project = ticket.projectId
    ? getProjectById(ticket.projectId)
    : undefined;

  // Drag-and-drop via @dnd-kit
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: ticket.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isSortableDragging ? transition : undefined,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  // Sub-task editor visibility - open by default if sub-tasks exist
  const [isSubTaskEditorOpen, setIsSubTaskEditorOpen] = useState(
    () => (ticket.subTasks?.length ?? 0) > 0
  );

  const toggleSubTaskEditor = useCallback(() => {
    setIsSubTaskEditorOpen((prev) => !prev);
  }, []);

  // Timer state for in-progress tickets
  const timerState = useStopWatchStore((state) =>
    state.getTimerState(ticket.id)
  );

  // Click handler - excludes buttons and sub-task area
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (isSortableDragging || !onClick) return;

      const target = e.target as HTMLElement;
      const isButton = target.closest("button");
      const isSubTaskArea = target.closest('[data-subtasks-area="true"]');

      if (!isButton && !isSubTaskArea) {
        onClick();
      }
    },
    [isSortableDragging, onClick]
  );

  return (
    <AnimatedTicketCardWrapper
      isInitialLoad={isInitialLoad}
      isDragging={isSortableDragging}
      index={index}
      setNodeRef={setNodeRef}
      style={style}
      onClick={handleClick}
      dragHandleProps={{ ...attributes, ...listeners }}
    >
      <TicketProjectTag project={project} isDragging={isDragging} />
      <Card className={getCardClassName(ticket.status)}>
        <TicketCardHeader
          ticket={ticket}
          timerState={timerState}
          isDragging={isDragging}
          isSubTaskEditorOpen={isSubTaskEditorOpen}
          onToggleSubTasks={toggleSubTaskEditor}
          onEdit={onEdit}
          onDelete={onDelete}
        />
        <TicketCardContent
          ticket={ticket}
          isSubTaskEditorOpen={isSubTaskEditorOpen}
          isDragging={isDragging}
          onSubTasksChange={onSubTasksChange}
        />
      </Card>
    </AnimatedTicketCardWrapper>
  );
}

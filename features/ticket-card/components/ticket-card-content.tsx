"use client";

import type { SyntheticEvent } from "react";

import { CardContent } from "@/components/ui/card";
import type { SubTask, Ticket } from "@/types/board.types";
import { SubTasksInlineEditor } from "../../sub-task-list/components/sub-tasks-inline-editor";
import { subTaskContainerStyles } from "../utils/ticket-card.config";

interface TicketCardContentProps {
  ticket: Ticket;
  isSubTaskEditorOpen: boolean;
  isDragging: boolean;
  onSubTasksChange?: (subTasks: SubTask[]) => void;
}

/**
 * Content section of a ticket card displaying either the sub-task editor
 * or the ticket description.
 */
export function TicketCardContent({
  ticket,
  isSubTaskEditorOpen,
  isDragging,
  onSubTasksChange,
}: TicketCardContentProps) {
  function stopPropagation(event: SyntheticEvent) {
    event.stopPropagation();
  }

  function handleSubTaskSave(updated: SubTask[]) {
    if (!isDragging) {
      onSubTasksChange?.(updated);
    }
  }

  if (isSubTaskEditorOpen) {
    return (
      <CardContent className={subTaskContainerStyles}>
        <div
          data-subtasks-area="true"
          onPointerDown={stopPropagation}
          onPointerUp={stopPropagation}
        >
          <SubTasksInlineEditor
            initialSubTasks={ticket.subTasks ?? []}
            onSave={handleSubTaskSave}
          />
        </div>
      </CardContent>
    );
  }

  if (ticket.description) {
    return (
      <CardContent className="p-2.5 pt-0">
        <p className="w-full line-clamp-6 text-sm text-text-tertiary leading-[1.2] whitespace-pre-wrap">
          {ticket.description}
        </p>
      </CardContent>
    );
  }

  return null;
}

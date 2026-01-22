"use client";

import type { MouseEvent } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@/components/ui/icon";
import { ColumnTitle } from "@/features/task-board-core";
import type { Column } from "@/types/board.types";

interface BoardColumnHeaderProps {
  column: Column;
  ticketCount: number;
  onAddTicket: () => void;
  onClearColumn?: () => void;
}

/**
 * Header for board view columns showing title, count, and action buttons.
 * Always shows add button (no collapse functionality in board view).
 */
export function BoardColumnHeader({
  column,
  ticketCount,
  onAddTicket,
  onClearColumn,
}: BoardColumnHeaderProps) {
  const isCompleteColumn = column.id === "complete";
  const showClearButton = isCompleteColumn && onClearColumn && ticketCount > 0;
  const showAddButton = !isCompleteColumn;

  const handleAddTicketClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onAddTicket();
  };

  const handleClearColumnClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClearColumn?.();
  };

  return (
    <CardHeader className="pl-4.5 pb-2 gap-0 pr-4">
      <div className="flex items-center justify-between h-6">
        <ColumnTitle
          icon={column.icon}
          iconSize={column.iconSize}
          iconColor={column.iconColor}
          title={column.title}
          count={ticketCount}
        />
        <div className="flex items-center gap-1">
          {showClearButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="icon"
                  onClick={handleClearColumnClick}
                  className="cursor-pointer active:scale-90 transition-all duration-200 ease-out size-6.5"
                >
                  <Icon
                    name="XmarkIcon"
                    className="size-4.5 text-icon-light"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear All Completed Tickets</TooltipContent>
            </Tooltip>
          )}
          {showAddButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="icon"
                  onClick={handleAddTicketClick}
                  className="cursor-pointer active:scale-90 transition-all duration-200 ease-out size-6.5 flex"
                >
                  <PlusIcon className="h-3.5 w-3.5 text-icon-light" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Ticket</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </CardHeader>
  );
}

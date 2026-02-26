"use client";

import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColumnTitle } from "@/features/task-board-core";
import { cn } from "@/lib/utils";
import type { Column } from "@feel-good/greyboard-core/types";
import { PlusIcon } from "lucide-react";
import type { MouseEvent } from "react";

interface ListSectionHeaderProps {
  column: Column;
  ticketCount: number;
  onAddTicket: () => void;
  onClearColumn?: () => void;
  isExpanded: boolean;
  isLastSection: boolean;
  onToggleExpand: () => void;
}

/**
 * Clickable header for list sections with collapse/expand functionality.
 * Shows column info and chevron indicator.
 */
export function ListSectionHeader({
  column,
  ticketCount,
  onAddTicket,
  onClearColumn,
  isExpanded,
  isLastSection,
  onToggleExpand,
}: ListSectionHeaderProps) {
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
    <CardHeader
      className={cn(
        "pl-4.5 pb-2 gap-0 pr-4",
        "cursor-pointer py-2",
        "hover:bg-hover-subtle",
        "border-y border-border-medium",
        !isExpanded && !isLastSection && "border-b-0",
      )}
      onClick={onToggleExpand}
      role="button"
      aria-expanded={isExpanded}
      aria-label={`Toggle ${column.title} tickets`}
    >
      <div className="flex items-center justify-between h-6">
        <div className="flex items-center gap-1">
          <Icon
            name="TriangleFillDownIcon"
            className={cn(
              "size-2 text-icon-light transition-transform duration-200",
              !isExpanded && "-rotate-90",
            )}
          />
          <ColumnTitle
            icon={column.icon}
            iconSize={column.iconSize}
            iconColor={column.iconColor}
            title={column.title}
            count={ticketCount}
          />
        </div>
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

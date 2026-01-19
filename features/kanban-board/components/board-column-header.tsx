"use client";

import { ChevronDown, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@/components/ui/icon";
import { useLayoutMode } from "../context";
import type { Column } from "@/types/board.types";

interface BoardColumnHeaderProps {
  column: Column;
  ticketCount: number;
  onAddTicket: () => void;
  onClearColumn?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function BoardColumnHeader({
  column,
  ticketCount,
  onAddTicket,
  onClearColumn,
  isExpanded = true,
  onToggleExpand,
}: BoardColumnHeaderProps) {
  const { isListLayout } = useLayoutMode();

  return (
    <CardHeader
      className={cn(
        "pl-4.5 pb-2 gap-0 pr-4",
        // List layout: make header tappable for collapse
        isListLayout && "cursor-pointer active:bg-neutral-100 dark:active:bg-neutral-800 py-3"
      )}
      onClick={isListLayout ? onToggleExpand : undefined}
      role={isListLayout ? "button" : undefined}
      aria-expanded={isListLayout ? isExpanded : undefined}
      aria-label={isListLayout ? `Toggle ${column.title} tickets` : undefined}
    >
      <div className="flex items-center justify-between h-6">
        <div className="flex items-center gap-1">
          <Icon
            name={column.icon}
            className={`${column.iconSize} ${column.iconColor}`}
          />
          <div className="flex items-baseline">
            <CardTitle className="text-sm font-medium">
              {column.title}
            </CardTitle>
            <span className="text-[13px] text-primary px-1.5 min-w-[20px] h-[20px] rounded-full flex items-center justify-center">
              {ticketCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {column.id === "complete" && onClearColumn && ticketCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearColumn();
                  }}
                  className="p-0 w-6 h-6 rounded-md cursor-pointer active:scale-90 transition-all duration-200 ease-out"
                >
                  <Icon
                    name="XmarkIcon"
                    className="h-6 w-6 text-icon-light"
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
                  variant="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTicket();
                  }}
                  className={cn(
                    "p-2 w-6 h-6 rounded-md cursor-pointer active:scale-90 transition-all duration-200 ease-out",
                    // Hide add button in list layout (use bottom button instead)
                    isListLayout ? "hidden" : "flex"
                  )}
                >
                  <PlusIcon className="h-3.5 w-3.5 text-icon-light" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Ticket</TooltipContent>
            </Tooltip>
          )}
          {/* Collapse chevron - list layout only */}
          {isListLayout && (
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          )}
        </div>
      </div>
    </CardHeader>
  );
}

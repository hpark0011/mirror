"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useLayoutMode,
  type LayoutPreference,
} from "@/features/kanban-board";

export function LayoutToggle() {
  const { layoutPref, setLayoutPref, isMobile } = useLayoutMode();

  if (isMobile) return null;

  return (
    <Tabs
      value={layoutPref}
      onValueChange={(value) => setLayoutPref(value as LayoutPreference)}
    >
      <TabsList className="h-7 p-0.5">
        <TabsTrigger value="list" className="h-full w-7.5 p-0" aria-label="List view">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-full w-full items-center justify-center">
                <Rows3 className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>List</TooltipContent>
          </Tooltip>
        </TabsTrigger>
        <TabsTrigger value="board" className="h-full w-7.5 p-0" aria-label="Board view">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-full w-full items-center justify-center">
                <LayoutGrid className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Board</TooltipContent>
          </Tooltip>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

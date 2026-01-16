"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { customToast } from "@/components/custom-toast";
import { useBoardActionsStore } from "@/store/board-actions-store";
import { type ChangeEvent, useRef } from "react";
import { ProjectFilter } from "./project-filter";

interface TasksHeaderActionsProps {
  onInsightsClick: () => void;
}

export function TasksHeaderActions({
  onInsightsClick,
}: TasksHeaderActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importBoard, exportBoard, clearBoard } = useBoardActionsStore();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        importBoard(content);
      } catch (error) {
        console.error("Failed to import board:", error);
        customToast({
          type: "error",
          title: "Import failed",
          description: "Please check the file format.",
        });
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='icon'
            className='h-6 w-6 cursor-pointer rounded-[6px] gap-0.5'
            aria-label='Insights'
            onClick={onInsightsClick}
          >
            <Icon
              name='WaveformPathEcgIcon'
              className='size-5.5 text-icon-light'
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Total focus time</TooltipContent>
      </Tooltip>

      <ProjectFilter />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='icon'
            className='h-6 w-6 cursor-pointer rounded-[6px]'
            aria-label='Board actions'
          >
            <Icon name='EllipsisIcon' className='size-4.5 text-icon-light' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-[180px]'>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              fileInputRef.current?.click();
            }}
          >
            <Icon
              name='ArrowUpToLineCompactIcon'
              className='size-4.5 text-icon-light'
            />
            Import tasks
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              exportBoard();
            }}
          >
            <Icon
              name='ArrowDownToLineCompactIcon'
              className='size-4.5 text-icon-light'
            />
            Export tasks
          </DropdownMenuItem>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(event) => event.preventDefault()}
                variant='destructive'
              >
                <Icon
                  name='XmarkCircleFillIcon'
                  className='size-4.5 text-destructive'
                />
                Clear all board
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Board</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all tickets and reset the board
                  to empty state. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearBoard}>
                  Clear Board
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type='file'
        accept='.json'
        onChange={handleFileChange}
        className='hidden'
      />
    </>
  );
}

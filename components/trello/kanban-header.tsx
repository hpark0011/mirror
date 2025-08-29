"use client";

import { useRef } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
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
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HeaderContainer,
  HeaderLogo,
  HeaderMenu,
} from "@/components/header/header-ui";

type HeaderProps = {
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onClear: () => void;
  title?: string;
};

export function KanbanHeader({ onImport, onExport, onClear }: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <HeaderContainer>
      <HeaderLogo title='Delphi' />
      <button className='bg-white/100 shadow-xs border-white border rounded-md text-[15px] px-2 h-[28px] hover:bg-white/70 transition-all duration-200 ease-out hover:scale-105 cursor-pointer scale-100 absolute left-1/2 -translate-x-1/2 flex items-center gap-1 translate-y-[0px] hover:translate-y-[-1px] hover:shadow-lg'>
        <div className='text-text-primary font-medium'>
          {new Date().toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </div>
        <div className='w-px self-stretch mx-1 bg-neutral-100' />
        <span className='text-text-muted'>Set today's focus</span>
      </button>
      <HeaderMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              onClick={onExport}
              className='h-6 w-6 bg-transparent cursor-pointer'
            >
              <Icon
                name='ArrowDownToLineCompactIcon'
                className='size-5 text-icon-light'
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export Board as JSON</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              onClick={() => fileInputRef.current?.click()}
              className='h-6 w-6 cursor-pointer'
            >
              <Icon
                name='ArrowUpToLineCompactIcon'
                className='size-5 text-icon-light'
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import Board</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button variant='ghost' className='h-6 w-6 cursor-pointer'>
                  <Icon
                    name='XmarkCircleFillIcon'
                    className='size-5.5 text-icon-light'
                  />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Clear All Board</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Board</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all tickets and reset the board to
                empty state. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onClear}>
                Clear Board
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </HeaderMenu>
      <input
        ref={fileInputRef}
        type='file'
        accept='.json'
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          onImport(e);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
        style={{ display: "none" }}
      />
    </HeaderContainer>
  );
}

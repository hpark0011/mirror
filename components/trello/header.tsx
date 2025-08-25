"use client";

import { useRef } from "react";
import type React from "react";
import Image from "next/image";
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

type HeaderProps = {
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onClear: () => void;
  title?: string;
};

export function Header({
  onImport,
  onExport,
  onClear,
  title = "Greyboard",
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className='flex justify-between items-center py-2  bg-transparent fixed top-0 w-full px-4 pl-5'>
      <div className='flex items-center gap-1.5'>
        <Image
          src='/delphi.svg'
          alt='Delphi logo'
          width={20}
          height={20}
          priority
        />
        <h1 className='text-xl font-medium pb-[1px]'>{title}</h1>
      </div>
      <div className='flex gap-0'>
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
      </div>
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
    </div>
  );
}

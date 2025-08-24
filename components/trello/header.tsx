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
    <div className='flex justify-between items-center p-4 py-2  bg-transparent fixed top-0 w-full pl-6'>
      <h1 className='text-xl font-semibold'>{title}</h1>
      <div className='flex gap-0.5'>
        <Button
          variant='ghost'
          onClick={() => fileInputRef.current?.click()}
          className='h-6 w-6 hover:bg-light bg-transparent'
        >
          <Icon name='ArrowDownToLineCompactIcon' className='h-4 w-4' />
        </Button>
        <Button variant='ghost' onClick={onExport} className='h-6 w-6'>
          <Icon name='ArrowUpToLineCompactIcon' className='h-4 w-4' />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant='ghost' className='h-6 w-6'>
              <Icon name='TrashIcon' className='h-4 w-4' />
            </Button>
          </AlertDialogTrigger>
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

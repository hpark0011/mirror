"use client";

import { PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface AddTicketButtonProps {
  onAddTicket: () => void;
}

export function AddTicketButton({ onAddTicket }: AddTicketButtonProps) {
  return (
    <button
      type='button'
      onClick={onAddTicket}
      className={cn(
        // Layout
        "flex flex-col items-center justify-center",
        // Sizing
        "w-full h-[48px] p-2",
        // Shape & Border
        "rounded-xl border border-transparent",
        // Background
        "bg-transparent",
        // Positioning
        "relative",
        // Interactive
        "cursor-pointer group",
        "scale-100 hover:scale-102 active:scale-98",
        // Transitions
        "transition-all duration-200 ease-out",
        // Shadows
        "shadow-none inset-shadow-none",
        // Hover states
        "hover:bg-card hover:border-card-border",
        "hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.9),_0_14px_14px_-6px_rgba(0,0,0,0.3)]",
        "dark:hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.15),_0_14px_14px_-6px_rgba(0,0,0,0.9)]"
      )}
    >
      <div
        className={cn(
          // Layout
          "flex items-center gap-1",
          // Effects
          "drop-shadow-none",
          // Interactive
          "scale-100 group-hover:scale-105",
          "group-hover:drop-shadow-[2px_2px_0px_rgba(0,0,0,0.1)]",
          // Transitions
          "transition-all duration-200 ease-out"
        )}
      >
        <PlusIcon className='size-4 text-icon-light group-hover:text-text-primary' />
        <span className='text-sm text-text-muted group-hover:text-text-primary'>
          Add Ticket
        </span>
      </div>
    </button>
  );
}

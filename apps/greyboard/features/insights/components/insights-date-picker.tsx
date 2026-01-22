"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Icon } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface InsightsDatePickerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

/**
 * Date picker popover for selecting insights date.
 */
export function InsightsDatePicker({
  selectedDate,
  onDateSelect,
}: InsightsDatePickerProps) {
  const [open, setOpen] = useState(false);

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 rounded-md border-border-highlight"
        >
          <Icon name="CalendarFillIcon" className="size-4" />
          <span className="text-xs font-medium">
            {isToday ? "Today" : formattedDate}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onDateSelect(date);
            setOpen(false);
          }}
          disabled={(date) => date > new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}

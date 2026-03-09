"use client";

import { useState } from "react";
import { Button } from "@feel-good/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@feel-good/ui/primitives/dropdown-menu";
import { Icon } from "@feel-good/ui/components/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { cn } from "@feel-good/utils/cn";

type SortOrder = "newest" | "oldest";

type ContentListSortDropdownProps = {
  value: SortOrder;
  onChange: (order: SortOrder) => void;
};

function isSortOrder(value: unknown): value is SortOrder {
  return value === "newest" || value === "oldest";
}

export function ContentListSortDropdown({
  value,
  onChange,
}: ContentListSortDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sort"
              className={cn(open && "[&_svg]:text-information")}
            >
              <Icon name="ArrowUpAndDownIcon" className="size-4.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{open ? undefined : "Sort"}</TooltipContent>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(nextValue) => {
              if (isSortOrder(nextValue)) {
                onChange(nextValue);
              }
            }}
          >
            <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="oldest">Oldest</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </Tooltip>
  );
}

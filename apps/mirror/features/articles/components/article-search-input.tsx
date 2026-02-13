"use client";

import { useEffect, useRef } from "react";
import { Button } from "@feel-good/ui/primitives/button";
import { Input } from "@feel-good/ui/primitives/input";
import { Icon } from "@feel-good/ui/components/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { cn } from "@feel-good/utils/cn";

type ArticleSearchInputProps = {
  query: string;
  onQueryChange: (q: string) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function ArticleSearchInput({
  query,
  onQueryChange,
  isOpen,
  onOpen,
  onClose,
}: ArticleSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasBeenOpen = useRef(false);

  // Manage focus: into input when opening, back to button when closing.
  // The ref guard prevents stealing focus on initial mount.
  useEffect(() => {
    if (isOpen) {
      hasBeenOpen.current = true;
      inputRef.current?.focus();
    } else if (hasBeenOpen.current) {
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="flex items-center">
      {/* Search toggle button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={buttonRef}
            variant="ghost"
            size="icon-sm"
            onClick={isOpen ? onClose : onOpen}
            aria-label="Search articles"
            aria-expanded={isOpen}
            className={cn(isOpen && "[&_svg]:text-information")}
          >
            <Icon name="MagnifyingGlassIcon" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Search</TooltipContent>
      </Tooltip>

      {/* Expandable input wrapper */}
      <div
        className={cn(
          "relative overflow-hidden transition-all duration-200 ease-out",
          isOpen ? "w-[160px] opacity-100" : "w-0 opacity-0",
        )}
      >
        <Input
          ref={inputRef}
          type="search"
          variant="underline"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          aria-label="Search articles"
          tabIndex={isOpen ? 0 : -1}
          className={cn(
            "h-7 [&::-webkit-search-cancel-button]:hidden",
            query.length > 0 && "pr-7",
          )}
        />

        {/* Clear button — only when input has text */}
        {query.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-0 top-0"
            tabIndex={isOpen ? 0 : -1}
          >
            <Icon name="XmarkCircleFillIcon" />
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import { Icon } from "@feel-good/ui/components/icon";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";

type ContactAddEntryButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  children?: React.ReactNode;
};

export function ContactAddEntryButton({
  onClick,
  disabled = false,
  disabledReason,
  children,
}: ContactAddEntryButtonProps) {
  const button = (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant="primary"
      size="xs"
      className="ml-2 has-[>svg]:gap-0.5 has-[>svg]:pl-1 has-[>svg]:pr-2"
      data-testid="contact-add-entry-button"
    >
      <Icon name="PlusIcon" className="size-4 text-icon-light" />
      {children ?? "Add contact"}
    </Button>
  );

  if (disabled && disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            {button}
          </span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

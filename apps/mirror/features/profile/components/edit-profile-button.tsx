"use client";

import { Button } from "@feel-good/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { Icon } from "@feel-good/ui/components/icon";

type EditProfileButtonProps = {
  onClick: () => void;
};

export function EditProfileButton({ onClick }: EditProfileButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Edit Profile"
          onClick={onClick}
          className="rounded-full [corner-shape:superellipse(1.0)] hover:[&_svg]:text-secondary-foreground [&_svg]:text-secondary-foreground [&_svg]:size-5.5"
        >
          <Icon name="PencilIcon" className="text-icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Edit Profile</TooltipContent>
    </Tooltip>
  );
}

"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

type IconButtonProps =
  & React.ComponentProps<typeof Button>
  & {
    tooltip: React.ReactNode;
    tooltipSide?: React.ComponentProps<typeof TooltipContent>["side"];
    tooltipAlign?: React.ComponentProps<typeof TooltipContent>["align"];
  };

function IconButton({
  tooltip,
  tooltipSide = "bottom",
  tooltipAlign,
  variant = "ghost",
  size = "icon-sm",
  type = "button",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size={size} type={type} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} align={tooltipAlign} sideOffset={0}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export { IconButton };
export type { IconButtonProps };

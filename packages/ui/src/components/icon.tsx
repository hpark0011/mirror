import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import * as Icons from "@feel-good/icons";

import { cn } from "../lib/utils";

// Type-safe icon name from all available icons
export type IconName = keyof typeof Icons;

const iconVariants = cva("shrink-0", {
  variants: {
    size: {
      xs: "size-3",
      sm: "size-4",
      default: "size-5",
      lg: "size-6",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface IconProps
  extends
    Omit<React.SVGProps<SVGSVGElement>, "name">,
    VariantProps<typeof iconVariants> {
  name: IconName;
}

function Icon({ name, size, className, ...props }: IconProps) {
  const IconComponent = Icons[name];

  if (!IconComponent) {
    console.warn(`Icon "${String(name)}" not found`);
    return null;
  }

  return (
    <IconComponent
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    />
  );
}

export { Icon, iconVariants };

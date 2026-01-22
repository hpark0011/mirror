"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as React from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot='checkbox'
      className={cn(
        "peer  data-[state=checked]:bg-blue-500 data-[state=checked]:text-primary-foreground  data-[state=checked]:border-blue-500 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive w-4 h-4 shrink-0 border transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 rounded-full relative p-0",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot='checkbox-indicator'
        className='flex items-center justify-center text-current transition-none h-[16px] w-[16px] absolute top-[-1px] left-[-1px]'
      >
        <Icon name='CheckmarkSmallIcon' className='size-6' />
        {/* <CheckIcon className='size-2.5' /> */}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

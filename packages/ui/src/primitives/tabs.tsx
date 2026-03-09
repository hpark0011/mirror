"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        // layout
        "group/tabs flex gap-2",
        // orientation
        "data-[orientation=horizontal]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  [
    // layout
    "inline-flex items-center justify-center",
    // shape
    "rounded-lg p-[3px]",
    // group
    "group/tabs-list",
    // typography
    "text-muted-foreground",
    // sizing
    "w-fit",
    // orientation: horizontal
    "group-data-[orientation=horizontal]/tabs:h-9",
    // orientation: vertical
    "group-data-[orientation=vertical]/tabs:h-fit",
    "group-data-[orientation=vertical]/tabs:flex-col",
    // variant overrides
    "data-[variant=line]:rounded-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        folder:
          "bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-7 rounded-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}:
  & React.ComponentProps<typeof TabsPrimitive.List>
  & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // positioning & layout
        "relative inline-flex flex-1 items-center justify-center gap-1.5 cursor-pointer",
        // sizing
        "h-[calc(100%-1px)] px-2 py-1",
        // shape
        "rounded-md border border-transparent",
        // typography
        "text-sm font-medium whitespace-nowrap",
        // color
        "text-foreground/60",
        // transition
        "transition-all",
        // hover
        "hover:text-foreground",
        // focus
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "focus-visible:outline-ring focus-visible:outline-1",
        // disabled
        "disabled:pointer-events-none disabled:opacity-50",
        // dark mode base
        "dark:text-muted-foreground dark:hover:text-foreground",
        // active state
        "data-[state=active]:bg-background data-[state=active]:text-foreground",
        // active state (dark)
        "dark:data-[state=active]:text-foreground",
        "dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30",
        // orientation: vertical
        "group-data-[orientation=vertical]/tabs:w-full",
        "group-data-[orientation=vertical]/tabs:justify-start",
        // variant: default — active shadow
        "group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm",
        // variant: line — transparent bg & no shadow
        "group-data-[variant=line]/tabs-list:bg-transparent",
        "group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none",
        // variant: line (dark)
        "dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent",
        "dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        // after pseudo-element (line indicator)
        "after:bg-foreground after:absolute after:opacity-0 after:transition-opacity",
        // after: horizontal orientation
        "group-data-[orientation=horizontal]/tabs:after:inset-x-0",
        "group-data-[orientation=horizontal]/tabs:after:bottom-[-5px]",
        "group-data-[orientation=horizontal]/tabs:after:h-0.5",
        // after: vertical orientation
        "group-data-[orientation=vertical]/tabs:after:inset-y-0",
        "group-data-[orientation=vertical]/tabs:after:-right-1",
        "group-data-[orientation=vertical]/tabs:after:w-0.5",
        // after: show on active line variant
        "group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        // variant: folder
        "group-data-[variant=folder]/tabs-list:text-[13px]",
        // variant: folder — 3D perspective tab shape (before pseudo-element)
        "group-data-[variant=folder]/tabs-list:before:absolute",
        "group-data-[variant=folder]/tabs-list:before:inset-0",
        "group-data-[variant=folder]/tabs-list:before:[transform:perspective(14px)_rotateX(3deg)]",
        "group-data-[variant=folder]/tabs-list:before:rounded-t-[10px]",
        "group-data-[variant=folder]/tabs-list:before:rounded-b-none",
        "group-data-[variant=folder]/tabs-list:before:bg-gray-5",
        "dark:group-data-[variant=folder]/tabs-list:before:bg-gray-2",
        "group-data-[variant=folder]/tabs-list:before:border",
        "group-data-[variant=folder]/tabs-list:before:border-border",
        "group-data-[variant=folder]/tabs-list:before:-z-[1]",
        "group-data-[variant=folder]/tabs-list:before:content-['']",
        // folder: active tab — remove bottom border, raise above siblings
        "group-data-[variant=folder]/tabs-list:data-[state=active]:before:border-b-background",
        "group-data-[variant=folder]/tabs-list:data-[state=active]:before:bg-background",
        "group-data-[variant=folder]/tabs-list:data-[state=active]:z-10",
        // folder: isolate stacking context so before stays visible
        "group-data-[variant=folder]/tabs-list:isolate",
        // folder: hide the trigger's own background/border
        "group-data-[variant=folder]/tabs-list:bg-transparent",
        "group-data-[variant=folder]/tabs-list:data-[state=active]:bg-transparent",
        "dark:group-data-[variant=folder]/tabs-list:data-[state=active]:bg-transparent",
        "dark:group-data-[variant=folder]/tabs-list:data-[state=active]:before:bg-background",
        "dark:group-data-[variant=folder]/tabs-list:data-[state=active]:border-transparent",
        "group-data-[variant=folder]/tabs-list:border-transparent",
        // folder: padding
        "group-data-[variant=folder]/tabs-list:px-3.5",
        "group-data-[variant=folder]/tabs-list:py-3.5",
        "group-data-[variant=folder]/tabs-list:pt-4",
        // svg defaults
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        "[&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, tabsListVariants, TabsTrigger };

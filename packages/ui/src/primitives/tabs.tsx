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
        "group/tabs flex gap-2",
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
        minimal: "p-0",
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

// Trigger styles are split into a shared base plus one block per variant so
// each variant owns its full active-state contract. The `group-data-[variant=*]`
// selectors mean only the matching variant's rules paint; adding a new variant
// gets a clean slate without inheriting stray default-variant styling.

const triggerBaseClasses = [
  // layout
  "relative inline-flex flex-1 items-center justify-center gap-1.5 cursor-pointer",
  "h-[calc(100%-1px)] px-2.5 py-1",
  // shape (transparent border reserves 1px so default's active border doesn't shift layout)
  "rounded-md border border-transparent",
  // typography
  "text-sm font-medium whitespace-nowrap",
  "text-muted-foreground/80 dark:text-muted-foreground",
  // interaction
  "transition-all",
  "hover:text-foreground dark:hover:text-foreground",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "focus-visible:outline-ring focus-visible:outline-1",
  "disabled:pointer-events-none disabled:opacity-50",
  // shared active state — every variant uses foreground text when active.
  // The `dark:` compound is required: without it `dark:text-muted-foreground`
  // ties on specificity and wins on source order, dimming active text in dark mode.
  "data-[state=active]:text-foreground dark:data-[state=active]:text-foreground",
  // orientation: vertical
  "group-data-[orientation=vertical]/tabs:w-full",
  "group-data-[orientation=vertical]/tabs:justify-start",
  // svg defaults
  "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  "[&_svg:not([class*='size-'])]:size-4",
].join(" ");

// variant: default — active tab is a filled surface with subtle elevation
const triggerDefaultVariantClasses = [
  "group-data-[variant=default]/tabs-list:data-[state=active]:bg-background",
  "group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm",
  // dark: outlined surface instead of pure fill
  "dark:group-data-[variant=default]/tabs-list:data-[state=active]:border-input",
  "dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-input/30",
].join(" ");

// variant: line — active state is a 2px underline via the `after` pseudo-element
const triggerLineVariantClasses = [
  // never paint a background; the underline is the indicator
  "group-data-[variant=line]/tabs-list:bg-transparent",
  "group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
  "group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none",
  "dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent",
  "dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
  // underline indicator (after pseudo)
  "after:bg-foreground after:absolute after:opacity-0 after:transition-opacity",
  "group-data-[orientation=horizontal]/tabs:after:inset-x-0",
  "group-data-[orientation=horizontal]/tabs:after:bottom-[-5px]",
  "group-data-[orientation=horizontal]/tabs:after:h-0.5",
  "group-data-[orientation=vertical]/tabs:after:inset-y-0",
  "group-data-[orientation=vertical]/tabs:after:-right-1",
  "group-data-[orientation=vertical]/tabs:after:w-0.5",
  "group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
].join(" ");

// variant: folder — 3D perspective tab shape rendered via the `before` pseudo-element
const triggerFolderVariantClasses = [
  // typography & spacing
  "group-data-[variant=folder]/tabs-list:text-[13px]",
  "group-data-[variant=folder]/tabs-list:px-3 group-data-[variant=folder]/tabs-list:py-0 group-data-[variant=folder]/tabs-list:pt-0",
  // hide the trigger's own surface — the before pseudo is the tab shape
  "group-data-[variant=folder]/tabs-list:bg-transparent",
  "group-data-[variant=folder]/tabs-list:border-transparent",
  "group-data-[variant=folder]/tabs-list:isolate",
  // tab shape (before pseudo)
  "group-data-[variant=folder]/tabs-list:before:absolute",
  "group-data-[variant=folder]/tabs-list:before:inset-0",
  "group-data-[variant=folder]/tabs-list:before:[transform:perspective(16px)_rotateX(2deg)]",
  "group-data-[variant=folder]/tabs-list:before:rounded-t-[8px]",
  "group-data-[variant=folder]/tabs-list:before:rounded-b-none",
  "group-data-[variant=folder]/tabs-list:before:bg-gray-5",
  "dark:group-data-[variant=folder]/tabs-list:before:bg-gray-2",
  "group-data-[variant=folder]/tabs-list:before:border",
  "group-data-[variant=folder]/tabs-list:before:border-border",
  "group-data-[variant=folder]/tabs-list:before:-z-[1]",
  "group-data-[variant=folder]/tabs-list:before:content-['']",
  // active: raise the tab and merge its bottom edge into the panel
  "group-data-[variant=folder]/tabs-list:data-[state=active]:before:bg-background",
  "group-data-[variant=folder]/tabs-list:data-[state=active]:before:border-b-background",
  "group-data-[variant=folder]/tabs-list:data-[state=active]:bg-transparent",
  "group-data-[variant=folder]/tabs-list:data-[state=active]:z-10",
  "dark:group-data-[variant=folder]/tabs-list:data-[state=active]:bg-transparent",
  "dark:group-data-[variant=folder]/tabs-list:data-[state=active]:before:bg-background",
  "dark:group-data-[variant=folder]/tabs-list:data-[state=active]:border-transparent",
].join(" ");

// variant: minimal — text-only tabs, no surface or border on active
const triggerMinimalVariantClasses = [
  "group-data-[variant=minimal]/tabs-list:px-0",
  "group-data-[variant=minimal]/tabs-list:font-normal",
].join(" ");

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        triggerBaseClasses,
        triggerDefaultVariantClasses,
        triggerLineVariantClasses,
        triggerFolderVariantClasses,
        triggerMinimalVariantClasses,
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

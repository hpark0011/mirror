"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot='tabs'
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot='tabs-list'
      className={cn(
        "inline-flex w-fit items-center justify-center",
        "h-9 rounded-md border border-input",
        "bg-background/5 backdrop-blur-lg",
        className
      )}
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
      data-slot='tabs-trigger'
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5",
        "rounded-[5px] border border-transparent",
        "h-[calc(100%-1px)] px-2 py-1 text-[13px]",
        "whitespace-nowrap font-medium",
        "text-text-tertiary dark:text-muted-foreground",
        "active:scale-95 transition-all duration-200 ease-out",
        "data-[state=active]:bg-tab-active-background data-[state=active]:shadow-xs dark:data-[state=active]:text-orange-500",
        "transition-[color,box-shadow]",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:outline-1",
        "disabled:pointer-events-none disabled:opacity-50",
        "hover:bg-hover cursor-pointer",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "[&_svg]:text-icon-light data-[state=active]:[&_svg]:text-icon-medium",
        className
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
      data-slot='tabs-content'
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };

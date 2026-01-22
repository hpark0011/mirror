"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion, LayoutGroup, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

const SPRING_TRANSITION = {
  type: "spring" as const,
  stiffness: 500,
  damping: 35,
};

/**
 * Tabs with a sliding active indicator.
 * Use with SlidingTabsList and SlidingTabsTrigger for animated tab switching.
 *
 * @example
 * ```tsx
 * <SlidingTabs defaultValue="tab1">
 *   <SlidingTabsList>
 *     <SlidingTabsTrigger value="tab1">Account</SlidingTabsTrigger>
 *     <SlidingTabsTrigger value="tab2">Password</SlidingTabsTrigger>
 *   </SlidingTabsList>
 *   <SlidingTabsContent value="tab1">Account content</SlidingTabsContent>
 *   <SlidingTabsContent value="tab2">Password content</SlidingTabsContent>
 * </SlidingTabs>
 * ```
 */
function SlidingTabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="sliding-tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

/**
 * Container for SlidingTabsTrigger components.
 * Wraps children in LayoutGroup for independent animation scoping.
 */
function SlidingTabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const layoutGroupId = React.useId();

  return (
    <LayoutGroup id={layoutGroupId}>
      <TabsPrimitive.List
        data-slot="sliding-tabs-list"
        className={cn(
          "relative inline-flex h-9 w-fit items-center justify-center rounded-lg border border-extra-light bg-transparent p-[3px] text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </LayoutGroup>
  );
}

/**
 * Tab trigger with sliding indicator animation.
 * The indicator smoothly transitions between active tabs.
 */
function SlidingTabsTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <TabsPrimitive.Trigger
      data-slot="sliding-tabs-trigger"
      className={cn(
        "group relative inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-transparent px-2 py-1 text-[13px] font-medium transition-[color,box-shadow]",
        "text-text-tertiary dark:text-muted-foreground",
        "hover:text-text-secondary",
        "focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:text-[#F66B15] dark:data-[state=active]:text-foreground",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {/* Sliding indicator - only visible when active */}
      <span
        className="absolute inset-0 hidden group-data-[state=active]:block"
        aria-hidden="true"
      >
        <motion.span
          layoutId="sliding-indicator"
          className="absolute inset-0 rounded-sm bg-[#FFEED6] dark:bg-input/30"
          initial={false}
          transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
        />
      </span>
      {/* Content */}
      <span className="relative z-10">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

/**
 * Content panel for SlidingTabs.
 * Displays when its corresponding tab is active.
 */
function SlidingTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="sliding-tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export {
  SlidingTabs,
  SlidingTabsList,
  SlidingTabsTrigger,
  SlidingTabsContent,
};

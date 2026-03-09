"use client";

import * as React from "react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "../lib/utils";

function ResizablePanelGroup({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      ref={ref}
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function ResizablePanel({
  ref,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return (
    <ResizablePrimitive.Panel
      ref={ref}
      data-slot="resizable-panel"
      {...props}
    />
  );
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        // Layout
        "relative flex items-center justify-center",
        // Sizing
        "w-px",
        // Background
        "bg-border",
        // Positioning (hit area via ::after)
        "after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
        // Focus
        "focus-visible:ring-ring focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden",
        // Vertical direction
        "data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full",
        "data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2",
        "[&[data-panel-group-direction=vertical]>div]:rotate-90",
        // Hover / Drag (synced with library hit-area via data attribute)
        "data-[resize-handle-state=hover]:bg-resizable-handle-hover data-[resize-handle-state=hover]:shadow-[0_0_0_0px_var(--color-resizable-handle-hover)]",
        "data-[resize-handle-state=drag]:bg-resizable-handle-hover data-[resize-handle-state=drag]:shadow-[0_0_0_0px_var(--color-resizable-handle-hover)]",
        // Group for child grip visibility
        "group",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-resizable-handle-hover z-10 flex h-8 w-1.5 min-w-1.5 items-center justify-center rounded-full opacity-0 group-data-[resize-handle-state=hover]:opacity-100 group-data-[resize-handle-state=drag]:opacity-100" />
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };

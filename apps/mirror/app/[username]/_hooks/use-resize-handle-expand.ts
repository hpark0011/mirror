"use client";

import { useCallback, type ComponentProps } from "react";
import type { ResizableHandle } from "@feel-good/ui/primitives/resizable";
import type { ContentPanelController } from "./use-content-panel-controller";
import type { InteractionPanelController } from "./use-interaction-panel-controller";

type ResizableHandlePointerDownCapture = NonNullable<
  ComponentProps<typeof ResizableHandle>["onPointerDownCapture"]
>;

/**
 * Drag-to-open policy for the resize handle. When either panel is
 * collapsed, a pointer-down on the handle should re-open it via that
 * controller's `expand()` primitive — instead of letting the handle
 * begin a drag on a zero-width panel, which the resizable library
 * cannot recover from smoothly.
 *
 * This is the SINGLE implementation of the drag-to-open policy. The
 * toggle handlers and this composer both delegate to each controller's
 * `expand()` primitive, so the policy lives in exactly one place.
 */
export function useResizeHandleExpand(
  contentController: ContentPanelController,
  interactionController: InteractionPanelController,
): ResizableHandlePointerDownCapture {
  return useCallback<ResizableHandlePointerDownCapture>(
    (event) => {
      if (interactionController.expand()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (!contentController.isCollapsed) return;

      event.preventDefault();
      event.stopPropagation();

      contentController.expand();
    },
    [contentController, interactionController],
  );
}

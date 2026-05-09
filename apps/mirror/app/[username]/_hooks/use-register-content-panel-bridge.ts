"use client";

import { useEffect } from "react";
import { useWorkspacePanelBridge } from "../_providers/workspace-panel-bridge-context";
import { type ContentPanelController } from "./use-content-panel-controller";

/**
 * PLAN_010 — desktop-side registration for the workspace panel bridge.
 *
 * Wires `contentController.ensureExpanded` into the bridge so the dispatcher
 * (`useCloneActions`) can imperatively open the content panel before pushing
 * a new content URL. Only desktop registers; mobile leaves the bridge slot
 * empty (panel visibility is route-driven on mobile).
 */
export function useRegisterContentPanelBridge(
  contentController: ContentPanelController,
) {
  const { register } = useWorkspacePanelBridge();
  const { ensureExpanded } = contentController;
  useEffect(() => {
    return register(ensureExpanded);
  }, [register, ensureExpanded]);
}

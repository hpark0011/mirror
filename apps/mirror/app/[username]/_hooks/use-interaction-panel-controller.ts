"use client";

import {
  useCallback,
  useRef,
  useState,
  type ComponentRef,
  type RefCallback,
  type RefObject,
} from "react";
import type {
  ResizablePanel,
  ResizablePanelGroup,
} from "@feel-good/ui/primitives/resizable";
import { OPEN_LAYOUT } from "./workspace-layout-constants";

type PanelRef = ComponentRef<typeof ResizablePanel>;
type GroupRef = ComponentRef<typeof ResizablePanelGroup>;

type UseInteractionPanelControllerArgs = {
  groupRef: RefObject<GroupRef | null>;
};

export type InteractionPanelController = {
  setPanelRef: RefCallback<PanelRef>;
  isCollapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  toggle: () => void;
  /** Returns true if expansion was performed (panel was collapsed). */
  expand: () => boolean;
};

export function useInteractionPanelController({
  groupRef,
}: UseInteractionPanelControllerArgs): InteractionPanelController {
  const panelRef = useRef<PanelRef | null>(null);
  const setPanelRef = useCallback<RefCallback<PanelRef>>((node) => {
    panelRef.current = node;
  }, []);

  const [isCollapsed, setIsCollapsed] = useState(false);

  const onCollapse = useCallback(() => setIsCollapsed(true), []);
  const onExpand = useCallback(() => setIsCollapsed(false), []);

  const expand = useCallback(() => {
    if (!isCollapsed) return false;
    groupRef.current?.setLayout([...OPEN_LAYOUT]);
    return true;
  }, [groupRef, isCollapsed]);

  const toggle = useCallback(() => {
    if (isCollapsed) {
      expand();
      return;
    }
    panelRef.current?.collapse();
  }, [expand, isCollapsed]);

  return { setPanelRef, isCollapsed, onCollapse, onExpand, toggle, expand };
}

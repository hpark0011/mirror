"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import { useUiControl } from "../context/ui-control-context";

export function useChatUiControl(
  conversationId: Id<"conversations"> | null,
) {
  const { dispatchUiControlActions } = useUiControl();
  const markApplied = useMutation(api.chat.uiControl.markApplied);
  const pending = useQuery(
    api.chat.uiControl.listPending,
    conversationId ? { conversationId } : "skip",
  );
  const dispatchedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!pending || pending.length === 0) return;

    for (const record of pending) {
      if (dispatchedIdsRef.current.has(record._id)) continue;
      dispatchedIdsRef.current.add(record._id);
      dispatchUiControlActions(record.actions);
      void markApplied({ id: record._id });
    }
  }, [dispatchUiControlActions, markApplied, pending]);
}

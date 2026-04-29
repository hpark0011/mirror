"use client";

import { useRef, useEffect, useCallback } from "react";
import { useDaily } from "@daily-co/daily-react";
import { useCallState } from "./use-call-state";

function endTavusConversation(conversationId: string) {
  // Fire-and-forget: ensures Tavus releases the slot even if the user
  // closes the tab or we're unmounting. Errors are non-fatal — the call
  // is already torn down on the client.
  fetch(`/api/tavus/conversations/${conversationId}/end`, {
    method: "POST",
    keepalive: true,
  }).catch(() => {});
}

export function useVideoCall() {
  const [callState, dispatch] = useCallState();
  const daily = useDaily();
  const isStartingRef = useRef(false);
  const activeConversationIdRef = useRef<string | null>(null);

  const startCall = useCallback(
    async (username: string) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      try {
        dispatch({ type: "start" });

        const response = await fetch("/api/tavus/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username }),
        });

        if (!response.ok) {
          throw new Error(`Failed to start call: ${response.statusText}`);
        }

        const data = await response.json();
        activeConversationIdRef.current = data.conversation_id;
        dispatch({
          type: "connect",
          conversationUrl: data.conversation_url,
          conversationId: data.conversation_id,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to start call";
        dispatch({ type: "error", message });
      } finally {
        isStartingRef.current = false;
      }
    },
    [dispatch]
  );

  const endCall = useCallback(() => {
    daily?.leave();
    const conversationId = activeConversationIdRef.current;
    if (conversationId) {
      endTavusConversation(conversationId);
      activeConversationIdRef.current = null;
    }
    dispatch({ type: "end" });
  }, [daily, dispatch]);

  const resetCall = useCallback(() => {
    dispatch({ type: "reset" });
  }, [dispatch]);

  const markConnected = useCallback(() => {
    dispatch({ type: "connected" });
  }, [dispatch]);

  const markError = useCallback(
    (message: string) => {
      dispatch({ type: "error", message });
    },
    [dispatch]
  );

  // Cleanup on unmount — also release the Tavus conversation slot.
  // Read latest daily through a ref so the effect can stay deps-less and
  // only fire on actual unmount, not on every status transition.
  const dailyRef = useRef(daily);
  dailyRef.current = daily;
  useEffect(() => {
    return () => {
      dailyRef.current?.leave().catch(() => {});
      const conversationId = activeConversationIdRef.current;
      if (conversationId) {
        endTavusConversation(conversationId);
        activeConversationIdRef.current = null;
      }
    };
  }, []);

  // Warn before leaving during active call
  useEffect(() => {
    if (callState.status !== "connected") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [callState.status]);

  return { callState, startCall, endCall, resetCall, markConnected, markError };
}

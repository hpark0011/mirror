"use client";

import { useRef, useEffect, useCallback } from "react";
import { useDaily } from "@daily-co/daily-react";
import type { Article } from "@feel-good/tavus";
import { useCallState } from "./use-call-state";

export function useVideoCall() {
  const [callState, dispatch] = useCallState();
  const daily = useDaily();
  const isStartingRef = useRef(false);

  const startCall = useCallback(
    async (articles: Article[]) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      try {
        dispatch({ type: "start" });

        const response = await fetch("/api/tavus/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ articles }),
        });

        if (!response.ok) {
          throw new Error(`Failed to start call: ${response.statusText}`);
        }

        const data = await response.json();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callState.status === "connected") {
        daily?.leave();
      }
    };
  }, [callState.status, daily]);

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

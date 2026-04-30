"use client";

import { useRef, useEffect, useCallback } from "react";
import { useCallState } from "./use-call-state";

function endTavusConversation(conversationId: string) {
  // Fire-and-forget POST that releases the Tavus slot. Used by the explicit
  // endCall path, the unmount cleanup effect, and the pagehide handler.
  // `keepalive: true` lets the request survive page unload so a tab close
  // still releases the slot. Errors are non-fatal.
  fetch(`/api/tavus/conversations/${conversationId}/end`, {
    method: "POST",
    keepalive: true,
  }).catch(() => {});
}

export function useVideoCall() {
  const [callState, dispatch] = useCallState();
  const isStartingRef = useRef(false);
  const activeConversationIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

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

        // If the hook unmounted while the request was in flight, the cleanup
        // effect already ran with a null conversation id. Release the slot
        // here directly and skip the dispatch — there's no consumer left.
        if (!isMountedRef.current) {
          endTavusConversation(data.conversation_id);
          return;
        }

        activeConversationIdRef.current = data.conversation_id;
        dispatch({
          type: "connect",
          conversationUrl: data.conversation_url,
          conversationId: data.conversation_id,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to start call";
        if (isMountedRef.current) {
          dispatch({ type: "error", message });
        }
      } finally {
        isStartingRef.current = false;
      }
    },
    [dispatch]
  );

  const endCall = useCallback(() => {
    const conversationId = activeConversationIdRef.current;
    if (conversationId) {
      endTavusConversation(conversationId);
      activeConversationIdRef.current = null;
    }
    dispatch({ type: "end" });
  }, [dispatch]);

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

  // Cleanup on unmount — release the Tavus conversation slot if one is active.
  // Daily teardown is owned by `Conversation`'s unmount cleanup, not this hook.
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      const conversationId = activeConversationIdRef.current;
      if (conversationId) {
        endTavusConversation(conversationId);
        activeConversationIdRef.current = null;
      }
    };
  }, []);

  // Release the Tavus slot on tab close / bfcache transitions. `pagehide`
  // is the reliable signal for `keepalive` fetches; `beforeunload` is not.
  useEffect(() => {
    if (callState.status !== "connecting" && callState.status !== "connected") {
      return;
    }

    const handlePageHide = () => {
      const conversationId = activeConversationIdRef.current;
      if (conversationId) {
        endTavusConversation(conversationId);
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [callState.status]);

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

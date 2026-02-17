"use client";

import { useDaily, useDailyEvent } from "@daily-co/daily-react";
import { useEffect, useCallback, useRef } from "react";

type ConversationProps = {
  conversationUrl: string;
  onJoined?: () => void;
  onLeft?: () => void;
  onError?: (error: string) => void;
};

/**
 * Headless component that manages the Daily.co room lifecycle.
 * Joins the room on mount and leaves on unmount.
 * Video rendering is handled by VideoCallView.
 */
export function Conversation({
  conversationUrl,
  onJoined,
  onLeft,
  onError,
}: ConversationProps) {
  const daily = useDaily();
  const hasJoinedRef = useRef(false);

  useDailyEvent(
    "left-meeting",
    useCallback(() => {
      onLeft?.();
    }, [onLeft])
  );

  useEffect(() => {
    if (!daily || hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    daily
      .join({ url: conversationUrl })
      .then(() => onJoined?.())
      .catch((err) => {
        hasJoinedRef.current = false;
        onError?.(
          err instanceof Error ? err.message : "Failed to join conversation"
        );
      });

    return () => {
      daily.leave().catch(() => {});
    };
  }, [daily, conversationUrl, onJoined, onError]);

  return null;
}

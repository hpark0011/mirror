"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";
import type { Article } from "@feel-good/tavus";
import { CVIProvider } from "./cvi/cvi-provider";
import { Conversation } from "./cvi/conversation";
import { VideoCallView } from "./video-call-view";
import { useVideoCall } from "../hooks/use-video-call";

type VideoCallModalProps = {
  articles: Article[];
  onClose: () => void;
};

function VideoCallContent({ articles, onClose }: VideoCallModalProps) {
  const { callState, startCall, endCall, resetCall, markConnected, markError } =
    useVideoCall();

  const shouldRenderConversation =
    callState.status === "connecting" || callState.status === "connected";

  const handleClose = useCallback(() => {
    endCall();
    onClose();
  }, [endCall, onClose]);

  const handleRetry = useCallback(() => {
    resetCall();
    startCall(articles);
  }, [resetCall, startCall, articles]);

  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    startCall(articles);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
    >
      <button
        type="button"
        onClick={handleClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {shouldRenderConversation && (
        <Conversation
          conversationUrl={callState.conversationUrl}
          onJoined={markConnected}
          onLeft={handleClose}
          onError={markError}
        />
      )}
      <VideoCallView
        callState={callState}
        onEndCall={handleClose}
        onRetry={handleRetry}
        onClose={handleClose}
      />
    </motion.div>
  );
}

export function VideoCallModal({ articles, onClose }: VideoCallModalProps) {
  return (
    <CVIProvider>
      <AnimatePresence>
        <VideoCallContent articles={articles} onClose={onClose} />
      </AnimatePresence>
    </CVIProvider>
  );
}

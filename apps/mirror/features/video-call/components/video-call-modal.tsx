"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";
import { CVIProvider } from "./cvi/cvi-provider";
import { Conversation } from "./cvi/conversation";
import { VideoCall } from "./video-call";
import { useVideoCall } from "../hooks/use-video-call";

type VideoCallModalProps = {
  username: string;
  onClose: () => void;
};

function VideoCallContent({ username, onClose }: VideoCallModalProps) {
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
    startCall(username);
  }, [resetCall, startCall, username]);

  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;

  useEffect(() => {
    startCall(username);
    // Intentionally run only on mount — startCall and username are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <VideoCall
        callState={callState}
        onEndCall={handleClose}
        onRetry={handleRetry}
        onClose={handleClose}
      />
    </motion.div>
  );
}

export function VideoCallModal({ username, onClose }: VideoCallModalProps) {
  return (
    <CVIProvider>
      <AnimatePresence>
        <VideoCallContent username={username} onClose={onClose} />
      </AnimatePresence>
    </CVIProvider>
  );
}

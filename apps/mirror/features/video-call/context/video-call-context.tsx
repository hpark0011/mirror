"use client";

import { createContext, useContext } from "react";
import type { CallState } from "../types";

type VideoCallContextValue = {
  callState: CallState;
  startCall: (username: string) => Promise<void>;
  endCall: () => void;
  resetCall: () => void;
};

const VideoCallContext = createContext<VideoCallContextValue | null>(null);

export const VideoCallProvider = VideoCallContext.Provider;

export function useVideoCallContext() {
  const context = useContext(VideoCallContext);
  if (!context)
    throw new Error(
      "useVideoCallContext must be used within VideoCallProvider",
    );
  return context;
}

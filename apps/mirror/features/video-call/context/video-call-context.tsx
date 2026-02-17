"use client";

import { createContext, useContext } from "react";
import type { CallState } from "../types";
import type { Article } from "@feel-good/tavus";

type VideoCallContextValue = {
  callState: CallState;
  startCall: (articles: Article[]) => Promise<void>;
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

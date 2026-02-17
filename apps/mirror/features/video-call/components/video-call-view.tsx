"use client";

import { useParticipantIds, DailyVideo, useLocalSessionId } from "@daily-co/daily-react";
import type { CallState } from "../types";
import { CallControls } from "./call-controls";
import { ConnectionStatus } from "./connection-status";

type VideoCallViewProps = {
  callState: CallState;
  onEndCall: () => void;
  onRetry?: () => void;
  onClose?: () => void;
};

export function VideoCallView({ callState, onEndCall, onRetry, onClose }: VideoCallViewProps) {
  const participantIds = useParticipantIds({ filter: "remote" });
  const localSessionId = useLocalSessionId();

  const isActive = callState.status === "connected";
  const showStatus = callState.status !== "connected" && callState.status !== "idle";

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      {/* Remote participant video (avatar) */}
      {isActive && participantIds.length > 0 && (
        <DailyVideo
          sessionId={participantIds[0]}
          type="video"
          fit="cover"
          className="h-full w-full object-cover"
        />
      )}

      {/* Local video PIP */}
      {isActive && localSessionId && (
        <div className="absolute bottom-24 left-4 h-[120px] w-[160px] overflow-hidden rounded-lg border border-white/20 shadow-lg">
          <DailyVideo
            sessionId={localSessionId}
            type="video"
            fit="cover"
            automirror
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Connection status overlay */}
      {showStatus && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <ConnectionStatus callState={callState} onRetry={onRetry} onClose={onClose} />
        </div>
      )}

      {/* Call controls */}
      {isActive && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <CallControls onEndCall={onEndCall} />
        </div>
      )}
    </div>
  );
}

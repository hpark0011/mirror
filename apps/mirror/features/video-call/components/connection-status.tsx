"use client";

import { Loader2 } from "lucide-react";
import type { CallState } from "../types";

type ConnectionStatusProps = {
  callState: CallState;
  onRetry?: () => void;
  onClose?: () => void;
};

export function ConnectionStatus({ callState, onRetry, onClose }: ConnectionStatusProps) {
  if (callState.status === "creating" || callState.status === "connecting") {
    return (
      <div className="flex flex-col items-center gap-3 text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">
          {callState.status === "creating" ? "Starting conversation..." : "Connecting..."}
        </p>
      </div>
    );
  }

  if (callState.status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 text-white">
        <p className="text-sm text-red-400">{callState.message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (callState.status === "ended") {
    return (
      <div className="flex flex-col items-center gap-3 text-white">
        <p className="text-sm">Call ended</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return null;
}

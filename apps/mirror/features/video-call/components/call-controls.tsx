"use client";

import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { useDaily } from "@daily-co/daily-react";
import { useState } from "react";

type CallControlsProps = {
  onEndCall: () => void;
};

export function CallControls({ onEndCall }: CallControlsProps) {
  const daily = useDaily();
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraMuted, setIsCameraMuted] = useState(false);

  const toggleMic = () => {
    daily?.setLocalAudio(isMicMuted);
    setIsMicMuted(!isMicMuted);
  };

  const toggleCamera = () => {
    daily?.setLocalVideo(isCameraMuted);
    setIsCameraMuted(!isCameraMuted);
  };

  return (
    <div className="flex items-center gap-3 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
      <button
        type="button"
        onClick={toggleMic}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
      <button
        type="button"
        onClick={toggleCamera}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        {isCameraMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
      </button>
      <button
        type="button"
        onClick={onEndCall}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
      >
        <PhoneOff className="h-5 w-5" />
      </button>
    </div>
  );
}

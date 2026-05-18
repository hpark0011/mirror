"use client";

import { useCallback, useEffect, useState } from "react";

// IntersectionObserver pauses videos that scroll out of the viewport so a
// long post list with many video covers doesn't churn through decoders.
export function useVisibilityGatedVideoPlayback() {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const [visibleVideoElement, setVisibleVideoElement] =
    useState<Element | null>(null);
  const videoRef = useCallback((element: HTMLVideoElement | null) => {
    setVideoElement(element);
  }, []);

  useEffect(() => {
    if (!videoElement || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisibleVideoElement(entry?.isIntersecting ? entry.target : null);
      },
      { rootMargin: "200px" },
    );

    observer.observe(videoElement);

    return () => {
      observer.disconnect();
    };
  }, [videoElement]);

  useEffect(() => {
    if (!videoElement) return;

    if (visibleVideoElement !== videoElement) {
      videoElement.pause();
      return;
    }

    void videoElement.play().catch(() => {
      // Muted-autoplay rejections can still happen on some browsers.
    });
  }, [visibleVideoElement, videoElement]);

  return videoRef;
}

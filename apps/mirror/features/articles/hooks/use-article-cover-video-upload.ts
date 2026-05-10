"use client";

// PLAN_010: cover-video upload pipeline. Mirrors
// `useArticleCoverImageUpload` for the MP4 + JPEG-poster pair.
//
// Flow per-call:
//   1. Validate MIME + size against the policy constants from
//      `@/lib/media-policy` (single-sourced from
//      `packages/convex/convex/content/storagePolicy.ts`).
//   2. Extract a still poster from the chosen MP4 in a hidden
//      `<video>` + `<canvas>` (frame at ~0.1s, JPEG quality 0.85).
//   3. Get the video + poster presigned upload URLs in one round-trip.
//   4. Upload both blobs in parallel.
//   5. Claim ownership for both. If ownership fails for either, fire
//      `deleteOrphanCoverVideo` to clean up the leak.
//
// The poster MUST exist before the article row is written so
// `<video poster={posterUrl}>` has a frame to show before metadata
// loads (D2 in the plan).
import { useCallback } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { uploadToStorage } from "@/lib/upload-to-storage";
import {
  ALLOWED_COVER_VIDEO_TYPES,
  MAX_COVER_VIDEO_BYTES,
} from "@/lib/media-policy";

export type CoverUploadState = "idle" | "preparing" | "uploading" | "ready";

type CoverVideoUploadProgressState = Extract<
  CoverUploadState,
  "preparing" | "uploading"
>;

type UseArticleCoverVideoUploadOptions = {
  onStateChange?: (state: CoverVideoUploadProgressState) => void;
};

export type UseArticleCoverVideoUploadReturn = {
  upload: (file: File) => Promise<{
    videoStorageId: Id<"_storage">;
    posterStorageId: Id<"_storage">;
  }>;
};

const POSTER_FRAME_SECONDS = 0.1;
const POSTER_JPEG_QUALITY = 0.85;
const POSTER_TIMEOUT_MS = 10_000;
// 1920px keeps 16:9 posters near 1080p, comfortably below the 5 MiB
// inline-image cap while avoiding full-4K canvas allocation on mobile.
const POSTER_MAX_DIMENSION = 1920;

class CoverVideoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoverVideoValidationError";
  }
}

function validateFile(file: File): void {
  if (!ALLOWED_COVER_VIDEO_TYPES.has(file.type)) {
    throw new CoverVideoValidationError(
      `Cover video must be one of ${[...ALLOWED_COVER_VIDEO_TYPES].join(", ")}`,
    );
  }
  if (file.size > MAX_COVER_VIDEO_BYTES) {
    throw new CoverVideoValidationError(
      `Cover video exceeds maximum size of ${Math.round(
        MAX_COVER_VIDEO_BYTES / (1024 * 1024),
      )} MiB`,
    );
  }
}

function waitForPosterVideoEvent(
  video: HTMLVideoElement,
  eventName: "loadedmetadata" | "seeked",
  errorMessage: string,
): Promise<void> {
  let cleanup = () => {};
  const eventPromise = new Promise<void>((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(errorMessage));
    };
    cleanup = () => {
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onEvent);
    video.addEventListener("error", onError);
  });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Video poster extraction timed out while waiting for ${eventName}`,
        ),
      );
    }, POSTER_TIMEOUT_MS);
  });

  return Promise.race([eventPromise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    cleanup();
  });
}

function getPosterCanvasSize(video: HTMLVideoElement): {
  width: number;
  height: number;
} {
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const scale = Math.min(
    1,
    POSTER_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight),
  );

  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale),
  };
}

// Render a single frame from `file` to a JPEG `Blob`. Used as the
// `<video poster>` for the cover video so the first paint isn't a
// black frame on slow networks.
//
// Implementation note: the hidden `<video>` is muted + playsInline so
// browsers don't block decode on autoplay rules; we don't actually
// play it — we just seek to a small `currentTime` and draw the next
// `seeked` event's frame onto a `<canvas>`.
async function extractPosterBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.src = url;

    await waitForPosterVideoEvent(
      video,
      "loadedmetadata",
      "Failed to load video metadata for poster extraction",
    );

    // Clamp to the actual duration if the clip is shorter than the
    // default frame seek time.
    const seekTo = Math.min(
      POSTER_FRAME_SECONDS,
      Number.isFinite(video.duration)
        ? Math.max(video.duration - 0.05, 0)
        : POSTER_FRAME_SECONDS,
    );

    const seeked = waitForPosterVideoEvent(
      video,
      "seeked",
      "Failed to seek video for poster extraction",
    );
    video.currentTime = seekTo;
    await seeked;

    const canvas = document.createElement("canvas");
    const posterSize = getPosterCanvasSize(video);
    canvas.width = posterSize.width;
    canvas.height = posterSize.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create 2D canvas context for poster encoding");
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", POSTER_JPEG_QUALITY);
    });
    if (!blob) {
      throw new Error("Failed to encode poster JPEG");
    }
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function useArticleCoverVideoUpload({
  onStateChange,
}: UseArticleCoverVideoUploadOptions = {}): UseArticleCoverVideoUploadReturn {
  const generateUploadUrls = useMutation(
    api.articles.mutations.generateArticleCoverVideoUploadUrls,
  );
  const claimVideoOwnership = useAction(
    api.articles.mutations.claimCoverVideoOwnership,
  );
  const claimPosterOwnership = useAction(
    api.articles.mutations.claimCoverVideoPosterOwnership,
  );
  const deleteOrphanCoverVideo = useMutation(
    api.articles.mutations.deleteOrphanCoverVideo,
  );

  const upload = useCallback(
    async (file: File) => {
      validateFile(file);

      // Extract poster client-side BEFORE issuing the upload URLs so
      // a poster-extraction failure doesn't leave us with a leaked
      // upload URL.
      onStateChange?.("preparing");
      const posterBlob = await extractPosterBlob(file);
      const posterFile = new File(
        [posterBlob],
        `${file.name.replace(/\.mp4$/i, "")}-poster.jpg`,
        { type: "image/jpeg" },
      );

      const { videoUrl, posterUrl } = await generateUploadUrls();

      onStateChange?.("uploading");
      const uploadController = new AbortController();
      let videoStorageId: Id<"_storage"> | undefined;
      let posterStorageId: Id<"_storage"> | undefined;
      const videoUpload = uploadToStorage(videoUrl, file, {
        signal: uploadController.signal,
      }).then((storageId) => {
        videoStorageId = storageId;
        return storageId;
      });
      const posterUpload = uploadToStorage(posterUrl, posterFile, {
        signal: uploadController.signal,
      }).then((storageId) => {
        posterStorageId = storageId;
        return storageId;
      });

      try {
        [videoStorageId, posterStorageId] = await Promise.all([
          videoUpload,
          posterUpload,
        ]);
      } catch (err) {
        uploadController.abort();
        await Promise.allSettled([videoUpload, posterUpload]);
        if (videoStorageId !== undefined || posterStorageId !== undefined) {
          deleteOrphanCoverVideo({
            ...(videoStorageId !== undefined ? { videoStorageId } : {}),
            ...(posterStorageId !== undefined ? { posterStorageId } : {}),
          }).catch((cleanupErr) => {
            console.error(
              "[cover-video-upload] orphan cleanup failed after upload error",
              cleanupErr,
            );
          });
        }
        throw err;
      }

      // Claim ownership on both blobs. If either claim fails, fire the
      // orphan-cleanup mutation server-side so the leaked blob doesn't
      // sit in `_storage` until the cron sweep.
      const [videoClaim, posterClaim] = await Promise.allSettled([
        claimVideoOwnership({ storageId: videoStorageId }),
        claimPosterOwnership({ storageId: posterStorageId }),
      ]);
      const claimError =
        videoClaim.status === "rejected"
          ? videoClaim.reason
          : posterClaim.status === "rejected"
            ? posterClaim.reason
            : null;

      if (claimError) {
        try {
          await deleteOrphanCoverVideo({
            videoStorageId,
            posterStorageId,
          });
        } catch (cleanupErr) {
          console.error(
            "[cover-video-upload] orphan cleanup failed after claim error",
            cleanupErr,
          );
        }
        throw claimError;
      }

      return { videoStorageId, posterStorageId };
    },
    [
      generateUploadUrls,
      claimVideoOwnership,
      claimPosterOwnership,
      deleteOrphanCoverVideo,
      onStateChange,
    ],
  );

  return { upload };
}

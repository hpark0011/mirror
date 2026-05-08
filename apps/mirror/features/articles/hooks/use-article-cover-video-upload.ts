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
//   3. Get TWO presigned upload URLs in parallel.
//   4. Upload both blobs in parallel.
//   5. Claim ownership for both. If ownership fails for either, fire
//      `deleteOrphanCoverVideo` to clean up the leak.
//
// The poster MUST exist before the article row is written so
// `<video poster={posterUrl}>` has a frame to show before metadata
// loads (D2 in the plan).
import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { uploadToStorage } from "@/lib/upload-to-storage";
import {
  ALLOWED_COVER_VIDEO_TYPES,
  MAX_COVER_VIDEO_BYTES,
} from "@/lib/media-policy";

export type UseArticleCoverVideoUploadReturn = {
  upload: (file: File) => Promise<{
    videoStorageId: Id<"_storage">;
    posterStorageId: Id<"_storage">;
  }>;
};

const POSTER_FRAME_SECONDS = 0.1;
const POSTER_JPEG_QUALITY = 0.85;

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

    await new Promise<void>((resolve, reject) => {
      const onLoadedMetadata = () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("error", onError);
        reject(new Error("Failed to load video metadata for poster extraction"));
      };
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("error", onError);
    });

    // Clamp to the actual duration if the clip is shorter than the
    // default frame seek time.
    const seekTo = Math.min(
      POSTER_FRAME_SECONDS,
      Number.isFinite(video.duration) ? Math.max(video.duration - 0.05, 0) : POSTER_FRAME_SECONDS,
    );

    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        reject(new Error("Failed to seek video for poster extraction"));
      };
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
      video.currentTime = seekTo;
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create 2D canvas context for poster encoding");
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        "image/jpeg",
        POSTER_JPEG_QUALITY,
      );
    });
    if (!blob) {
      throw new Error("Failed to encode poster JPEG");
    }
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function useArticleCoverVideoUpload(): UseArticleCoverVideoUploadReturn {
  const generateVideoUploadUrl = useMutation(
    api.articles.mutations.generateArticleCoverVideoUploadUrl,
  );
  const generatePosterUploadUrl = useMutation(
    api.articles.mutations.generateArticleCoverVideoPosterUploadUrl,
  );
  const claimVideoOwnership = useMutation(
    api.articles.mutations.claimCoverVideoOwnership,
  );
  const claimPosterOwnership = useMutation(
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
      const posterBlob = await extractPosterBlob(file);
      const posterFile = new File(
        [posterBlob],
        `${file.name.replace(/\.mp4$/i, "")}-poster.jpg`,
        { type: "image/jpeg" },
      );

      const [videoUrl, posterUrl] = await Promise.all([
        generateVideoUploadUrl(),
        generatePosterUploadUrl(),
      ]);

      const [videoStorageId, posterStorageId] = await Promise.all([
        uploadToStorage(videoUrl, file),
        uploadToStorage(posterUrl, posterFile),
      ]);

      // Claim ownership on both blobs. If either claim fails, fire the
      // orphan-cleanup mutation server-side so the leaked blob doesn't
      // sit in `_storage` until the cron sweep.
      try {
        await Promise.all([
          claimVideoOwnership({ storageId: videoStorageId }),
          claimPosterOwnership({ storageId: posterStorageId }),
        ]);
      } catch (err) {
        deleteOrphanCoverVideo({
          videoStorageId,
          posterStorageId,
        }).catch((cleanupErr) => {
          console.error(
            "[cover-video-upload] orphan cleanup failed after claim error",
            cleanupErr,
          );
        });
        throw err;
      }

      return { videoStorageId, posterStorageId };
    },
    [
      generateVideoUploadUrl,
      generatePosterUploadUrl,
      claimVideoOwnership,
      claimPosterOwnership,
      deleteOrphanCoverVideo,
    ],
  );

  return { upload };
}

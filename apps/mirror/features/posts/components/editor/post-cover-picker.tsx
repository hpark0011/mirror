"use client";

// Cover-image / cover-video picker for posts. Mirrors
// `articles/components/editor/cover-image-picker.tsx` — the picker is small
// and self-contained, so duplicating keeps each feature module testable in
// isolation (data-testids stay feature-specific).
import { Button } from "@feel-good/ui/primitives/button";
import { useEffect, useRef, useState } from "react";
import {
  ALLOWED_COVER_VIDEO_TYPES_ATTR,
  ALLOWED_INLINE_IMAGE_TYPES_ATTR,
} from "@/lib/media-policy";
import {
  PostCoverVideoPreview,
  activeCoverPreviewFromFile,
  activeCoverPreviewFromProps,
  type ActiveCoverPreview,
} from "./post-cover-video-preview";
import { type CoverUploadState } from "../../hooks/use-post-cover-video-upload";

const ACCEPT_ATTR = `${ALLOWED_INLINE_IMAGE_TYPES_ATTR},${ALLOWED_COVER_VIDEO_TYPES_ATTR}`;

interface PostCoverPickerProps {
  imageUrl: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  coverUploadState?: CoverUploadState;
  onUpload: (file: File) => Promise<{ kind: "image" | "video" }>;
  onClear: () => void;
  disabled?: boolean;
}

function isBusyCoverUploadState(state: CoverUploadState): boolean {
  return state === "preparing" || state === "uploading";
}

function mergeCoverUploadState({
  localState,
  parentState,
}: {
  localState: CoverUploadState;
  parentState: CoverUploadState;
}): CoverUploadState {
  if (isBusyCoverUploadState(parentState)) return parentState;
  if (isBusyCoverUploadState(localState)) return localState;
  if (parentState === "ready" || localState === "ready") return "ready";
  return "idle";
}

function uploadActionLabel(
  state: CoverUploadState,
  fallback: "Add Cover" | "Replace",
): string {
  if (state === "preparing") return "Preparing…";
  if (state === "uploading") return "Uploading…";
  return fallback;
}

export function PostCoverPicker({
  imageUrl,
  videoUrl,
  videoPosterUrl,
  coverUploadState = "idle",
  onUpload,
  onClear,
  disabled,
}: PostCoverPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const localPreviewUrlRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [active, setActive] = useState<ActiveCoverPreview>(() =>
    activeCoverPreviewFromProps(imageUrl, videoUrl, videoPosterUrl),
  );

  useEffect(() => {
    return () => {
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
        localPreviewUrlRef.current = null;
      }
    };
  }, []);

  // Re-sync when the parent's URL props change. A temporary local blob
  // preview wins only while the upload is in flight; after upload settles,
  // parent state becomes the source of truth again.
  useEffect(() => {
    if (isUploading) return;

    const nextActive = activeCoverPreviewFromProps(
      imageUrl,
      videoUrl,
      videoPosterUrl,
    );
    setActive(nextActive);

    const localPreviewUrl = localPreviewUrlRef.current;
    if (localPreviewUrl && nextActive?.url !== localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      localPreviewUrlRef.current = null;
    }
  }, [imageUrl, isUploading, videoPosterUrl, videoUrl]);

  const handleSelect = async (file: File) => {
    setIsUploading(true);
    setHasUploaded(false);
    const objectUrl = URL.createObjectURL(file);
    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
    }
    localPreviewUrlRef.current = objectUrl;
    setActive(activeCoverPreviewFromFile(file, objectUrl));
    try {
      await onUpload(file);
      setHasUploaded(true);
    } catch (err) {
      console.error("[post-cover-picker] cover upload failed", err);
      if (localPreviewUrlRef.current === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        localPreviewUrlRef.current = null;
      }
      setActive(
        activeCoverPreviewFromProps(imageUrl, videoUrl, videoPosterUrl),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const localUploadState: CoverUploadState = isUploading
    ? "uploading"
    : hasUploaded
      ? "ready"
      : "idle";
  const uploadState = mergeCoverUploadState({
    localState: localUploadState,
    parentState: coverUploadState,
  });
  const controlsDisabled =
    Boolean(disabled) ||
    isUploading ||
    isBusyCoverUploadState(coverUploadState);

  return (
    <div
      data-testid="post-cover-image-picker"
      data-cover-upload-state={uploadState}
      className="w-full"
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        disabled={controlsDisabled}
        data-testid="post-cover-image-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await handleSelect(file);
          e.target.value = "";
        }}
      />
      {active ? (
        <div className="relative w-full overflow-hidden rounded-xl [corner-shape:superellipse(1.2)]">
          {active.kind === "video" ? (
            <PostCoverVideoPreview
              url={active.url}
              posterUrl={active.posterUrl}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={active.url}
              alt="Post cover"
              className="block h-auto w-full object-contain"
            />
          )}
          <div className="absolute right-2 top-2 flex gap-1">
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={controlsDisabled}
            >
              {uploadActionLabel(uploadState, "Replace")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => {
                if (localPreviewUrlRef.current) {
                  URL.revokeObjectURL(localPreviewUrlRef.current);
                  localPreviewUrlRef.current = null;
                }
                setActive(null);
                setHasUploaded(false);
                onClear();
              }}
              disabled={controlsDisabled}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => inputRef.current?.click()}
          disabled={controlsDisabled}
          className="flex items-center gap-1"
        >
          {uploadActionLabel(uploadState, "Add Cover")}
        </Button>
      )}
    </div>
  );
}

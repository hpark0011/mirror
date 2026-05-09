"use client";

// Click-anywhere file picker with image OR video preview. Drives the
// article cover upload pipeline — the parent passes a `onUpload(file)`
// callback that resolves once both the upload and the form-state commit
// have settled, returning whether the saved cover is an image or a
// video. PLAN_010 adds the video branch alongside the existing image
// branch; the picker decides which preview element (`<img>` vs.
// `<video>`) to render based on whichever cover URL the parent passed.
import { Button } from "@feel-good/ui/primitives/button";
import { useEffect, useRef, useState } from "react";
import {
  ALLOWED_COVER_VIDEO_TYPES_ATTR,
  ALLOWED_INLINE_IMAGE_TYPES_ATTR,
} from "@/lib/media-policy";

const ACCEPT_ATTR = `${ALLOWED_INLINE_IMAGE_TYPES_ATTR},${ALLOWED_COVER_VIDEO_TYPES_ATTR}`;

type CoverKind = "image" | "video";

interface CoverImagePickerProps {
  imageUrl: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  onUpload: (file: File) => Promise<{ kind: CoverKind }>;
  onClear: () => void;
  disabled?: boolean;
}

type ActivePreview =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; posterUrl: string | null }
  | null;

function activeFromProps(
  imageUrl: string | null,
  videoUrl: string | null,
  videoPosterUrl: string | null,
): ActivePreview {
  if (videoUrl) return { kind: "video", url: videoUrl, posterUrl: videoPosterUrl };
  if (imageUrl) return { kind: "image", url: imageUrl };
  return null;
}

export function CoverImagePicker({
  imageUrl,
  videoUrl,
  videoPosterUrl,
  onUpload,
  onClear,
  disabled,
}: CoverImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [active, setActive] = useState<ActivePreview>(() =>
    activeFromProps(imageUrl, videoUrl, videoPosterUrl),
  );

  // Re-sync when the parent's URL props change (slow-arriving server
  // URL or parent-driven clear). An in-progress local blob preview
  // wins to avoid clobbering the active upload.
  useEffect(() => {
    setActive((prev) => {
      if (prev && prev.url.startsWith("blob:")) return prev;
      return activeFromProps(imageUrl, videoUrl, videoPosterUrl);
    });
  }, [imageUrl, videoUrl, videoPosterUrl]);

  const handleSelect = async (file: File) => {
    setIsUploading(true);
    setHasUploaded(false);
    const isVideo = file.type.startsWith("video/");
    const objectUrl = URL.createObjectURL(file);
    setActive(
      isVideo
        ? { kind: "video", url: objectUrl, posterUrl: null }
        : { kind: "image", url: objectUrl },
    );
    try {
      await onUpload(file);
      // Once the parent commits the new server state, the props-sync
      // effect above swaps blob: → server URL. Until then, the blob
      // preview is what the user sees — which is fine.
      setHasUploaded(true);
    } finally {
      URL.revokeObjectURL(objectUrl);
      setIsUploading(false);
    }
  };

  // Deterministic state surface for e2e tests. Flips to "ready" only
  // after the upload + form-state commit promise has settled. Replaces
  // any flaky `waitForTimeout` heuristic.
  const uploadState: "idle" | "uploading" | "ready" = isUploading
    ? "uploading"
    : hasUploaded
    ? "ready"
    : "idle";

  return (
    <div
      data-testid="article-cover-image-picker"
      data-cover-upload-state={uploadState}
      className="w-full"
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        disabled={disabled || isUploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await handleSelect(file);
          e.target.value = "";
        }}
      />
      {active
        ? (
          <div className="relative w-full overflow-hidden rounded-xl [corner-shape:superellipse(1.2)]">
            {active.kind === "video"
              ? (
                <video
                  data-testid="article-cover-video-preview"
                  src={active.url}
                  poster={active.posterUrl ?? undefined}
                  preload="metadata"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="block h-auto w-full object-contain"
                />
              )
              : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={active.url}
                  alt="Article cover"
                  className="block h-auto w-full object-contain"
                />
              )}
            <div className="absolute right-2 top-2 flex gap-1">
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || isUploading}
              >
                Replace
              </Button>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => {
                  setActive(null);
                  setHasUploaded(false);
                  onClear();
                }}
                disabled={disabled || isUploading}
              >
                Remove
              </Button>
            </div>
          </div>
        )
        : (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
            className="flex items-center gap-1"
          >
            {isUploading ? "Uploading…" : "Add Cover"}
          </Button>
        )}
    </div>
  );
}

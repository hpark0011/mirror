"use client";

import { Button } from "@feel-good/ui/primitives/button";
import { useEffect, useRef, useState } from "react";
import {
  ALLOWED_COVER_VIDEO_TYPES_ATTR,
  ALLOWED_INLINE_IMAGE_TYPES_ATTR,
} from "@/lib/media-policy";
import {
  CoverVideoPreview,
  activeCoverPreviewFromFile,
  activeCoverPreviewFromProps,
  type ActiveCoverPreview,
} from "./cover-video-preview";
import { type CoverUploadState } from "../../hooks/use-article-cover-video-upload";

const ACCEPT_ATTR = `${ALLOWED_INLINE_IMAGE_TYPES_ATTR},${ALLOWED_COVER_VIDEO_TYPES_ATTR}`;

interface CoverImagePickerProps {
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

export function CoverImagePicker({
  imageUrl,
  videoUrl,
  videoPosterUrl,
  coverUploadState = "idle",
  onUpload,
  onClear,
  disabled,
}: CoverImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [active, setActive] = useState<ActiveCoverPreview>(() =>
    activeCoverPreviewFromProps(imageUrl, videoUrl, videoPosterUrl),
  );

  useEffect(() => {
    setActive((prev) => {
      if (prev && prev.url.startsWith("blob:")) return prev;
      return activeCoverPreviewFromProps(imageUrl, videoUrl, videoPosterUrl);
    });
  }, [imageUrl, videoUrl, videoPosterUrl]);

  const handleSelect = async (file: File) => {
    setIsUploading(true);
    setHasUploaded(false);
    const objectUrl = URL.createObjectURL(file);
    setActive(activeCoverPreviewFromFile(file, objectUrl));
    try {
      await onUpload(file);
      setHasUploaded(true);
    } catch {
      URL.revokeObjectURL(objectUrl);
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
      data-testid="article-cover-image-picker"
      data-cover-upload-state={uploadState}
      className="w-full"
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        disabled={controlsDisabled}
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
            <CoverVideoPreview url={active.url} posterUrl={active.posterUrl} />
          ) : (
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
              disabled={controlsDisabled}
            >
              {uploadActionLabel(uploadState, "Replace")}
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

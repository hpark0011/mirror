"use client";

// Click-anywhere file picker with image preview. Drives the article cover
// image upload pipeline — the parent passes a `onUpload(file)` callback
// that resolves to a `_storage` ID; this component only owns the file
// input + preview UX.
import { Button } from "@feel-good/ui/primitives/button";
import { cn } from "@feel-good/utils/cn";
import { useId, useRef, useState } from "react";

interface CoverImagePickerProps {
  url: string | null;
  onUpload: (file: File) => Promise<{ url: string }>;
  onClear: () => void;
  disabled?: boolean;
}

export function CoverImagePicker({
  url,
  onUpload,
  onClear,
  disabled,
}: CoverImagePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(url);

  const handleSelect = async (file: File) => {
    setIsUploading(true);
    try {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      const result = await onUpload(file);
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(result.url);
    } finally {
      setIsUploading(false);
    }
  };

  const display = previewUrl ?? url;

  return (
    <div
      data-testid="article-cover-image-picker"
      className={cn(
        "relative w-full overflow-hidden rounded-md border border-dashed border-border",
        display ? "h-40" : "h-24",
        "bg-muted/30",
      )}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={disabled || isUploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await handleSelect(file);
        }}
      />
      {display ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={display}
            alt="Article cover"
            className="size-full object-cover"
          />
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
                setPreviewUrl(null);
                onClear();
              }}
              disabled={disabled || isUploading}
            >
              Remove
            </Button>
          </div>
        </>
      ) : (
        <label
          htmlFor={inputId}
          className="flex size-full cursor-pointer items-center justify-center text-sm text-muted-foreground"
        >
          {isUploading ? "Uploading…" : "Add cover image"}
        </label>
      )}
    </div>
  );
}

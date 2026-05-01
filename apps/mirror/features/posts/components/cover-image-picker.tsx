"use client";

import { type ChangeEvent } from "react";
import { ALLOWED_INLINE_IMAGE_TYPES_ATTR } from "@/lib/media-policy";

type CoverImagePickerProps = {
  preview: string | null;
  error: string | null;
  onChange: (file: File | null) => void;
};

export function CoverImagePicker({
  preview,
  error,
  onChange,
}: CoverImagePickerProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-foreground-muted">
        Cover image (optional)
      </label>
      <input
        type="file"
        accept={ALLOWED_INLINE_IMAGE_TYPES_ATTR}
        onChange={handleChange}
        data-testid="cover-image-input"
        className="block w-full text-sm text-foreground-muted file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80 file:cursor-pointer"
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- Local preview from object URL; not a remote asset
        <img
          src={preview}
          alt="Cover preview"
          className="rounded-md border border-border max-h-40 object-cover"
          data-testid="cover-image-preview"
        />
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

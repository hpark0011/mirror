"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ALLOWED_INLINE_IMAGE_TYPES,
  MAX_INLINE_IMAGE_BYTES,
} from "@/lib/media-policy";

/**
 * State + validation for the markdown-upload dialog's cover-image
 * picker. Extracted from `markdown-upload-dialog-connector.tsx` (FG_116)
 * to keep the connector under the ~100-line component guideline.
 *
 * The hook owns the object-URL lifecycle (revoke on change/unmount) so
 * the caller never has to think about it.
 */
export function useCoverImageState() {
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    null,
  );
  const [coverImageError, setCoverImageError] = useState<string | null>(null);

  useEffect(() => {
    if (!coverImagePreview) return;
    return () => URL.revokeObjectURL(coverImagePreview);
  }, [coverImagePreview]);

  const resetCoverImage = useCallback(() => {
    setCoverImageFile(null);
    setCoverImagePreview(null);
    setCoverImageError(null);
  }, []);

  const handleCoverImageChange = useCallback((file: File | null) => {
    setCoverImageError(null);

    if (!file) {
      setCoverImageFile(null);
      setCoverImagePreview(null);
      return;
    }

    if (!ALLOWED_INLINE_IMAGE_TYPES.has(file.type)) {
      setCoverImageFile(null);
      setCoverImagePreview(null);
      setCoverImageError("Cover image must be PNG, JPEG, or WEBP");
      return;
    }
    if (file.size > MAX_INLINE_IMAGE_BYTES) {
      setCoverImageFile(null);
      setCoverImagePreview(null);
      setCoverImageError("Cover image must be smaller than 5 MB");
      return;
    }

    setCoverImageFile(file);
    setCoverImagePreview(URL.createObjectURL(file));
  }, []);

  return {
    coverImageFile,
    coverImagePreview,
    coverImageError,
    resetCoverImage,
    handleCoverImageChange,
  };
}

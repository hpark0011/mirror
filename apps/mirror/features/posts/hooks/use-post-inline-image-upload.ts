"use client";

import { useCallback } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import {
  ALLOWED_INLINE_IMAGE_TYPES,
  MAX_INLINE_IMAGE_BYTES,
} from "@/lib/media-policy";
import { uploadToStorage } from "@/lib/upload-to-storage";

/**
 * Validation error thrown by inline image upload hooks. Distinguishes between
 * MIME-type and file-size rejections so the editor can surface a precise
 * message (FR-11). Thrown synchronously from `upload()` BEFORE any Convex
 * mutation/query is invoked — the hook is the trust boundary for client-side
 * validation.
 */
export class InlineImageValidationError extends Error {
  readonly code: "mime" | "size";
  constructor(code: "mime" | "size", message: string) {
    super(message);
    this.code = code;
    this.name = "InlineImageValidationError";
  }
}

export type UsePostInlineImageUploadReturn = {
  upload: (
    file: File,
  ) => Promise<{ storageId: Id<"_storage">; url: string }>;
};

/**
 * Inline image upload pipeline for posts. Mirror of
 * `useArticleInlineImageUpload` — see that hook for the design rationale and
 * citations.
 */
export function usePostInlineImageUpload(): UsePostInlineImageUploadReturn {
  const convex = useConvex();
  const generateUploadUrl = useMutation(
    api.posts.inlineImages.generatePostInlineImageUploadUrl,
  );

  const upload = useCallback(
    async (file: File) => {
      if (!ALLOWED_INLINE_IMAGE_TYPES.has(file.type)) {
        throw new InlineImageValidationError(
          "mime",
          "Image must be PNG, JPEG, or WEBP",
        );
      }
      if (file.size > MAX_INLINE_IMAGE_BYTES) {
        throw new InlineImageValidationError(
          "size",
          "Image must be smaller than 5 MB",
        );
      }

      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadToStorage(uploadUrl, file);
      const url = await convex.query(
        api.posts.inlineImages.getPostInlineImageUrl,
        { storageId },
      );
      if (!url) {
        throw new Error("Image upload succeeded but URL resolution failed");
      }
      return { storageId, url };
    },
    [convex, generateUploadUrl],
  );

  return { upload };
}

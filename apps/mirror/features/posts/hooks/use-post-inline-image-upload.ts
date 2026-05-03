"use client";

import { useCallback } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import {
  InlineImageValidationError,
  validateInlineImageFile,
} from "@/lib/inline-image-validation";
import { uploadToStorage } from "@/lib/upload-to-storage";

// Re-export so existing call sites keep importing the error class from the
// hook module (cross-surface `instanceof` checks share the single runtime
// class defined in `@/lib/inline-image-validation`).
export { InlineImageValidationError };

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
      validateInlineImageFile(file);

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

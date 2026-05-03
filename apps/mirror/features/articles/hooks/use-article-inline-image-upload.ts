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

export type UseArticleInlineImageUploadReturn = {
  upload: (
    file: File,
  ) => Promise<{ storageId: Id<"_storage">; url: string }>;
};

/**
 * Inline image upload pipeline for articles. Wires:
 *   (1) client-side MIME + size validation against the shared media policy,
 *   (2) `generateArticleInlineImageUploadUrl` mutation,
 *   (3) `uploadToStorage` POST to the presigned URL,
 *   (4) one-shot `getArticleInlineImageUrl` query (imperative `convex.query`,
 *       NOT `useQuery` — wrong semantics for an in-callback one-shot, see
 *       spec data-flow §8).
 *
 * Returns `{ upload(file) → { storageId, url } }` to feed the editor's upload
 * plugin. Mirrors the convention of `usePostCoverImageUpload`.
 */
export function useArticleInlineImageUpload(): UseArticleInlineImageUploadReturn {
  const convex = useConvex();
  const generateUploadUrl = useMutation(
    api.articles.inlineImages.generateArticleInlineImageUploadUrl,
  );

  const upload = useCallback(
    async (file: File) => {
      // FR-11: validate before reaching out to Convex.
      validateInlineImageFile(file);

      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadToStorage(uploadUrl, file);
      const url = await convex.query(
        api.articles.inlineImages.getArticleInlineImageUrl,
        { storageId },
      );
      if (!url) {
        // Storage write succeeded but the resulting URL came back null — the
        // blob is unrecoverable. Surface the failure; the cron sweep collects
        // the orphan.
        throw new Error("Image upload succeeded but URL resolution failed");
      }
      return { storageId, url };
    },
    [convex, generateUploadUrl],
  );

  return { upload };
}

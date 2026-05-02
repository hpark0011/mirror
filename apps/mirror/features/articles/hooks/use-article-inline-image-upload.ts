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

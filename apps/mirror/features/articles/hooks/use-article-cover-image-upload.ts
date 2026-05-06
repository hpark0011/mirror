"use client";

// Mirror of `usePostCoverImageUpload` for articles. Returns an `upload(file)`
// helper that calls the cover-image presigned URL mutation, POSTs the file
// to Convex storage, and resolves to both the `_storage` ID and the
// base64-encoded thumbhash for the caller to persist together.
import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import { uploadToStorage } from "@/lib/upload-to-storage";
import { computeThumbhashFromFile } from "../utils/compute-thumbhash";

export type UseArticleCoverImageUploadReturn = {
  upload: (file: File) => Promise<{ storageId: Id<"_storage">; thumbhash: string }>;
};

export function useArticleCoverImageUpload(): UseArticleCoverImageUploadReturn {
  const generateUploadUrl = useMutation(
    api.articles.mutations.generateArticleCoverImageUploadUrl,
  );

  const upload = useCallback(
    async (file: File) => {
      const uploadUrl = await generateUploadUrl();
      const [storageId, thumbhash] = await Promise.all([
        uploadToStorage(uploadUrl, file),
        computeThumbhashFromFile(file).catch((err) => {
          console.warn("computeThumbhashFromFile failed — LQIP will be skipped", err);
          return "";
        }),
      ]);
      return { storageId, thumbhash };
    },
    [generateUploadUrl],
  );

  return { upload };
}

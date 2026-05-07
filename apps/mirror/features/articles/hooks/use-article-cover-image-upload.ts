"use client";

// Mirror of `usePostCoverImageUpload` for articles. Returns an `upload(file)`
// helper that calls the cover-image presigned URL mutation, POSTs the file
// to Convex storage, and resolves to the `_storage` ID for the caller to
// persist via the article's `coverImageStorageId` arg.
import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { uploadToStorage } from "@/lib/upload-to-storage";

export type UseArticleCoverImageUploadReturn = {
  upload: (file: File) => Promise<Id<"_storage">>;
};

export function useArticleCoverImageUpload(): UseArticleCoverImageUploadReturn {
  const generateUploadUrl = useMutation(
    api.articles.mutations.generateArticleCoverImageUploadUrl,
  );
  const claimOwnership = useMutation(
    api.articles.mutations.claimCoverImageOwnership,
  );

  const upload = useCallback(
    async (file: File) => {
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadToStorage(uploadUrl, file);
      // Claim ownership immediately so create/update mutations recognise this
      // storageId as the caller's. Without this, the FG_147 ownership check
      // in articles.mutations.create / update rejects the storageId and the
      // save fails. First-claim-wins on the server side.
      await claimOwnership({ storageId });
      return storageId;
    },
    [generateUploadUrl, claimOwnership],
  );

  return { upload };
}

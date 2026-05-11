"use client";

// Cover-image upload pipeline for posts. Mirrors
// `useArticleCoverImageUpload`: uploads via presigned URL then claims
// ownership server-side so the create/update mutations pass FG_147's
// ownership check (first-claim-wins).
//
// Returns both the `_storage` Id and a base64-encoded thumbhash for the
// caller to persist together. Reuses the article feature's pure
// `computeThumbhashFromFile` helper — no duplicate implementation.
import { useCallback } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { uploadToStorage } from "@/lib/upload-to-storage";
import { computeThumbhashFromFile } from "@/features/articles/utils/compute-thumbhash";

export type UsePostCoverImageUploadReturn = {
  upload: (
    file: File,
  ) => Promise<{ storageId: Id<"_storage">; thumbhash: string }>;
};

export function usePostCoverImageUpload(): UsePostCoverImageUploadReturn {
  const generateUploadUrl = useMutation(
    api.posts.mutations.generatePostCoverImageUploadUrl,
  );
  const claimOwnership = useAction(
    api.posts.mutations.claimPostCoverImageOwnership,
  );
  const deleteOrphanCoverImage = useMutation(
    api.posts.mutations.deleteOrphanCoverImage,
  );

  const upload = useCallback(
    async (file: File) => {
      const uploadUrl = await generateUploadUrl();
      const [storageId, thumbhash] = await Promise.all([
        uploadToStorage(uploadUrl, file),
        computeThumbhashFromFile(file).catch((err) => {
          console.warn(
            "computeThumbhashFromFile failed — LQIP will be skipped",
            err,
          );
          return "";
        }),
      ]);
      try {
        await claimOwnership({ storageId });
      } catch (err) {
        deleteOrphanCoverImage({ storageId }).catch((cleanupErr) => {
          console.error(
            "[post-cover-image-upload] orphan cleanup failed after claim error",
            cleanupErr,
          );
        });
        throw err;
      }
      return { storageId, thumbhash };
    },
    [generateUploadUrl, claimOwnership, deleteOrphanCoverImage],
  );

  return { upload };
}

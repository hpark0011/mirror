"use client";

import { useCallback } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { uploadToStorage } from "@/lib/upload-to-storage";
import { computeThumbhashFromFile } from "@/features/articles/utils/compute-thumbhash";

export type ProjectCoverUploadResult = {
  storageId: Id<"_storage">;
  thumbhash: string;
};

export function useProjectCoverImageUpload(): {
  upload: (file: File) => Promise<ProjectCoverUploadResult>;
} {
  const generateUploadUrl = useMutation(
    api.projects.mutations.generateProjectCoverImageUploadUrl,
  );
  const claimOwnership = useAction(
    api.projects.mutations.claimProjectCoverImageOwnership,
  );

  const upload = useCallback(
    async (file: File) => {
      const uploadUrl = await generateUploadUrl();
      const [storageId, thumbhash] = await Promise.all([
        uploadToStorage(uploadUrl, file),
        computeThumbhashFromFile(file).catch((err) => {
          console.warn(
            "computeThumbhashFromFile failed; project cover LQIP skipped",
            err,
          );
          return "";
        }),
      ]);
      await claimOwnership({ storageId });
      return { storageId, thumbhash };
    },
    [claimOwnership, generateUploadUrl],
  );

  return { upload };
}

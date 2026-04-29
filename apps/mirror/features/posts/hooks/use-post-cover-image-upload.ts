"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import { uploadToStorage } from "@/lib/upload-to-storage";

export type UsePostCoverImageUploadReturn = {
  upload: (file: File) => Promise<Id<"_storage">>;
};

export function usePostCoverImageUpload(): UsePostCoverImageUploadReturn {
  const generateUploadUrl = useMutation(
    api.posts.mutations.generatePostCoverImageUploadUrl,
  );

  const upload = useCallback(
    async (file: File) => {
      const uploadUrl = await generateUploadUrl();
      return uploadToStorage(uploadUrl, file);
    },
    [generateUploadUrl],
  );

  return { upload };
}

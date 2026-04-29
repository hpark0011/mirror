"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { type JSONContent } from "@feel-good/features/editor/types";
import { api } from "@feel-good/convex/convex/_generated/api";
import { usePostCoverImageUpload } from "./use-post-cover-image-upload";

type CreatePostArgs = {
  title: string;
  slug: string;
  category: string;
  body: JSONContent;
  coverImageFile?: File | null;
};

export type UseCreatePostFromFileReturn = {
  createPost: (args: CreatePostArgs) => Promise<void>;
  isCreating: boolean;
  error: string | null;
  reset: () => void;
};

export function useCreatePostFromFile(): UseCreatePostFromFileReturn {
  const mutate = useMutation(api.posts.mutations.create);
  const { upload: uploadCoverImage } = usePostCoverImageUpload();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setIsCreating(false);
  }, []);

  const createPost = useCallback(
    async (args: CreatePostArgs) => {
      setIsCreating(true);
      setError(null);
      try {
        const coverImageStorageId = args.coverImageFile
          ? await uploadCoverImage(args.coverImageFile)
          : undefined;

        await mutate({
          title: args.title,
          slug: args.slug,
          category: args.category,
          body: args.body,
          status: "draft",
          coverImageStorageId,
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to create post";
        setError(message);
        throw e;
      } finally {
        setIsCreating(false);
      }
    },
    [mutate, uploadCoverImage],
  );

  return { createPost, isCreating, error, reset };
}

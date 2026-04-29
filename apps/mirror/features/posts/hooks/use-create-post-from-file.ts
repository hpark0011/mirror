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
  const create = useMutation(api.posts.mutations.create);
  const update = useMutation(api.posts.mutations.update);
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
        // Create the post first so a failed create can't orphan a storage object.
        const postId = await create({
          title: args.title,
          slug: args.slug,
          category: args.category,
          body: args.body,
          status: "draft",
        });

        // Attach the cover image after create succeeds. If upload/attach fails,
        // the post still exists (without a cover) and the user sees the error.
        if (args.coverImageFile) {
          const coverImageStorageId = await uploadCoverImage(
            args.coverImageFile,
          );
          await update({ id: postId, coverImageStorageId });
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to create post";
        setError(message);
        throw e;
      } finally {
        setIsCreating(false);
      }
    },
    [create, update, uploadCoverImage],
  );

  return { createPost, isCreating, error, reset };
}

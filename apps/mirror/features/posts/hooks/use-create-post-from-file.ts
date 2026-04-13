"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { type JSONContent } from "@feel-good/features/editor/types";
import { api } from "@feel-good/convex/convex/_generated/api";

type CreatePostArgs = {
  title: string;
  slug: string;
  category: string;
  body: JSONContent;
};

export type UseCreatePostFromFileReturn = {
  createPost: (args: CreatePostArgs) => Promise<void>;
  isCreating: boolean;
  error: string | null;
  reset: () => void;
};

export function useCreatePostFromFile(): UseCreatePostFromFileReturn {
  const mutate = useMutation(api.posts.mutations.create);
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
        await mutate({
          title: args.title,
          slug: args.slug,
          category: args.category,
          body: args.body,
          status: "draft",
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
    [mutate],
  );

  return { createPost, isCreating, error, reset };
}

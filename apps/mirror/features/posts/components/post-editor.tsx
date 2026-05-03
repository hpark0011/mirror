"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type JSONContent } from "@feel-good/features/editor";
import { ContentEditor } from "@/features/content/components/content-editor";
import { usePostInlineImageUpload } from "../hooks/use-post-inline-image-upload";
import type { PostSummary } from "../types";

type PostEditorProps = {
  post: PostSummary;
  username: string;
  slug: string;
};

export function PostEditor({ post, username, slug }: PostEditorProps) {
  const update = useMutation(api.posts.mutations.update);
  const { upload } = usePostInlineImageUpload();

  const handleSave = useCallback(
    async (body: JSONContent) => {
      await update({ id: post._id, body });
    },
    [post._id, update],
  );

  return (
    <ContentEditor
      title={post.title}
      initialBody={post.body}
      onSave={handleSave}
      onImageUpload={upload}
      cancelHref={`/@${username}/posts/${slug}`}
      saveTestId="save-post-btn"
    />
  );
}

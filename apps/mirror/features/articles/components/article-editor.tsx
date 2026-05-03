"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type JSONContent } from "@feel-good/features/editor";
import { ContentEditor } from "@/features/content/components/content-editor";
import { useArticleInlineImageUpload } from "../hooks/use-article-inline-image-upload";
import { type ArticleWithBody } from "../types";

type ArticleEditorProps = {
  article: ArticleWithBody;
  username: string;
  slug: string;
};

export function ArticleEditor({ article, username, slug }: ArticleEditorProps) {
  const update = useMutation(api.articles.mutations.update);
  const { upload } = useArticleInlineImageUpload();

  const handleSave = useCallback(
    async (body: JSONContent) => {
      await update({ id: article._id, body });
    },
    [article._id, update],
  );

  return (
    <ContentEditor
      title={article.title}
      initialBody={article.body}
      onSave={handleSave}
      onImageUpload={upload}
      cancelHref={`/@${username}/articles/${slug}`}
      saveTestId="save-article-btn"
    />
  );
}

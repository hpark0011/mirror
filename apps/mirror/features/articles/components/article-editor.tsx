"use client";

// Edit-existing-article host. Wraps the shared `ArticleEditorShell` with a
// server-bound form hook so Save dispatches `articles.mutations.update`
// for the loaded row. URL stays stable across saves.
import { type ArticleWithBody } from "../types";
import { useEditArticleForm } from "../hooks/use-edit-article-form";
import { ArticleEditorShell } from "./article-editor-shell";

type ArticleEditorProps = {
  article: ArticleWithBody;
  username: string;
  // `slug` arg kept for backwards-compat with the existing edit page; the
  // form hook reads slug off `article.slug`.
  slug?: string;
};

export function ArticleEditor({ article, username }: ArticleEditorProps) {
  const form = useEditArticleForm({ username, initial: article });
  return (
    <ArticleEditorShell
      title={form.title}
      slug={form.slug}
      category={form.category}
      status={form.status}
      coverImageUrl={form.coverImageUrl}
      createdAt={form.createdAt}
      publishedAt={form.publishedAt}
      onTitleChange={form.setTitle}
      onSlugChange={form.setSlug}
      onCategoryChange={form.setCategory}
      onStatusChange={form.setStatus}
      onCoverImageUpload={form.handleCoverImageUpload}
      onCoverImageClear={form.handleCoverImageClear}
      body={form.body}
      onBodyChange={form.setBody}
      onInlineImageUpload={form.onInlineImageUpload}
      onInlineImageError={form.onInlineImageError}
      onPendingUploadsChange={form.setHasPendingUploads}
      onSave={form.save}
      onPublishToggle={form.togglePublish}
      onCancel={form.cancel}
      isSaving={form.isSaving}
      hasPendingUploads={form.hasPendingUploads}
    />
  );
}

"use client";

// Host for `/articles/new`. Owns no server state; defers row creation
// until the user clicks Save (per the editor plan). On success, the form
// hook navigates to `/articles/<slug>/edit` so subsequent edits use the
// patch flow.
import { useRouter } from "next/navigation";
import { useNewArticleForm } from "../hooks/use-new-article-form";
import { ArticleEditorShell } from "./article-editor-shell";

interface NewArticleEditorProps {
  username: string;
}

export function NewArticleEditor({ username }: NewArticleEditorProps) {
  const router = useRouter();
  const form = useNewArticleForm({ username });
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
      onCancel={() => router.push(`/@${username}/articles`)}
      isSaving={form.isSaving}
      hasPendingUploads={form.hasPendingUploads}
    />
  );
}

"use client";

// Edit-existing-article host. Wraps the shared `ArticleEditorShell` with a
// server-bound form hook so Save dispatches `articles.mutations.update`
// for the loaded row. URL stays stable across saves.
import { type ArticleWithBody } from "../../types";
import { useEditArticleForm } from "../../hooks/use-edit-article-form";
import { ArticleEditorShell } from "./article-editor-shell";

type ArticleEditorProps = {
  article: ArticleWithBody;
  username: string;
};

export function ArticleEditor({ article, username }: ArticleEditorProps) {
  const articleForm = useEditArticleForm({ username, initial: article });
  return (
    <ArticleEditorShell
      form={articleForm.form}
      status={articleForm.status}
      coverImageUrl={articleForm.coverImageUrl}
      coverVideoUrl={articleForm.coverVideoUrl}
      coverVideoPosterUrl={articleForm.coverVideoPosterUrl}
      coverUploadState={articleForm.coverUploadState}
      createdAt={articleForm.createdAt}
      publishedAt={articleForm.publishedAt}
      onCoverUpload={articleForm.handleCoverUpload}
      onCoverClear={articleForm.handleCoverClear}
      body={articleForm.body}
      onBodyChange={articleForm.setBody}
      onInlineImageUpload={articleForm.onInlineImageUpload}
      onInlineImageError={articleForm.onInlineImageError}
      onPendingUploadsChange={articleForm.setHasPendingUploads}
      onSave={articleForm.save}
      onPublishToggle={articleForm.togglePublish}
      onCancel={articleForm.cancel}
      isSaving={articleForm.isSaving}
      hasPendingUploads={articleForm.hasPendingUploads}
    />
  );
}

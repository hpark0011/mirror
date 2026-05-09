"use client";

// Host for `/articles/new`. Owns no server state; defers row creation
// until the user clicks Save (per the editor plan). On success, the form
// hook navigates to `/articles/<slug>/edit` so subsequent edits use the
// patch flow.
import { useRouter } from "next/navigation";
import { useNewArticleForm } from "../../hooks/use-new-article-form";
import { ArticleEditorShell } from "./article-editor-shell";

interface NewArticleEditorProps {
  username: string;
}

export function NewArticleEditor({ username }: NewArticleEditorProps) {
  const router = useRouter();
  const articleForm = useNewArticleForm({ username });
  return (
    <ArticleEditorShell
      form={articleForm.form}
      status={articleForm.status}
      coverImageUrl={articleForm.coverImageUrl}
      coverVideoUrl={articleForm.coverVideoUrl}
      coverVideoPosterUrl={articleForm.coverVideoPosterUrl}
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
      onCancel={() => router.replace(`/@${username}/articles`)}
      isSaving={articleForm.isSaving}
      hasPendingUploads={articleForm.hasPendingUploads}
    />
  );
}

"use client";

// Host for `/posts/new`. Owns no server state; defers row creation until
// the user clicks Save. On success the form hook navigates to
// `/posts/<slug>/edit` so subsequent edits use the patch flow. Mirrors
// `articles/components/editor/new-article-editor.tsx`.
import { useRouter } from "next/navigation";
import { useNewPostForm } from "../../hooks/use-new-post-form";
import { PostEditorShell } from "./post-editor-shell";

interface NewPostEditorProps {
  username: string;
}

export function NewPostEditor({ username }: NewPostEditorProps) {
  const router = useRouter();
  const postForm = useNewPostForm({ username });
  return (
    <PostEditorShell
      form={postForm.form}
      status={postForm.status}
      coverImageUrl={postForm.coverImageUrl}
      coverVideoUrl={postForm.coverVideoUrl}
      coverVideoPosterUrl={postForm.coverVideoPosterUrl}
      coverUploadState={postForm.coverUploadState}
      createdAt={postForm.createdAt}
      publishedAt={postForm.publishedAt}
      onCoverUpload={postForm.handleCoverUpload}
      onCoverClear={postForm.handleCoverClear}
      body={postForm.body}
      onBodyChange={postForm.setBody}
      onInlineImageUpload={postForm.onInlineImageUpload}
      onInlineImageError={postForm.onInlineImageError}
      onPendingUploadsChange={postForm.setHasPendingUploads}
      onSave={postForm.save}
      onPublishToggle={postForm.togglePublish}
      onCancel={() => router.replace(`/@${username}/posts`)}
      isSaving={postForm.isSaving}
      hasPendingUploads={postForm.hasPendingUploads}
    />
  );
}

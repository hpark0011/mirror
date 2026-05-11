"use client";

// Edit-existing-post host. Wraps the shared `PostEditorShell` with a
// server-bound form hook so Save dispatches `posts.mutations.update` for
// the loaded row. Mirrors `articles/components/editor/article-editor.tsx`.
import { type PostSummary } from "../../types";
import { useEditPostForm } from "../../hooks/use-edit-post-form";
import { PostEditorShell } from "./post-editor-shell";

type PostEditorProps = {
  post: PostSummary;
  username: string;
};

export function PostEditor({ post, username }: PostEditorProps) {
  const postForm = useEditPostForm({ username, initial: post });
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
      onCancel={postForm.cancel}
      isSaving={postForm.isSaving}
      hasPendingUploads={postForm.hasPendingUploads}
    />
  );
}

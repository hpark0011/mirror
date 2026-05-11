"use client";

// Composes the post editor: metadata header on top, body editor below,
// plus a workspace-toolbar portal that hosts the fixed format toolbar AND
// the Save / Publish / Cancel actions.
//
// Used by both `/posts/new` (in-memory, defer-create) and
// `/posts/[slug]/edit` (server-bound). The form hooks pass identical
// props. Mirrors `articles/components/editor/article-editor-shell.tsx`.
import {
  ArticleRichTextEditor,
  EditorToolbar,
  type JSONContent,
  type InlineImageUploadResult,
} from "@feel-good/features/editor";
import { type UseFormReturn } from "react-hook-form";
import { PostEditorToolbar } from "@/features/posts/components/editor/post-editor-toolbar";
import { PostMetadataHeader } from "@/features/posts/components/editor/post-metadata-header";
import { type CoverUploadState } from "@/features/posts/hooks/use-post-cover-video-upload";
import {
  type PostMetadataFormData,
  type PostStatus,
} from "@/features/posts/lib/schemas/post-metadata.schema";

export interface PostEditorShellProps {
  // Metadata — title/slug/category live on the RHF form; the header binds
  // to it directly via FormField/FormMessage.
  form: UseFormReturn<PostMetadataFormData>;
  status: PostStatus;
  coverImageUrl: string | null;
  coverVideoUrl: string | null;
  coverVideoPosterUrl: string | null;
  coverUploadState: CoverUploadState;
  createdAt: number | null;
  publishedAt: number | null;
  onCoverUpload: (file: File) => Promise<{ kind: "image" | "video" }>;
  onCoverClear: () => void;

  // Body
  body: JSONContent;
  onBodyChange: (next: JSONContent) => void;
  onInlineImageUpload: (file: File) => Promise<InlineImageUploadResult>;
  onInlineImageError?: (err: unknown) => void;
  onPendingUploadsChange?: (hasPending: boolean) => void;

  // Save flow
  onSave: () => void | Promise<void>;
  /**
   * Persists the post with the toggled publish status. Throws on failure
   * so the publish-confirmation dialog can stay open and the user can
   * retry.
   */
  onPublishToggle: () => Promise<void>;
  onCancel?: () => void;
  isSaving: boolean;
  hasPendingUploads: boolean;
}

export function PostEditorShell({
  form,
  status,
  coverImageUrl,
  coverVideoUrl,
  coverVideoPosterUrl,
  coverUploadState,
  createdAt,
  publishedAt,
  onCoverUpload,
  onCoverClear,
  body,
  onBodyChange,
  onInlineImageUpload,
  onInlineImageError,
  onPendingUploadsChange,
  onSave,
  onPublishToggle,
  onCancel,
  isSaving,
  hasPendingUploads,
}: PostEditorShellProps) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <PostEditorToolbar
        status={status}
        isSaving={isSaving}
        hasPendingUploads={hasPendingUploads}
        onSave={onSave}
        onPublishToggle={onPublishToggle}
        onCancel={onCancel}
      />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-xl flex-col px-6 pt-4 pb-20">
          <PostMetadataHeader
            form={form}
            coverImageUrl={coverImageUrl}
            coverVideoUrl={coverVideoUrl}
            coverVideoPosterUrl={coverVideoPosterUrl}
            coverUploadState={coverUploadState}
            createdAt={createdAt}
            publishedAt={publishedAt}
            onCoverUpload={onCoverUpload}
            onCoverClear={onCoverClear}
          />
          <ArticleRichTextEditor
            content={body}
            onChange={onBodyChange}
            onImageUpload={onInlineImageUpload}
            onImageUploadError={onInlineImageError}
            onPendingUploadsChange={onPendingUploadsChange}
            renderToolbar={({ editor, pickInlineImage }) => (
              <div className="absolute bottom-6 inset-x-0 z-10 mx-auto flex w-fit justify-center">
                <EditorToolbar
                  editor={editor}
                  onInsertImage={pickInlineImage}
                  onError={(msg) => onInlineImageError?.(new Error(msg))}
                />
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}

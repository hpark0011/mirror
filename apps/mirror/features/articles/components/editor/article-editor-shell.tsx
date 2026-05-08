"use client";

// Composes the article editor: metadata header on top, body editor below,
// plus a workspace-toolbar portal that hosts the fixed format toolbar AND
// the Save/Cancel actions.
//
// Used by both `/articles/new` (in-memory) and `/articles/[slug]/edit`
// (server-bound). The form hooks pass identical props.
import {
  ArticleRichTextEditor,
  EditorToolbar,
  type JSONContent,
  type InlineImageUploadResult,
} from "@feel-good/features/editor";
import { type UseFormReturn } from "react-hook-form";
import { ArticleEditorToolbar } from "./article-editor-toolbar";
import { ArticleMetadataHeader } from "./article-metadata-header";
import {
  type ArticleMetadataFormData,
  type ArticleStatus,
} from "../../lib/schemas/article-metadata.schema";

export interface ArticleEditorShellProps {
  // Metadata — title/slug/category live on the RHF form; the header binds to
  // it directly via FormField/FormMessage.
  form: UseFormReturn<ArticleMetadataFormData>;
  status: ArticleStatus;
  coverImageUrl: string | null;
  createdAt: number | null;
  publishedAt: number | null;
  onCoverImageUpload: (file: File) => Promise<{
    storageId: string;
    thumbhash: string;
    url: string;
  }>;
  onCoverImageClear: () => void;

  // Body
  body: JSONContent;
  onBodyChange: (next: JSONContent) => void;
  onInlineImageUpload: (file: File) => Promise<InlineImageUploadResult>;
  onInlineImageError?: (err: unknown) => void;
  onPendingUploadsChange?: (hasPending: boolean) => void;

  // Save flow
  onSave: () => void | Promise<void>;
  /**
   * Persists the article with the toggled publish status. Throws on failure
   * so the publish-confirmation dialog can stay open and the user can retry.
   */
  onPublishToggle: () => Promise<void>;
  onCancel?: () => void;
  isSaving: boolean;
  hasPendingUploads: boolean;
  cancelHref?: string;
}

export function ArticleEditorShell({
  form,
  status,
  coverImageUrl,
  createdAt,
  publishedAt,
  onCoverImageUpload,
  onCoverImageClear,
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
}: ArticleEditorShellProps) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <ArticleEditorToolbar
        status={status}
        isSaving={isSaving}
        hasPendingUploads={hasPendingUploads}
        onSave={onSave}
        onPublishToggle={onPublishToggle}
        onCancel={onCancel}
      />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-xl flex-col px-6 pt-4 pb-20">
          <ArticleMetadataHeader
            form={form}
            coverImageUrl={coverImageUrl}
            createdAt={createdAt}
            publishedAt={publishedAt}
            onCoverImageUpload={onCoverImageUpload}
            onCoverImageClear={onCoverImageClear}
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

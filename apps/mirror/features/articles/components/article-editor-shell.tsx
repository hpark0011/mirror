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
} from "@feel-good/features/editor";
import { Button } from "@feel-good/ui/primitives/button";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import type { InlineImageUploadResult } from "@feel-good/features/editor";
import { ArticleMetadataHeader } from "./article-metadata-header";
import { ArticlePublishToggle } from "./article-publish-toggle";
import type { ArticleStatus } from "../lib/schemas/article-metadata.schema";

export interface ArticleEditorShellProps {
  // Metadata
  title: string;
  slug: string;
  category: string;
  status: ArticleStatus;
  coverImageUrl: string | null;
  createdAt: number | null;
  publishedAt: number | null;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStatusChange: (value: ArticleStatus) => void;
  onCoverImageUpload: (file: File) => Promise<{
    storageId: string;
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

export function ArticleEditorShell(props: ArticleEditorShellProps) {
  const {
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
    ...metadata
  } = props;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <WorkspaceToolbar>
        <div className="flex h-9 w-full items-center justify-end gap-2 border-b border-border-subtle px-3.5 pb-1.5">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          )}
          <ArticlePublishToggle
            status={metadata.status}
            isPending={isSaving}
            disabled={isSaving || hasPendingUploads}
            onConfirm={onPublishToggle}
          />
          <Button
            type="button"
            variant="primary"
            size="xs"
            data-testid="save-article-btn"
            className="w-12"
            onClick={() => void onSave()}
            disabled={isSaving || hasPendingUploads}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </WorkspaceToolbar>
      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-xl flex-col px-6 pt-4 pb-20">
          <ArticleMetadataHeader {...metadata} />
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

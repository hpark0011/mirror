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
    onCancel,
    isSaving,
    hasPendingUploads,
    ...metadata
  } = props;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto px-6 py-4">
        <ArticleMetadataHeader {...metadata} />
        <ArticleRichTextEditor
          content={body}
          onChange={onBodyChange}
          onImageUpload={onInlineImageUpload}
          onImageUploadError={onInlineImageError}
          onPendingUploadsChange={onPendingUploadsChange}
          renderToolbar={({ editor, pickInlineImage }) => (
            <WorkspaceToolbar>
              <div className="flex w-full items-center justify-between gap-2">
                <EditorToolbar
                  editor={editor}
                  onInsertImage={pickInlineImage}
                  onError={(msg) => onInlineImageError?.(new Error(msg))}
                />
                <div className="flex items-center gap-2">
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
                  <Button
                    type="button"
                    variant="primary"
                    size="xs"
                    data-testid="save-article-btn"
                    onClick={() => void onSave()}
                    disabled={isSaving || hasPendingUploads}
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </WorkspaceToolbar>
          )}
        />
      </div>
    </div>
  );
}

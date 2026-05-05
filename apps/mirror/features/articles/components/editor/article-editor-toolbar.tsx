"use client";

import { ArrowshapeLeftFillIcon } from "@feel-good/icons";
import { Button } from "@feel-good/ui/primitives/button";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import { ArticlePublishToggle } from "./article-publish-toggle";
import type { ArticleStatus } from "../../lib/schemas/article-metadata.schema";

export interface ArticleEditorToolbarProps {
  status: ArticleStatus;
  isSaving: boolean;
  hasPendingUploads: boolean;
  onSave: () => void | Promise<void>;
  onPublishToggle: () => Promise<void>;
  onCancel?: () => void;
}

export function ArticleEditorToolbar({
  status,
  isSaving,
  hasPendingUploads,
  onSave,
  onPublishToggle,
  onCancel,
}: ArticleEditorToolbarProps) {
  return (
    <WorkspaceToolbar>
      <div className="flex h-9 w-full items-center justify-between gap-2 border-b border-border-subtle px-3.5 pb-1.5">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Cancel"
            className="gap-1 has-[>svg]:pl-0"
          >
            <ArrowshapeLeftFillIcon className="size-4" />
            Back
          </Button>
        )}
        <div className="flex items-center gap-2">
          <ArticlePublishToggle
            status={status}
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
      </div>
    </WorkspaceToolbar>
  );
}

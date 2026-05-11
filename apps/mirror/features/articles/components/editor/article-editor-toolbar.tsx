"use client";

import { Button } from "@feel-good/ui/primitives/button";
import { useTranslation } from "react-i18next";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import { WorkspaceBackButton } from "@/features/content";
import { ArticlePublishToggle } from "./article-publish-toggle";
import { type ArticleStatus } from "../../lib/schemas/article-metadata.schema";

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
  const { t } = useTranslation();
  return (
    <WorkspaceToolbar>
      <div className="flex h-9 w-full items-center gap-2 border-b border-border-subtle px-3.5 pb-1.5 relative">
        {onCancel && (
          <WorkspaceBackButton onClick={onCancel} disabled={isSaving} />
        )}
        <div className="ml-auto flex items-center gap-1.5">
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
            {isSaving ? t("editor.saving") : t("editor.save")}
          </Button>
        </div>
      </div>
    </WorkspaceToolbar>
  );
}

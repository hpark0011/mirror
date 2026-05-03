"use client";

import Link from "next/link";
import { Button } from "@feel-good/ui/primitives/button";
import { ContentToolbarShell } from "./toolbar-shell";

type ContentEditorToolbarProps = {
  title: string;
  cancelHref: string;
  isSaving: boolean;
  hasPendingUploads: boolean;
  saveLabel: string;
  saveTestId?: string;
  onSave: () => void;
};

export function ContentEditorToolbar({
  title,
  cancelHref,
  isSaving,
  hasPendingUploads,
  saveLabel,
  saveTestId,
  onSave,
}: ContentEditorToolbarProps) {
  return (
    <ContentToolbarShell variant="detail">
      <h1 className="truncate text-sm font-medium text-foreground">
        {title}
      </h1>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="xs">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button
          variant="primary"
          size="xs"
          onClick={onSave}
          disabled={isSaving || hasPendingUploads}
          data-testid={saveTestId}
        >
          {isSaving ? "Saving..." : saveLabel}
        </Button>
      </div>
    </ContentToolbarShell>
  );
}

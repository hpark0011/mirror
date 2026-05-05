"use client";

import { useState } from "react";
import { Button } from "@feel-good/ui/primitives/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@feel-good/ui/primitives/alert-dialog";
import type { ArticleStatus } from "../lib/schemas/article-metadata.schema";

type ArticlePublishToggleProps = {
  status: ArticleStatus;
  isPending: boolean;
  disabled?: boolean;
  /**
   * Persists the article with the toggled status. Should throw on failure
   * so the dialog stays open and the user can retry.
   */
  onConfirm: () => Promise<void>;
};

export function ArticlePublishToggle({
  status,
  isPending,
  disabled,
  onConfirm,
}: ArticlePublishToggleProps) {
  const [open, setOpen] = useState(false);
  const isDraft = status === "draft";
  const buttonLabel = isDraft ? "Publish" : "Unpublish";
  const dialogTitle = isDraft
    ? "Publish this article?"
    : "Move this article back to drafts?";
  const dialogDescription = isDraft
    ? "This article will be visible to everyone."
    : "This article will be hidden from public view.";
  const confirmLabel = isPending
    ? isDraft
      ? "Publishing…"
      : "Unpublishing…"
    : buttonLabel;

  async function handleConfirm(event: React.MouseEvent) {
    event.preventDefault();
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // Keep dialog open on failure so the user can retry; the form hook
      // surfaces the error via toast.
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isPending) return;
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          data-testid="article-publish-toggle"
          disabled={disabled}
        >
          {buttonLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader className="h-10">
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {dialogDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

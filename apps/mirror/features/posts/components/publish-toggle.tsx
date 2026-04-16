"use client";

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
import type { PostSummary } from "../types";

type PublishToggleProps = {
  status: PostSummary["status"];
  isPending: boolean;
  dialogOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PublishToggle({
  status,
  isPending,
  dialogOpen,
  onOpenChange,
  onConfirm,
  onCancel,
}: PublishToggleProps) {
  const isDraft = status === "draft";
  const buttonLabel = isDraft ? "Publish" : "Unpublish";
  const dialogTitle = isDraft
    ? "Publish this post?"
    : "Move this post back to drafts?";
  const dialogDescription = isDraft
    ? "This post will be visible to everyone."
    : "This post will be hidden from public view.";
  const confirmLabel = isPending
    ? isDraft ? "Publishing…" : "Unpublishing…"
    : buttonLabel;

  return (
    <AlertDialog open={dialogOpen} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
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
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { Icon } from "@feel-good/ui/components/icon";
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
import { Button } from "@feel-good/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";

type DeletePostProps = {
  isPending: boolean;
  dialogOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeletePost({
  isPending,
  dialogOpen,
  onOpenChange,
  onConfirm,
  onCancel,
}: DeletePostProps) {
  return (
    <AlertDialog open={dialogOpen} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete post"
              data-testid="delete-post-btn"
              data-post-deleting={isPending ? "true" : "false"}
            >
              <Icon name="TrashFillIcon" />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
      <AlertDialogContent
        size="sm"
        className="data-[size=sm]:max-w-md"
      >
        <AlertDialogHeader className="mx-12 mb-4 mt-3">
          <AlertDialogTitle className="text-lg">Delete post</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this post. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            variant="outline"
            className="dark:bg-dialog"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

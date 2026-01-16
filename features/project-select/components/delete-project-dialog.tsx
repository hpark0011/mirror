"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  projectName?: string;
}

/**
 * Confirmation dialog for deleting a project.
 *
 * Displays a destructive action warning and requires explicit confirmation
 * before proceeding with project deletion.
 *
 * @param open - Controls dialog visibility
 * @param onOpenChange - Callback when dialog open state changes
 * @param onConfirm - Callback when user confirms deletion
 * @param projectName - Optional name of the project being deleted (shown in message)
 */
export function DeleteProjectDialog({
  open,
  onOpenChange,
  onConfirm,
  projectName,
}: DeleteProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className='text-sm text-muted-foreground'>
            {projectName ? (
              <>
                Are you sure you want to delete{" "}
                <strong className='text-foreground'>{projectName}</strong>? This
                action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to delete this project? This action
                cannot be undone.
              </>
            )}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant='destructive' onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

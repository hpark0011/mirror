"use client";

import { useRef, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@feel-good/ui/primitives/dialog";
import { Button } from "@feel-good/ui/primitives/button";
import { type ParsedMarkdownFile } from "../hooks/use-markdown-file-parser";
import { CoverImagePicker } from "./cover-image-picker";
import { ParsedMetadataPreview } from "./parsed-metadata-preview";

type MarkdownUploadDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  isParsing: boolean;
  parsed: ParsedMarkdownFile | null;
  parseError: string | null;
  isCreating: boolean;
  createError: string | null;
  onConfirm: () => void;
  coverImagePreview: string | null;
  coverImageError: string | null;
  onCoverImageChange: (file: File | null) => void;
};

export function MarkdownUploadDialog({
  isOpen,
  onClose,
  onFileSelect,
  isParsing,
  parsed,
  parseError,
  isCreating,
  createError,
  onConfirm,
  coverImagePreview,
  coverImageError,
  onCoverImageChange,
}: MarkdownUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }

  const error = parseError || createError;
  const isDisabled = isParsing || isCreating || !parsed;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Markdown</DialogTitle>
          <DialogDescription>
            Upload a .md file to create a new draft post.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".md"
              onChange={handleFileChange}
              className="block w-full text-sm text-foreground-muted file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
            />
          </div>

          {isParsing && (
            <p className="text-sm text-foreground-muted">Parsing file...</p>
          )}

          {parsed && <ParsedMetadataPreview parsed={parsed} />}

          <CoverImagePicker
            preview={coverImagePreview}
            error={coverImageError}
            onChange={onCoverImageChange}
          />

          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onConfirm}
            disabled={isDisabled}
            data-testid="create-post-btn"
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

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
import {
  type ImportResult,
  type ImportStatus,
} from "../hooks/use-create-post-from-file";
import { CoverImagePicker } from "./cover-image-picker";
import { ParsedMetadataPreview } from "./parsed-metadata-preview";
import { ImportResultStatus } from "./import-result-status";
import { MarkdownFileInput } from "./markdown-file-input";

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
  importStatus?: ImportStatus;
  importResult?: ImportResult | null;
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
  importStatus,
  importResult,
}: MarkdownUploadDialogProps) {
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
          <MarkdownFileInput
            isParsing={isParsing}
            onFileSelect={onFileSelect}
          />

          {parsed && <ParsedMetadataPreview parsed={parsed} />}

          <CoverImagePicker
            preview={coverImagePreview}
            error={coverImageError}
            onChange={onCoverImageChange}
          />

          <ImportResultStatus
            status={importStatus}
            result={importResult}
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

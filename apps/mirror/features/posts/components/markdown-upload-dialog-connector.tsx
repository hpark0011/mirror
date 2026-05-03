"use client";

import { useCallback, useRef } from "react";
import { usePostToolbar } from "../context/post-toolbar-context";
import { useMarkdownFileParser } from "../hooks/use-markdown-file-parser";
import { useCreatePostFromFile } from "../hooks/use-create-post-from-file";
import { useCoverImageState } from "../hooks/use-cover-image-state";
import { MarkdownUploadDialog } from "./markdown-upload-dialog";

export function MarkdownUploadDialogConnector() {
  const { isUploadDialogOpen, onCloseUploadDialog } = usePostToolbar();
  const {
    parse,
    result: parsedResult,
    error: parseError,
    isParsing,
    reset: resetParser,
  } = useMarkdownFileParser();
  const {
    createPost,
    cancelImport,
    isCreating,
    error: createError,
    importStatus,
    importResult,
    reset: resetCreator,
  } = useCreatePostFromFile();

  const isSubmittingRef = useRef(false);
  const {
    coverImageFile,
    coverImagePreview,
    coverImageError,
    resetCoverImage,
    handleCoverImageChange,
  } = useCoverImageState();

  const handleClose = useCallback(() => {
    isSubmittingRef.current = false;
    // Silence any in-flight import BEFORE resetting state — otherwise the
    // pending action can resolve and write `importStatus: "done"` /
    // `importResult` over the just-reset state, flashing stale UI past the
    // user's cancel. See FG_100.
    cancelImport();
    resetParser();
    resetCreator();
    resetCoverImage();
    onCloseUploadDialog();
  }, [
    cancelImport,
    resetParser,
    resetCreator,
    resetCoverImage,
    onCloseUploadDialog,
  ]);

  const handleConfirm = useCallback(async () => {
    if (isSubmittingRef.current || !parsedResult) return;
    isSubmittingRef.current = true;
    try {
      await createPost({
        title: parsedResult.metadata.title,
        slug: parsedResult.metadata.slug,
        category: parsedResult.metadata.category,
        body: parsedResult.jsonContent,
        coverImageFile,
      });
      resetParser();
      resetCoverImage();
      onCloseUploadDialog();
    } catch {
      // Error is already set in createError state
    } finally {
      isSubmittingRef.current = false;
    }
  }, [
    parsedResult,
    createPost,
    coverImageFile,
    resetParser,
    resetCoverImage,
    onCloseUploadDialog,
  ]);

  return (
    <MarkdownUploadDialog
      isOpen={isUploadDialogOpen}
      onClose={handleClose}
      onFileSelect={parse}
      isParsing={isParsing}
      parsed={parsedResult}
      parseError={parseError}
      isCreating={isCreating}
      createError={createError}
      onConfirm={handleConfirm}
      coverImagePreview={coverImagePreview}
      coverImageError={coverImageError}
      onCoverImageChange={handleCoverImageChange}
      importStatus={importStatus}
      importResult={importResult}
    />
  );
}

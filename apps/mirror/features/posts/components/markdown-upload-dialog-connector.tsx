"use client";

import { useCallback, useRef } from "react";
import { usePostToolbar } from "../context/post-toolbar-context";
import { useMarkdownFileParser } from "../hooks/use-markdown-file-parser";
import { useCreatePostFromFile } from "../hooks/use-create-post-from-file";
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
  const { createPost, isCreating, error: createError, reset: resetCreator } =
    useCreatePostFromFile();

  const isSubmittingRef = useRef(false);

  const handleClose = useCallback(() => {
    isSubmittingRef.current = false;
    resetParser();
    resetCreator();
    onCloseUploadDialog();
  }, [resetParser, resetCreator, onCloseUploadDialog]);

  const handleConfirm = useCallback(async () => {
    if (isSubmittingRef.current || !parsedResult) return;
    isSubmittingRef.current = true;
    try {
      await createPost({
        title: parsedResult.metadata.title,
        slug: parsedResult.metadata.slug,
        category: parsedResult.metadata.category,
        body: parsedResult.jsonContent,
      });
      resetParser();
      onCloseUploadDialog();
    } catch {
      // Error is already set in createError state
    } finally {
      isSubmittingRef.current = false;
    }
  }, [parsedResult, createPost, resetParser, onCloseUploadDialog]);

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
    />
  );
}

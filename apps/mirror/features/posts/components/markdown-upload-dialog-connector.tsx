"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALLOWED_INLINE_IMAGE_TYPES,
  MAX_INLINE_IMAGE_BYTES,
} from "@/lib/media-policy";
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
  const {
    createPost,
    isCreating,
    error: createError,
    importStatus,
    importResult,
    reset: resetCreator,
  } = useCreatePostFromFile();

  const isSubmittingRef = useRef(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    null,
  );
  const [coverImageError, setCoverImageError] = useState<string | null>(null);

  // Revoke any object URL when it changes or on unmount
  useEffect(() => {
    if (!coverImagePreview) return;
    return () => URL.revokeObjectURL(coverImagePreview);
  }, [coverImagePreview]);

  const resetCoverImage = useCallback(() => {
    setCoverImageFile(null);
    setCoverImagePreview(null);
    setCoverImageError(null);
  }, []);

  const handleCoverImageChange = useCallback((file: File | null) => {
    setCoverImageError(null);

    if (!file) {
      setCoverImageFile(null);
      setCoverImagePreview(null);
      return;
    }

    if (!ALLOWED_INLINE_IMAGE_TYPES.has(file.type)) {
      setCoverImageFile(null);
      setCoverImagePreview(null);
      setCoverImageError("Cover image must be PNG, JPEG, or WEBP");
      return;
    }
    if (file.size > MAX_INLINE_IMAGE_BYTES) {
      setCoverImageFile(null);
      setCoverImagePreview(null);
      setCoverImageError("Cover image must be smaller than 5 MB");
      return;
    }

    setCoverImageFile(file);
    setCoverImagePreview(URL.createObjectURL(file));
  }, []);

  const handleClose = useCallback(() => {
    isSubmittingRef.current = false;
    resetParser();
    resetCreator();
    resetCoverImage();
    onCloseUploadDialog();
  }, [resetParser, resetCreator, resetCoverImage, onCloseUploadDialog]);

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

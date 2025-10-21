"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { uploadFileAction } from "@/app/_actions/file-actions";
import { validateFile, formatFileSize } from "@/lib/schema/file.schema";
import type { FileUploadProgress } from "@/types/file.types";

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileUploadDialog({
  open,
  onOpenChange,
}: FileUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>(
    []
  );
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(
    new Map()
  );

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const incomingFiles = Array.from(files);
    const validFiles: File[] = [];

    setValidationErrors((prevErrors) => {
      const updatedErrors = new Map(prevErrors);

      incomingFiles.forEach((file) => {
        const validation = validateFile(file);
        if (!validation.valid && validation.error) {
          updatedErrors.set(file.name, validation.error);
        } else {
          updatedErrors.delete(file.name);
          validFiles.push(file);
        }
      });

      return updatedErrors;
    });

    setSelectedFiles((prevFiles) => {
      const existingNames = new Set(prevFiles.map((file) => file.name));
      const nextFiles = [...prevFiles];

      validFiles.forEach((file) => {
        if (!existingNames.has(file.name)) {
          nextFiles.push(file);
          existingNames.add(file.name);
        }
      });

      return nextFiles;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || isUploading) return;

    setIsUploading(true);
    const progress: FileUploadProgress[] = selectedFiles.map((file) => ({
      file,
      status: "pending" as const,
      progress: 0,
    }));
    setUploadProgress(progress);

    const uploadResults: FileUploadProgress[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const progressItem = {
        ...progress[i],
        status: "uploading" as const,
        progress: 50,
      };

      // Update progress for current file
      setUploadProgress(() => [
        ...uploadResults,
        progressItem,
        ...progress.slice(i + 1),
      ]);

      try {
        const result = await uploadFileAction({ file });

        if (result.success && result.data) {
          uploadResults.push({
            ...progressItem,
            status: "success",
            progress: 100,
            result: result.data,
          });
        } else {
          uploadResults.push({
            ...progressItem,
            status: "error",
            progress: 100,
            error: result.message || "Upload failed",
          });
        }
      } catch (error) {
        uploadResults.push({
          ...progressItem,
          status: "error",
          progress: 100,
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }

      // Update progress with result
      setUploadProgress([...uploadResults, ...progress.slice(i + 1)]);
    }

    setIsUploading(false);

    // Check if all uploads succeeded
    const allSuccess = uploadResults.every((r) => r.status === "success");

    if (allSuccess) {
      // Reset and close dialog after a short delay to show success
      setTimeout(() => {
        setSelectedFiles([]);
        setUploadProgress([]);
        setValidationErrors(new Map());
        onOpenChange(false);
      }, 1000);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((files) => files.filter((_, i) => i !== index));
    // Also clear any validation error for this file
    if (selectedFiles[index]) {
      const newErrors = new Map(validationErrors);
      newErrors.delete(selectedFiles[index].name);
      setValidationErrors(newErrors);
    }
  };

  // Reset dialog state when closed
  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedFiles([]);
      setUploadProgress([]);
      setValidationErrors(new Map());
      setIsUploading(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-[600px] max-h-[calc(100vh-32px)] flex flex-col overflow-hidden'>
        <DialogHeader className='flex-shrink-0'>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription className='sr-only'>
            Select files from your computer or drag and drop them here
          </DialogDescription>
        </DialogHeader>

        <DialogBody className='space-y-4 flex-1 overflow-y-auto min-h-0'>
          <input
            ref={fileInputRef}
            type='file'
            multiple
            accept='.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif'
            className='hidden'
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={isUploading}
          />

          {/* Show validation errors if any */}
          {validationErrors.size > 0 && (
            <div className='bg-destructive/10 border border-destructive/20 rounded-lg p-3'>
              <p className='text-sm font-medium text-destructive mb-2'>
                Some files could not be added:
              </p>
              <ul className='space-y-1'>
                {Array.from(validationErrors.entries()).map(
                  ([filename, error]) => (
                    <li key={filename} className='text-xs text-destructive/90'>
                      <span className='font-medium'>{filename}:</span> {error}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {/* Upload input area */}
          {selectedFiles.length === 0 && (
            <div
              className={cn(
                "rounded-lg p-8 text-center transition-colors flex flex-col justify-center items-center",
                "hover:bg-white w-[calc(100%+8px)] ml-[-4px] h-[200px] cursor-pointer",
                isDragging && "border-primary bg-primary/5"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className='flex flex-col items-center gap-3 cursor-pointer'>
                <Icon name='DocTextLightIcon' className='w-10 h-10' />
                <div>
                  <p className='text-sm font-medium'>
                    Click to upload or drag and drop
                  </p>
                  <p className='text-xs text-muted-foreground mt-1'>
                    PDF, Word documents, text files, and images (Max 50MB)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Show upload progress when uploading */}
          {isUploading && uploadProgress.length > 0 && (
            <div className='flex flex-col space-y-2 flex-1 min-h-0'>
              <p className='text-sm font-medium flex-shrink-0'>
                Uploading files...
              </p>
              <div className='overflow-y-auto space-y-2 flex-1 min-h-0'>
                {uploadProgress.map((item, index) => (
                  <div
                    key={index}
                    className='flex items-center gap-2 p-2 bg-muted/30 rounded-lg'
                  >
                    <Icon
                      name={
                        item.status === "success"
                          ? "CheckCircleIcon"
                          : item.status === "error"
                            ? "ExclamationmarkTriangleFillIcon"
                            : item.status === "uploading"
                              ? "ArrowUpIcon"
                              : "ClockFillIcon"
                      }
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        item.status === "success" && "text-green-600",
                        item.status === "error" && "text-destructive",
                        item.status === "uploading" &&
                          "text-primary animate-pulse",
                        item.status === "pending" && "text-muted-foreground"
                      )}
                    />
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm truncate'>{item.file.name}</p>
                      {item.error && (
                        <p className='text-xs text-destructive'>{item.error}</p>
                      )}
                      {item.status === "uploading" && (
                        <div className='mt-1 h-1 bg-muted rounded-full overflow-hidden'>
                          <div
                            className='h-full bg-primary transition-all duration-300'
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show selected files when not uploading */}
          {!isUploading && selectedFiles.length > 0 && (
            <div className='flex flex-col space-y-2 flex-1 min-h-0'>
              <p className='text-sm font-medium flex-shrink-0'>
                Selected files ({selectedFiles.length})
              </p>
              <div className='overflow-y-auto space-y-2 flex-1 min-h-0'>
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between p-2 bg-muted/30 rounded-lg'
                  >
                    <div className='flex items-center gap-2 flex-1 min-w-0'>
                      <Icon
                        name='PaperClipIcon'
                        className='w-4 h-4 text-muted-foreground flex-shrink-0'
                      />
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm truncate'>{file.name}</p>
                        <p className='text-xs text-muted-foreground'>
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className='flex-shrink-0 h-8 w-8 p-0'
                      disabled={isUploading}
                    >
                      <Icon name='XmarkIcon' className='w-4 h-4' />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className='w-full flex-shrink-0'
              >
                Add file
              </Button>
            </div>
          )}
        </DialogBody>

        <DialogFooter className='flex-shrink-0'>
          <Button
            variant='ghost'
            onClick={() => handleClose(false)}
            size='sm'
            disabled={isUploading}
          >
            {isUploading ? "Close" : "Cancel"}
          </Button>
          <Button
            variant='primary'
            size='sm'
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Icon
                  name='ArrowUpIcon'
                  className='w-4 h-4 mr-1 animate-pulse'
                />
                Uploading...
              </>
            ) : (
              <>
                Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

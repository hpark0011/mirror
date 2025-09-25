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

  const handleFileSelect = (files: FileList | null) => {
    if (files) {
      setSelectedFiles(Array.from(files));
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
    if (selectedFiles.length === 0) return;

    console.log("Uploading files:", selectedFiles);

    setSelectedFiles([]);
    onOpenChange(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((files) => files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " bytes";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Select files from your computer or drag and drop them here
          </DialogDescription>
        </DialogHeader>

        <DialogBody className='space-y-4'>
          <div
            className={cn(
              "border-[2px] border-dashed rounded-lg p-8 text-center transition-colors",
              "hover:border-primary/50 hover:bg-muted/30 w-[calc(100%+8px)] ml-[-4px]",
              isDragging && "border-primary bg-primary/5"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className='flex flex-col items-center gap-3 cursor-pointer'>
              <div className='p-3 bg-muted rounded-lg'>
                <Icon
                  name='PaperClipIcon'
                  className='w-6 h-6 text-muted-foreground'
                />
              </div>
              <div>
                <p className='text-sm font-medium'>
                  Click to upload or drag and drop
                </p>
                <p className='text-xs text-muted-foreground mt-1'>
                  PDF, DOC, TXT, or any other document format
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type='file'
              multiple
              className='hidden'
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className='space-y-2'>
              <p className='text-sm font-medium'>
                Selected files ({selectedFiles.length})
              </p>
              <div className='max-h-[200px] overflow-y-auto space-y-2'>
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
                    >
                      <Icon name='XmarkIcon' className='w-4 h-4' />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant='ghost' onClick={() => onOpenChange(false)} size='sm'>
            Cancel
          </Button>
          <Button
            variant='primary'
            size='sm'
            onClick={handleUpload}
            disabled={selectedFiles.length === 0}
          >
            Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  getFilesAction,
  deleteFileAction,
  getFileUrlAction,
} from "@/app/_actions/file-actions";
import { formatFileSize, getFileCategory } from "@/lib/schema/file.schema";
import type { FileRow } from "@/types/file.types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FilesListProps {
  refreshTrigger?: number; // Optional prop to trigger refresh from parent
  onFileSelect?: (file: FileRow) => void;
  view?: "grid" | "list";
}

export function FilesList({
  refreshTrigger,
  onFileSelect,
  view = "grid",
}: FilesListProps) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(
    null
  );

  // Fetch files on mount and when refreshTrigger changes
  useEffect(() => {
    fetchFiles();
  }, [refreshTrigger]);

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getFilesAction({});

      if (result.success && result.data) {
        setFiles(result.data.files);
      } else {
        setError(result.message || "Failed to load files");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error fetching files:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteFileId) return;

    setIsDeletingFile(true);
    try {
      const result = await deleteFileAction({ fileId: deleteFileId });

      if (result.success) {
        // Remove file from list
        setFiles(files.filter((f) => f.id !== deleteFileId));
        setDeleteFileId(null);
      } else {
        setError(result.message || "Failed to delete file");
      }
    } catch (err) {
      setError("Failed to delete file");
      console.error("Error deleting file:", err);
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleDownload = async (file: FileRow) => {
    setDownloadingFileId(file.id);
    try {
      const result = await getFileUrlAction({ fileId: file.id });

      if (result.success && result.data) {
        // Create a temporary link and trigger download
        const link = document.createElement("a");
        link.href = result.data.url;
        link.download = file.original_name;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setError(result.message || "Failed to generate download link");
      }
    } catch (err) {
      setError("Failed to download file");
      console.error("Error downloading file:", err);
    } finally {
      setDownloadingFileId(null);
    }
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return "DocTextLightIcon";

    const category = getFileCategory(mimeType);
    switch (category) {
      case "image":
        return "DocImageLightIcon";
      case "document":
        if (mimeType.includes("pdf")) return "DocPdfLightIcon";
        if (mimeType.includes("word")) return "DocTextLightIcon";
        return "DocTextLightIcon";
      default:
        return "DocTextLightIcon";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          view === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-2"
        )}
      >
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className={view === "grid" ? "h-32" : "h-16"} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <Icon
          name='ExclamationmarkTriangleFillIcon'
          className='w-12 h-12 text-destructive mb-4'
        />
        <p className='text-sm text-muted-foreground mb-4'>{error}</p>
        <Button onClick={fetchFiles} size='sm' variant='ghost'>
          Try Again
        </Button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-16 px-4'>
        <div className='p-4 bg-muted/30 rounded-full mb-4'>
          <Icon
            name='DocTextLightIcon'
            className='w-12 h-12 text-muted-foreground'
          />
        </div>
        <h3 className='text-lg font-medium mb-2'>No files uploaded</h3>
        <p className='text-sm text-muted-foreground text-center max-w-sm'>
          Upload your first file to get started. Your files will appear here.
        </p>
      </div>
    );
  }

  if (view === "list") {
    return (
      <>
        <div className='space-y-2'>
          {files.map((file) => (
            <div
              key={file.id}
              className='flex items-center gap-4 p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors'
            >
              <Icon
                name={getFileIcon(file.mime_type)}
                className='w-10 h-10 text-muted-foreground flex-shrink-0'
              />
              <div className='flex-1 min-w-0'>
                <p className='font-medium text-sm truncate'>{file.name}</p>
                <div className='flex items-center gap-4 text-xs text-muted-foreground mt-1'>
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{formatDate(file.created_at)}</span>
                </div>
              </div>
              <div className='flex items-center gap-1'>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => handleDownload(file)}
                  disabled={downloadingFileId === file.id}
                  className='h-8 w-8 p-0'
                >
                  {downloadingFileId === file.id ? (
                    <Icon
                      name='ArrowDownIcon'
                      className='w-4 h-4 animate-pulse'
                    />
                  ) : (
                    <Icon name='ArrowDownIcon' className='w-4 h-4' />
                  )}
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => setDeleteFileId(file.id)}
                  className='h-8 w-8 p-0 hover:text-destructive'
                >
                  <Icon name='TrashIcon' className='w-4 h-4' />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog
          open={!!deleteFileId}
          onOpenChange={() => setDeleteFileId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete File</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this file? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingFile}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeletingFile}
                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              >
                {isDeletingFile ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Grid view
  return (
    <>
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
        {files.map((file) => (
          <div
            key={file.id}
            className={cn(
              "group relative bg-card border rounded-lg p-4 hover:shadow-md transition-all",
              onFileSelect && "cursor-pointer hover:border-primary/50"
            )}
            onClick={() => onFileSelect?.(file)}
          >
            <div className='flex items-start justify-between mb-3'>
              <div className='p-2 bg-muted/50 rounded-lg'>
                <Icon
                  name={getFileIcon(file.mime_type)}
                  className='w-8 h-8 text-muted-foreground'
                />
              </div>
              <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(file);
                  }}
                  disabled={downloadingFileId === file.id}
                  className='h-7 w-7 p-0'
                >
                  {downloadingFileId === file.id ? (
                    <Icon
                      name='ArrowDownIcon'
                      className='w-3.5 h-3.5 animate-pulse'
                    />
                  ) : (
                    <Icon name='ArrowDownIcon' className='w-3.5 h-3.5' />
                  )}
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteFileId(file.id);
                  }}
                  className='h-7 w-7 p-0 hover:text-destructive'
                >
                  <Icon name='TrashIcon' className='w-3.5 h-3.5' />
                </Button>
              </div>
            </div>

            <h4 className='font-medium text-sm mb-1 truncate' title={file.name}>
              {file.name}
            </h4>

            <p
              className='text-xs text-muted-foreground truncate'
              title={file.original_name}
            >
              {file.original_name}
            </p>

            <div className='flex items-center justify-between mt-3 text-xs text-muted-foreground'>
              <span>{formatFileSize(file.size)}</span>
              <span>{new Date(file.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteFileId}
        onOpenChange={() => setDeleteFileId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFile}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeletingFile}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isDeletingFile ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

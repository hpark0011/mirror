"use client";

import {
  deleteFileAction,
  getFilesAction,
  getFileUrlAction,
} from "@/app/_actions/file-actions";
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
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { FileRow } from "@/types/file.types";
import { useEffect, useState } from "react";
import { DataTable } from "./data-table";
import { createColumns } from "./columns";

interface FilesListProps {
  refreshTrigger?: number; // Optional prop to trigger refresh from parent
}

export function FilesList({ refreshTrigger }: FilesListProps) {
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

  const handleBulkDownload = async (selectedFiles: FileRow[]) => {
    for (const file of selectedFiles) {
      await handleDownload(file);
      // Add a small delay between downloads to avoid overwhelming the browser
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  const handleBulkDelete = async (selectedFiles: FileRow[]) => {
    const fileIds = selectedFiles.map((f) => f.id);
    const confirmMessage = `Are you sure you want to delete ${fileIds.length} file(s)? This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeletingFile(true);
    try {
      // Delete all files sequentially
      const results = await Promise.all(
        fileIds.map((fileId) => deleteFileAction({ fileId }))
      );

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        // Remove successfully deleted files from list
        setFiles(files.filter((f) => !fileIds.includes(f.id)));
      }

      if (failCount > 0) {
        setError(`Failed to delete ${failCount} file(s)`);
      }
    } catch (err) {
      setError("Failed to delete files");
      console.error("Error deleting files:", err);
    } finally {
      setIsDeletingFile(false);
    }
  };

  const columns = createColumns(handleDownload, setDeleteFileId, downloadingFileId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading files...</p>
        </div>
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
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="p-4 bg-muted/30 rounded-full mb-4">
          <Icon
            name="DocTextLightIcon"
            className="w-12 h-12 text-muted-foreground"
          />
        </div>
        <h3 className="text-lg font-medium mb-2">No files uploaded</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Upload your first file to get started. Your files will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={files}
        onBulkDelete={handleBulkDelete}
        onBulkDownload={handleBulkDownload}
      />

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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingFile ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

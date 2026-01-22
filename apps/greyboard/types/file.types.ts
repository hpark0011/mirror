import { Database } from '@/types/database.types';

// Extract file types from database
export type FileTable = Database['public']['Tables']['files'];
export type FileRow = FileTable['Row'];
export type FileInsert = FileTable['Insert'];
export type FileUpdate = FileTable['Update'];

// File upload response
export interface FileUploadResponse {
  success: boolean;
  data?: FileRow;
  message?: string;
}

// Multiple files upload response
export interface MultipleFileUploadResponse {
  success: boolean;
  data?: {
    uploaded: FileRow[];
    failed: Array<{
      filename: string;
      error: string;
    }>;
  };
  message?: string;
}

// File deletion response
export interface FileDeleteResponse {
  success: boolean;
  message?: string;
}

// Files list response
export interface FilesListResponse {
  success: boolean;
  data?: {
    files: FileRow[];
    total: number;
    hasMore: boolean;
  };
  message?: string;
}

// File URL response
export interface FileUrlResponse {
  success: boolean;
  data?: {
    url: string;
  };
  message?: string;
}

// Storage usage response
export interface StorageUsageResponse {
  success: boolean;
  data?: {
    used: number;
    limit: number;
    percentage: number;
  };
  message?: string;
}

// File categories for UI
export type FileCategory = 'document' | 'image' | 'other';

// File status for upload tracking
export type FileUploadStatus = 'pending' | 'uploading' | 'success' | 'error';

// File upload progress
export interface FileUploadProgress {
  file: File;
  status: FileUploadStatus;
  progress: number;
  error?: string;
  result?: FileRow;
}

// File filter options
export interface FileFilterOptions {
  search?: string;
  mimeType?: string;
  category?: FileCategory;
  sortBy?: 'created_at' | 'name' | 'size';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// File display info (for UI components)
export interface FileDisplayInfo extends FileRow {
  icon: string;
  category: FileCategory;
  formattedSize: string;
  extension: string;
}

// Drag and drop state
export interface DragAndDropState {
  isDragging: boolean;
  draggedFiles: File[];
  isValidDrop: boolean;
}

// File selection state
export interface FileSelectionState {
  selectedFiles: Set<string>; // Set of file IDs
  lastSelected: string | null;
  selectAll: boolean;
}

// Batch operations
export interface BatchOperation {
  type: 'delete' | 'download';
  fileIds: string[];
  status: 'idle' | 'processing' | 'success' | 'error';
  progress: number;
  error?: string;
}
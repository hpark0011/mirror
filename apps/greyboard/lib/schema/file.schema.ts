import { z } from 'zod';

// Maximum file size: 50MB
const MAX_FILE_SIZE = 52428800;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif'
] as const;

// File validation schema
const fileSchema = z.custom<File>(
  (file) => file instanceof File,
  { message: 'Invalid file object' }
).refine(
  (file) => file.size <= MAX_FILE_SIZE,
  { message: 'File size exceeds 50MB limit' }
).refine(
  (file) => !file.type || ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number]),
  { message: 'File type not allowed' }
);

// Schema for file upload action
export const fileUploadSchema = z.object({
  file: fileSchema
});

// Schema for multiple file uploads
export const multipleFileUploadSchema = z.object({
  files: z.array(fileSchema).min(1, 'At least one file is required').max(10, 'Maximum 10 files at once')
});

// Schema for file deletion
export const fileDeleteSchema = z.object({
  fileId: z.string().uuid('Invalid file ID')
});

// Schema for getting file URL
export const fileUrlSchema = z.object({
  fileId: z.string().uuid('Invalid file ID'),
  expiresIn: z.number().min(60).max(604800).optional() // 1 minute to 1 week
});

// Schema for file search/filter
export const fileFilterSchema = z.object({
  search: z.string().optional(),
  mimeType: z.enum([...ALLOWED_MIME_TYPES, '']).optional(),
  sortBy: z.enum(['created_at', 'name', 'size']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

// Type exports
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type MultipleFileUploadInput = z.infer<typeof multipleFileUploadSchema>;
export type FileDeleteInput = z.infer<typeof fileDeleteSchema>;
export type FileUrlInput = z.infer<typeof fileUrlSchema>;
export type FileFilterInput = z.infer<typeof fileFilterSchema>;

// Utility function to validate file on client side
export function validateFile(file: File): { valid: boolean; error?: string } {
  try {
    fileSchema.parse(file);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.issues[0]?.message || 'Invalid file' };
    }
    return { valid: false, error: 'File validation failed' };
  }
}

// Utility function to validate multiple files
export function validateFiles(files: File[]): { valid: boolean; errors: Map<string, string> } {
  const errors = new Map<string, string>();
  
  if (files.length === 0) {
    errors.set('general', 'No files selected');
    return { valid: false, errors };
  }
  
  if (files.length > 10) {
    errors.set('general', 'Maximum 10 files can be uploaded at once');
    return { valid: false, errors };
  }
  
  files.forEach((file) => {
    const result = validateFile(file);
    if (!result.valid && result.error) {
      errors.set(file.name, result.error);
    }
  });
  
  return { valid: errors.size === 0, errors };
}

// Helper to format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Helper to get file extension
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

// Helper to get file type category
export function getFileCategory(mimeType: string): 'document' | 'image' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('text')) return 'document';
  return 'other';
}
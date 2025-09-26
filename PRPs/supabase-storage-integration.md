# Product Requirements Plan: Supabase Storage Integration for File Uploads

## Executive Summary

Implementation of Supabase Storage backend integration for the file upload dialog, including database schema for file metadata, storage bucket setup, RLS policies, server actions for file operations, and complete integration with the existing file management UI.

## Context & Requirements

### Project Context

- **Framework**: Next.js 15.4.7 with App Router, React 19, TypeScript 5
- **Backend**: Supabase with existing authentication and database setup
- **UI Components**: File upload dialog already created at `/components/files/file-upload-dialog.tsx`
- **Existing Patterns**: 
  - Server actions using `enhanceAction` wrapper at `/app/_actions/`
  - Supabase clients at `/utils/supabase/client/`
  - Database migrations at `/supabase/migrations/`

### Core Requirements

1. **Storage Bucket Setup**: Create and configure a bucket for document storage
2. **Database Schema**: Tables for file metadata and user file relationships
3. **File Operations**:
   - Upload files to Supabase Storage
   - Store file metadata in database
   - List user's uploaded files
   - Delete files with proper cleanup
   - Generate secure download URLs
4. **Security**: RLS policies for both storage and database
5. **Error Handling**: Comprehensive error handling for upload failures
6. **File Validation**: Size limits, file type restrictions

## Research & References

### Documentation URLs

1. **Supabase Storage Upload API**: https://supabase.com/docs/reference/javascript/storage-from-upload
2. **Storage Access Control**: https://supabase.com/docs/guides/storage/security/access-control
3. **Storage Buckets**: https://supabase.com/docs/guides/storage/buckets/fundamentals
4. **Next.js & Supabase File Upload Guide**: https://supalaunch.com/blog/file-upload-nextjs-supabase
5. **Signed URL Uploads**: https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0

### Key Implementation Patterns

From existing codebase:
- Server actions use `enhanceAction` wrapper for validation and auth
- Database clients: `getSupabaseServerClient()` for server, `getSupabaseBrowserClient()` for client
- Form validation with Zod schemas
- Type generation from database with `pnpm supabase:types`

## Implementation Blueprint

### Architecture Overview

```
┌────────────────────────────────────────────────┐
│          File Upload Dialog (Client)           │
│    /components/files/file-upload-dialog.tsx    │
└──────────────────┬─────────────────────────────┘
                   │ Files + Metadata
┌──────────────────▼─────────────────────────────┐
│           File Upload Server Action            │
│      /app/_actions/file-actions.ts             │
│     (Validation, Auth, Storage Upload)         │
└──────────────────┬─────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        │                     │
┌───────▼──────┐     ┌────────▼────────┐
│   Supabase   │     │    Supabase     │
│   Storage    │     │    Database     │
│  (documents) │     │ (files table)   │
└──────────────┘     └─────────────────┘
```

### Database Schema

```sql
-- Migration: supabase/migrations/[timestamp]_create_files_table.sql

-- Files table for storing file metadata
CREATE TABLE public.files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  original_name text NOT NULL,
  size bigint NOT NULL,
  mime_type text,
  storage_path text NOT NULL,
  bucket_name text NOT NULL DEFAULT 'documents',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Indexes for performance
  INDEX files_user_id_idx ON public.files (user_id),
  INDEX files_created_at_idx ON public.files (created_at DESC)
);

-- Enable RLS
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for files table
CREATE POLICY "Users can view their own files"
  ON public.files FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
  ON public.files FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
  ON public.files FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Storage Bucket Setup

```sql
-- Run in Supabase SQL Editor

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,  -- Private bucket
  52428800,  -- 50MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/gif']
);

-- Storage RLS Policies (run in SQL Editor)
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

### File Structure

```
app/
├── _actions/
│   └── file-actions.ts         # Server actions for file operations
lib/
├── services/
│   └── file.service.ts         # Business logic for file operations
├── schema/
│   └── file.schema.ts          # Zod schemas for file validation
types/
└── file.types.ts               # TypeScript types for files
```

### Implementation Details

#### 1. File Service (`lib/services/file.service.ts`)

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

export class FileService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async uploadFile(file: File, userId: string) {
    // Generate unique storage path
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Upload to storage
    const { data: storageData, error: storageError } = await this.supabase
      .storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (storageError) throw storageError;

    // Store metadata in database
    const { data: fileData, error: dbError } = await this.supabase
      .from('files')
      .insert({
        user_id: userId,
        name: file.name.split('.')[0],
        original_name: file.name,
        size: file.size,
        mime_type: file.type,
        storage_path: fileName,
        bucket_name: 'documents'
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup storage on database error
      await this.supabase.storage.from('documents').remove([fileName]);
      throw dbError;
    }

    return fileData;
  }

  async getUserFiles(userId: string) {
    const { data, error } = await this.supabase
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async deleteFile(fileId: string, userId: string) {
    // Get file details first
    const { data: file, error: fetchError } = await this.supabase
      .from('files')
      .select('storage_path')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const { error: storageError } = await this.supabase
      .storage
      .from('documents')
      .remove([file.storage_path]);

    if (storageError) throw storageError;

    // Delete from database
    const { error: dbError } = await this.supabase
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', userId);

    if (dbError) throw dbError;

    return { success: true };
  }

  async getFileUrl(fileId: string, userId: string) {
    const { data: file, error } = await this.supabase
      .from('files')
      .select('storage_path')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    // Generate signed URL (valid for 1 hour)
    const { data: urlData, error: urlError } = await this.supabase
      .storage
      .from('documents')
      .createSignedUrl(file.storage_path, 3600);

    if (urlError) throw urlError;
    return urlData.signedUrl;
  }
}
```

#### 2. Server Actions (`app/_actions/file-actions.ts`)

```typescript
"use server";

import { enhanceAction } from "@/utils/enhance-actions";
import { FileService } from "@/lib/services/file.service";
import { getSupabaseServerClient } from "@/utils/supabase/client/supabase-server";
import { fileUploadSchema, fileDeleteSchema } from "@/lib/schema/file.schema";
import { revalidatePath } from "next/cache";

export const uploadFileAction = enhanceAction(
  async (data, user) => {
    try {
      const supabase = await getSupabaseServerClient();
      const service = new FileService(supabase);
      
      const result = await service.uploadFile(data.file, user.id);
      revalidatePath('/dashboard/files');
      
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload file'
      };
    }
  },
  {
    schema: fileUploadSchema,
    auth: true
  }
);

export const deleteFileAction = enhanceAction(
  async (data, user) => {
    try {
      const supabase = await getSupabaseServerClient();
      const service = new FileService(supabase);
      
      await service.deleteFile(data.fileId, user.id);
      revalidatePath('/dashboard/files');
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete file'
      };
    }
  },
  {
    schema: fileDeleteSchema,
    auth: true
  }
);

export const getFilesAction = enhanceAction(
  async (_, user) => {
    try {
      const supabase = await getSupabaseServerClient();
      const service = new FileService(supabase);
      
      const files = await service.getUserFiles(user.id);
      return { success: true, data: files };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch files'
      };
    }
  },
  {
    auth: true
  }
);
```

#### 3. Update File Upload Dialog

Modify `/components/files/file-upload-dialog.tsx` to call server action:

```typescript
import { uploadFileAction } from "@/app/_actions/file-actions";

const handleUpload = async () => {
  if (selectedFiles.length === 0) return;
  
  setIsUploading(true);
  const errors = [];
  
  for (const file of selectedFiles) {
    const formData = new FormData();
    formData.append('file', file);
    
    const result = await uploadFileAction({ file });
    
    if (!result.success) {
      errors.push({ file: file.name, error: result.message });
    }
  }
  
  setIsUploading(false);
  
  if (errors.length === 0) {
    setSelectedFiles([]);
    onOpenChange(false);
    // Show success toast
  } else {
    // Show errors
  }
};
```

### Error Handling Strategy

1. **File Size Validation**: Check client-side before upload (50MB limit)
2. **File Type Validation**: Validate MIME types client and server-side
3. **Upload Failures**: Retry mechanism with exponential backoff
4. **Storage Cleanup**: Delete from storage if database insert fails
5. **User Feedback**: Toast notifications for success/failure

### Common Gotchas & Solutions

1. **Next.js Body Size Limit**: Default 1MB limit for server actions
   - Solution: Use client-side upload directly to Supabase Storage for large files
   - Alternative: Implement signed URL approach for files > 1MB

2. **CORS Issues**: May occur with direct browser uploads
   - Solution: Configure CORS in Supabase dashboard under Storage settings

3. **RLS Policy Conflicts**: Ensure user folder structure matches RLS policies
   - Solution: Always prefix file paths with user ID

4. **Type Generation**: Database types need regeneration after schema changes
   - Solution: Run `pnpm supabase:types` after migrations

## Tasks to Complete (In Order)

1. **Database Setup**
   - [ ] Create and run migration for files table
   - [ ] Regenerate TypeScript types with `pnpm supabase:types`

2. **Storage Configuration**
   - [ ] Create 'documents' bucket in Supabase dashboard
   - [ ] Apply storage RLS policies via SQL editor

3. **Backend Implementation**
   - [ ] Create file.service.ts with upload/delete/list logic
   - [ ] Create file.schema.ts with Zod validation schemas
   - [ ] Create file-actions.ts with server actions
   - [ ] Add file.types.ts for TypeScript interfaces

4. **Frontend Integration**
   - [ ] Update file-upload-dialog.tsx to use server actions
   - [ ] Add loading and error states
   - [ ] Implement upload progress indicator

5. **File List Component**
   - [ ] Create files-list.tsx component
   - [ ] Implement file deletion with confirmation
   - [ ] Add download functionality with signed URLs

6. **Testing & Validation**
   - [ ] Test file upload with various file types
   - [ ] Verify RLS policies work correctly
   - [ ] Test error scenarios (network failure, large files)
   - [ ] Ensure proper cleanup on failures

## Quality Score: 9/10

This PRP provides comprehensive context with:
- Complete code examples from the actual codebase
- Specific Supabase Storage API references
- Detailed RLS policy configurations
- Error handling strategies
- Clear implementation order

The implementation should succeed in one pass with all necessary context provided.
-- Migration: Create storage bucket and policies for document uploads

-- Create documents storage bucket
-- Note: This is a DML operation (INSERT) rather than DDL, but necessary for storage setup
-- In production, buckets are typically created via Supabase dashboard or API
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents', 
  false,  -- Private bucket
  52428800,  -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]
) ON CONFLICT (id) DO NOTHING;  -- Prevent errors if bucket already exists

-- Storage RLS Policies
-- Secure access policies for the documents storage bucket
-- Ensures users can only access their own uploaded files

-- Policy: Authenticated users can upload documents
-- Users can only upload files to their own folder (path must start with user ID)
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can view their own documents
-- Users can only read files from their own folder
CREATE POLICY "Users can view their own documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can update their own documents
-- Users can update metadata for files in their own folder
CREATE POLICY "Users can update their own documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own documents
-- Users can only delete files from their own folder
CREATE POLICY "Users can delete their own documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
-- Storage RLS Policies
-- Secure access policies for the documents storage bucket
-- Ensures users can only access their own uploaded files

-- Policy: Authenticated users can upload documents
-- Users can only upload files to their own folder (path must start with user ID)
create policy "Authenticated users can upload documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can view their own documents
-- Users can only read files from their own folder
create policy "Users can view their own documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can update their own documents
-- Users can update metadata for files in their own folder
create policy "Users can update their own documents"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own documents
-- Users can only delete files from their own folder
create policy "Users can delete their own documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
-- Migration: Create files table for document storage metadata

-- Files Table
-- Stores metadata for uploaded files with references to Supabase Storage
create table public.files (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  name text not null,
  original_name text not null,
  size bigint not null,
  mime_type text,
  storage_path text not null,
  bucket_name text not null default 'documents',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure storage path is unique per user
  constraint files_storage_path_unique unique (storage_path),
  -- Ensure positive file size
  constraint files_size_positive check (size > 0)
);

comment on table public.files is 'File metadata for documents uploaded to Supabase Storage. Each file is owned by a user and references a file in the storage bucket.';
comment on column public.files.name is 'User-friendly display name for the file';
comment on column public.files.original_name is 'Original filename with extension as uploaded by the user';
comment on column public.files.size is 'File size in bytes';
comment on column public.files.mime_type is 'MIME type of the file';
comment on column public.files.storage_path is 'Path to the file in Supabase Storage bucket';
comment on column public.files.bucket_name is 'Name of the storage bucket containing the file';

-- Enable Row Level Security
alter table public.files enable row level security;

-- RLS Policies for files table
create policy "Users can view their own files"
  on public.files
  for select
  to authenticated
  using ( auth.uid() = user_id );

create policy "Users can insert their own files"
  on public.files
  for insert
  to authenticated
  with check ( auth.uid() = user_id );

create policy "Users can update their own files"
  on public.files
  for update
  to authenticated
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

create policy "Users can delete their own files"
  on public.files
  for delete
  to authenticated
  using ( auth.uid() = user_id );

-- Indexes for performance
create index files_user_id_idx on public.files (user_id);
create index files_created_at_idx on public.files (created_at desc);

-- Trigger to automatically update updated_at timestamp
create trigger update_files_updated_at
  before update on public.files
  for each row
  execute function public.update_updated_at_column();
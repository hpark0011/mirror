-- User Profiles Table
-- Extended user information beyond what's stored in auth.users
create table public.profiles (
  id uuid references auth.users (id) on delete cascade primary key,
  username text unique null,
  full_name text null,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Username validation
  constraint username_length check (char_length(username) >= 3)
);

comment on table public.profiles is 'User profiles containing extended information beyond authentication data. Each profile corresponds to a user in auth.users.';

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- RLS Policies for profiles
create policy "Users can view all profiles"
  on public.profiles
  for select
  to authenticated
  using ( true );

create policy "Users can view their own profile when not authenticated"
  on public.profiles
  for select
  to anon
  using ( true );

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ( (select auth.uid()) = id );

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

create policy "Users can delete their own profile"
  on public.profiles
  for delete
  to authenticated
  using ( (select auth.uid()) = id );

-- Indexes for performance
create index profiles_username_idx on public.profiles (username);
create index profiles_full_name_idx on public.profiles (full_name); 
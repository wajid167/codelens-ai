-- CodeLens AI: one private cloud record per authenticated user.
-- Run this entire script in Supabase Dashboard -> SQL Editor.

create table if not exists public.codelens_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snippets jsonb not null default '[]'::jsonb,
  progress jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint codelens_snippets_is_array check (jsonb_typeof(snippets) = 'array'),
  constraint codelens_progress_is_array check (jsonb_typeof(progress) = 'array')
);

alter table public.codelens_user_data enable row level security;

revoke all on table public.codelens_user_data from anon;
grant select, insert, update, delete on table public.codelens_user_data to authenticated;

drop policy if exists "Users can read their own CodeLens data" on public.codelens_user_data;
create policy "Users can read their own CodeLens data"
on public.codelens_user_data
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own CodeLens data" on public.codelens_user_data;
create policy "Users can create their own CodeLens data"
on public.codelens_user_data
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own CodeLens data" on public.codelens_user_data;
create policy "Users can update their own CodeLens data"
on public.codelens_user_data
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own CodeLens data" on public.codelens_user_data;
create policy "Users can delete their own CodeLens data"
on public.codelens_user_data
for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists codelens_user_data_updated_at_idx
on public.codelens_user_data (updated_at desc);

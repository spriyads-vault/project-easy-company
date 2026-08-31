-- Workspaces: one private workspace per user, auto-provisioned on sign-up.
-- Every workspace-owned table added in later migrations references workspace_id
-- and repeats the "owner_id = auth.uid() via workspace" RLS pattern below.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

comment on table public.workspaces is
  'One private workspace per user. All product/failure/measurement data is scoped to a workspace.';

alter table public.workspaces enable row level security;

-- A user may only see, create, change, or delete their own workspace.
-- No cross-workspace access exists at the RLS layer.
create policy "workspaces_select_own" on public.workspaces
  for select using (auth.uid() = owner_id);

create policy "workspaces_insert_own" on public.workspaces
  for insert with check (auth.uid() = owner_id);

create policy "workspaces_update_own" on public.workspaces
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "workspaces_delete_own" on public.workspaces
  for delete using (auth.uid() = owner_id);

-- Keep updated_at current on every change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- Auto-provision a private workspace the moment a user signs up, so the
-- product never has to handle a signed-in user with no workspace.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.workspaces (owner_id, name)
  values (new.id, 'My workspace');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

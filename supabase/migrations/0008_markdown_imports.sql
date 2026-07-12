create table if not exists public.markdown_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.members(id) on delete set null,
  file_names jsonb not null default '[]'::jsonb,
  files_count integer not null default 0 check (files_count >= 0),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  status text not null default 'completed',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists markdown_imports_org_created_idx
  on public.markdown_imports (organization_id, created_at desc);
alter table public.markdown_imports enable row level security;
drop policy if exists markdown_imports_select on public.markdown_imports;
create policy markdown_imports_select
  on public.markdown_imports
  for select
  using (public.is_internal_org_member(organization_id));
drop policy if exists markdown_imports_insert on public.markdown_imports;
create policy markdown_imports_insert
  on public.markdown_imports
  for insert
  with check (public.is_internal_org_member(organization_id));
drop policy if exists markdown_imports_update on public.markdown_imports;
create policy markdown_imports_update
  on public.markdown_imports
  for update
  using (public.is_internal_org_member(organization_id))
  with check (public.is_internal_org_member(organization_id));
drop policy if exists markdown_imports_delete on public.markdown_imports;
create policy markdown_imports_delete
  on public.markdown_imports
  for delete
  using (public.is_internal_org_member(organization_id));

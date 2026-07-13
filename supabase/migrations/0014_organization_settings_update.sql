-- BnsStudio 1.1.0 — impostazioni organizzazione modificabili.
-- Additiva: aggiunge email/updated_at e abilita update solo a owner/admin.

alter table public.organizations
  add column if not exists email text,
  add column if not exists updated_at timestamptz not null default now();

update public.organizations
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

drop policy if exists org_owner_admin_update on public.organizations;
create policy org_owner_admin_update on public.organizations
  for update
  using (
    public.is_internal_org_member(id)
    and public.org_role(id) in ('owner', 'admin')
  )
  with check (
    public.is_internal_org_member(id)
    and public.org_role(id) in ('owner', 'admin')
  );

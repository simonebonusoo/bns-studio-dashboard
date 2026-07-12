-- ============================================================================
-- BNS Studio OS — RLS baseline IDEMPOTENTE
--
-- Perché esiste: la 0002 risultava applicata al remoto in una versione che NON
-- conteneva le funzioni helper (is_internal_org_member ecc.). Questa migration
-- riafferma in modo idempotente (drop-if-exists + create or replace) helper e
-- policy, così lo stato RLS del database remoto è deterministico e verificabile.
--
-- Modello di sicurezza:
--   • ogni tabella privata è isolata per organization_id;
--   • solo i membri interni attivi accedono ai dati della propria org;
--   • le tabelle finanziarie sono scrivibili solo da chi ha accesso finanziario
--     (owner/admin/project_manager/accountant);
--   • il ruolo 'client' NON riceve accesso ai dati interni (portale non ancora
--     esposto): nessuna policy permissiva per i client.
-- ============================================================================

-- ─────────────── Helper (SECURITY DEFINER, stable) ───────────────
create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members m
    join profiles p on p.id = m.profile_id
    where m.organization_id = org
      and p.id = auth.uid()
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;
create or replace function public.org_role(org uuid)
returns member_role
language sql stable security definer set search_path = public as $$
  select m.role from members m
  join profiles p on p.id = m.profile_id
  where m.organization_id = org and p.id = auth.uid() and m.deleted_at is null
  limit 1;
$$;
create or replace function public.can_finance(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.org_role(org) in ('owner','admin','project_manager','accountant');
$$;
create or replace function public.is_internal_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_member(org) and public.org_role(org) <> 'client';
$$;
-- ─────────────── Abilita RLS ovunque ───────────────
do $$
declare t text;
begin
  foreach t in array array[
    'members','companies','clients','opportunities','services','projects',
    'milestones','tasks','time_entries','estimates','invoices','payments',
    'transactions','contracts','files','calendar_events','comments',
    'notifications','activity_logs','documents','organizations','profiles'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;
-- ─────────────── Profili e organizzazioni ───────────────
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists org_member_read on organizations;
create policy org_member_read on organizations
  for select using (public.is_internal_org_member(id));
-- ─────────────── Policy standard "membro interno" ───────────────
do $$
declare t text;
begin
  foreach t in array array[
    'members','companies','clients','opportunities','services','projects',
    'milestones','tasks','time_entries','files','calendar_events','comments',
    'notifications','activity_logs','documents'
  ] loop
    execute format('drop policy if exists %1$s_member_all on %1$I;', t);
    execute format($f$
      create policy %1$s_member_all on %1$I
        for all using (public.is_internal_org_member(organization_id))
        with check (public.is_internal_org_member(organization_id));
    $f$, t);
  end loop;
end $$;
-- ─────────────── Tabelle finanziarie ───────────────
do $$
declare t text;
begin
  foreach t in array array['estimates','invoices','payments','transactions','contracts'] loop
    execute format('drop policy if exists %1$s_finance_read on %1$I;', t);
    execute format('drop policy if exists %1$s_finance_write on %1$I;', t);
    execute format($f$
      create policy %1$s_finance_read on %1$I
        for select using (public.is_internal_org_member(organization_id));
    $f$, t);
    execute format($f$
      create policy %1$s_finance_write on %1$I
        for all using (public.is_internal_org_member(organization_id) and public.can_finance(organization_id))
        with check (public.is_internal_org_member(organization_id) and public.can_finance(organization_id));
    $f$, t);
  end loop;
end $$;

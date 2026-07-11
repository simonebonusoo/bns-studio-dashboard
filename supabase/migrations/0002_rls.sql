-- ============================================================================
-- BNS Studio OS — Row Level Security
-- Regola base: un utente accede solo ai dati delle organizzazioni di cui è
-- membro. I clienti (role='client') vedono solo dati condivisi.
-- Vedi docs/RLS.md per la spiegazione completa.
-- ============================================================================

-- Helper: l'utente corrente è membro attivo dell'organizzazione?
create or replace function is_org_member(org uuid)
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

-- Helper: ruolo dell'utente corrente nell'organizzazione
create or replace function org_role(org uuid)
returns member_role
language sql stable security definer set search_path = public as $$
  select m.role from members m
  join profiles p on p.id = m.profile_id
  where m.organization_id = org and p.id = auth.uid() and m.deleted_at is null
  limit 1;
$$;

-- Helper: l'utente ha accesso finanziario?
create or replace function can_finance(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select org_role(org) in ('owner','admin','project_manager','accountant');
$$;

-- Helper: il membro è interno allo studio (non role='client')?
create or replace function is_internal_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select is_org_member(org) and org_role(org) <> 'client';
$$;

-- Abilita RLS su tutte le tabelle con organization_id
do $$
declare t text;
begin
  foreach t in array array[
    'members','companies','clients','opportunities','services','projects',
    'milestones','tasks','time_entries','estimates','invoices','payments',
    'transactions','contracts','files','calendar_events','comments',
    'notifications','activity_logs','documents'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

alter table organizations enable row level security;
alter table profiles enable row level security;

-- Profilo: ognuno vede/aggiorna il proprio
create policy profiles_self on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Organizzazioni: visibili ai soli membri interni
create policy org_member_read on organizations
  for select using (is_internal_org_member(id));

-- Policy generica "membro dell'organizzazione" per le tabelle standard.
-- (I dati finanziari hanno policy dedicate più restrittive, sotto.)
do $$
declare t text;
begin
  foreach t in array array[
    'members','companies','clients','opportunities','services','projects',
    'milestones','tasks','time_entries','files','calendar_events','comments',
    'notifications','activity_logs','documents'
  ] loop
    execute format($f$
      create policy %1$s_member_all on %1$I
        for all using (is_internal_org_member(organization_id))
        with check (is_internal_org_member(organization_id));
    $f$, t);
  end loop;
end $$;

-- Tabelle finanziarie: lettura ai membri interni, scrittura solo a chi ha accesso finanziario
do $$
declare t text;
begin
  foreach t in array array['estimates','invoices','payments','transactions','contracts'] loop
    execute format($f$
      create policy %1$s_finance_read on %1$I
        for select using (is_internal_org_member(organization_id));
    $f$, t);
    execute format($f$
      create policy %1$s_finance_write on %1$I
        for all using (is_internal_org_member(organization_id) and can_finance(organization_id))
        with check (is_internal_org_member(organization_id) and can_finance(organization_id));
    $f$, t);
  end loop;
end $$;

-- Sicurezza: in assenza di una relazione esplicita cliente↔profilo e policy di
-- condivisione per tabella, il ruolo 'client' NON riceve accesso ai dati privati.
-- Le future policy client dovranno essere read-only e limitate a record
-- esplicitamente condivisi (client_visible / visibility='client').

-- ============================================================================
-- BNS Studio OS — bootstrap sicuro del primo owner + profilo automatico
--
-- Obiettivo:
--   auth user  →  profile  →  organization BNS Studio  →  member (role=owner)
--
-- Nessun inserimento manuale in auth.users. Il primo utente si registra via
-- Supabase Auth (signup / dashboard) e poi chiama la funzione bootstrap_owner()
-- una sola volta per diventare owner dell'organizzazione.
-- ============================================================================

-- ─────────────── Profilo automatico alla registrazione ───────────────
-- Trigger volutamente "a prova di errore": qualunque eccezione viene ingoiata
-- così da NON bloccare mai la creazione dell'utente Auth (signup/login).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- ─────────────── Bootstrap del primo owner ───────────────
-- Chiamabile SOLO da un utente autenticato. Crea (se manca) l'organizzazione
-- e collega il chiamante come owner attivo. È idempotente e si "auto-blocca":
-- se l'organizzazione ha già un owner attivo e il chiamante non ne è membro,
-- la funzione nega l'operazione (impedisce escalation da parte di altri signup).
create or replace function public.bootstrap_owner(
  p_org_name text default 'BNS Studio',
  p_org_slug text default 'bns-studio',
  p_first_name text default null,
  p_last_name text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_org_id uuid;
  v_owner_count int;
begin
  if v_uid is null then
    raise exception 'Autenticazione richiesta per il bootstrap.';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- Profilo (nel caso il trigger non fosse ancora presente al signup).
  insert into public.profiles (id, email, first_name, last_name)
  values (v_uid, coalesce(v_email, ''), p_first_name, p_last_name)
  on conflict (id) do nothing;

  -- Organizzazione: riusa quella esistente per slug, altrimenti creala.
  select id into v_org_id from public.organizations where slug = p_org_slug;
  if v_org_id is null then
    insert into public.organizations (name, slug)
    values (p_org_name, p_org_slug)
    returning id into v_org_id;
  end if;

  -- Se esiste già un owner attivo e il chiamante non è membro → nega.
  select count(*) into v_owner_count
  from public.members
  where organization_id = v_org_id
    and role = 'owner' and status = 'active' and deleted_at is null;

  if v_owner_count > 0
     and not exists (
       select 1 from public.members
       where organization_id = v_org_id and profile_id = v_uid and deleted_at is null
     ) then
    raise exception 'Organizzazione già inizializzata: bootstrap non consentito.';
  end if;

  -- Crea/riattiva la membership owner collegata al profilo del chiamante.
  insert into public.members (
    organization_id, profile_id, first_name, last_name, email, role, status, job_title
  )
  values (
    v_org_id, v_uid,
    coalesce(p_first_name, split_part(coalesce(v_email, ''), '@', 1)),
    coalesce(p_last_name, ''),
    coalesce(v_email, ''),
    'owner', 'active', 'Owner'
  )
  on conflict (organization_id, email) do update
    set profile_id = excluded.profile_id,
        role = 'owner',
        status = 'active',
        deleted_at = null,
        updated_at = now();

  return v_org_id;
end;
$$;
revoke all on function public.bootstrap_owner(text, text, text, text) from public;
grant execute on function public.bootstrap_owner(text, text, text, text) to authenticated;

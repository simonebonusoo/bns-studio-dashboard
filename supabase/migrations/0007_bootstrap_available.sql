-- ============================================================================
-- BNS Studio OS — verifica se il bootstrap owner è ancora disponibile
--
-- Serve all'onboarding per distinguere due stati di un utente autenticato SENZA
-- membership:
--   • bootstrap disponibile  → l'organizzazione non ha ancora un owner attivo
--     (primo setup) → mostra il form di inizializzazione;
--   • bootstrap NON disponibile → l'organizzazione ha già un owner → l'utente
--     va gestito come "account non ancora associato" (contatta un admin).
--
-- È SECURITY DEFINER e restituisce SOLO un booleano: nessun dato sensibile,
-- nessun bypass RLS sui dati. Un utente senza membership, per via dell'RLS, non
-- potrebbe leggere `members`/`organizations`: questa funzione fornisce l'unico
-- segnale minimo necessario, senza esporre righe.
-- ============================================================================
create or replace function public.bootstrap_available(p_org_slug text default 'bns-studio')
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1
    from public.organizations o
    join public.members m on m.organization_id = o.id
    where o.slug = p_org_slug
      and m.role = 'owner'
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;
revoke all on function public.bootstrap_available(text) from public;
grant execute on function public.bootstrap_available(text) to authenticated;

-- ============================================================================
-- BnsStudio 1.1.0 — profilo personale, avatar Storage e origine cashflow.
--
-- Additiva e non distruttiva:
--   • estende profili/membri con campi account editabili;
--   • crea un bucket pubblico dedicato agli avatar;
--   • collega i movimenti finanziari automatici alla loro origine;
--   • impedisce duplicati per pagamento/rata finche' il movimento e' attivo.
-- ============================================================================

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists phone text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.members
  add column if not exists display_name text,
  add column if not exists phone text,
  add column if not exists bio text,
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bns-avatars',
  'bns-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bns_avatars_public_read" on storage.objects;
create policy "bns_avatars_public_read" on storage.objects
  for select to public
  using (bucket_id = 'bns-avatars');

drop policy if exists "bns_avatars_org_insert" on storage.objects;
create policy "bns_avatars_org_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bns-avatars'
    and public.is_internal_org_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "bns_avatars_org_update" on storage.objects;
create policy "bns_avatars_org_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'bns-avatars'
    and public.is_internal_org_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'bns-avatars'
    and public.is_internal_org_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "bns_avatars_org_delete" on storage.objects;
create policy "bns_avatars_org_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bns-avatars'
    and public.is_internal_org_member(((storage.foldername(name))[1])::uuid)
  );

alter table public.transactions
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_id uuid,
  add column if not exists source_label text,
  add column if not exists automatic boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_source_type_check'
  ) then
    alter table public.transactions
      add constraint transactions_source_type_check
      check (source_type in ('manual', 'payment', 'payment_installment'));
  end if;
end $$;

create unique index if not exists transactions_auto_source_uidx
  on public.transactions (organization_id, source_type, source_id)
  where deleted_at is null
    and automatic = true
    and source_id is not null
    and source_type in ('payment', 'payment_installment');

create index if not exists transactions_source_idx
  on public.transactions (organization_id, source_type, source_id);

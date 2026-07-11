-- ============================================================================
-- BNS Studio OS — Supabase Storage per il file manager
--
-- Bucket privato `bns-files`. Convenzione dei path degli oggetti:
--   <organization_id>/<file_id>/<nome-file>
-- Il primo segmento (organization_id) è la chiave di isolamento tenant usata
-- dalle policy: un utente accede a un oggetto solo se è membro interno attivo
-- di quell'organizzazione. I file sono privati → accesso via URL firmati.
-- ============================================================================

-- Bucket privato (public=false). Limite dimensione 50MB lato Storage;
-- il limite operativo effettivo è imposto dall'app (VITE_MAX_UPLOAD_SIZE_MB).
insert into storage.buckets (id, name, public, file_size_limit)
values ('bns-files', 'bns-files', false, 52428800)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Isolamento per organizzazione tramite il primo segmento del path.
drop policy if exists "bns_files_org_read" on storage.objects;
create policy "bns_files_org_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bns-files'
    and public.is_internal_org_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "bns_files_org_insert" on storage.objects;
create policy "bns_files_org_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bns-files'
    and public.is_internal_org_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "bns_files_org_update" on storage.objects;
create policy "bns_files_org_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'bns-files'
    and public.is_internal_org_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'bns-files'
    and public.is_internal_org_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "bns_files_org_delete" on storage.objects;
create policy "bns_files_org_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bns-files'
    and public.is_internal_org_member(((storage.foldername(name))[1])::uuid)
  );

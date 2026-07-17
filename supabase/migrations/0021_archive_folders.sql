-- ============================================================================
-- BNS Studio OS — Archivio documentale a cartelle (§14 redesign Archivio)
--
-- Modello:
--   • archive_folders  → SOLO cartelle personalizzate ('custom') e di sistema
--     ('system'). Le cartelle-progetto sono VIRTUALI (derivate da projects),
--     quindi NON vengono materializzate qui: nessuna duplicazione, auto-sync.
--   • files.folder_id  → collega un file a una cartella custom/sistema. Un file
--     con folder_id NULL e project_id valorizzato vive nella "radice" virtuale
--     della cartella-progetto; con entrambi NULL sta in "File non organizzati".
--
-- Zero-loss: nessun file spostato nello Storage; solo metadati/relazioni.
-- Sicurezza: stesso pattern is_internal_org_member(organization_id) delle altre
-- tabelle private (vedi 0005_rls_baseline.sql).
-- ============================================================================

-- ─────────────── Tabella cartelle ───────────────
create table if not exists archive_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  parent_folder_id uuid references archive_folders(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  description text,
  folder_type text not null default 'custom' check (folder_type in ('custom','system')),
  icon text,
  color text,
  default_visibility text check (default_visibility in ('internal','client')),
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists archive_folders_org_idx     on archive_folders(organization_id);
create index if not exists archive_folders_parent_idx  on archive_folders(parent_folder_id);
create index if not exists archive_folders_project_idx on archive_folders(project_id);
create index if not exists archive_folders_client_idx  on archive_folders(client_id);
create index if not exists archive_folders_deleted_idx on archive_folders(deleted_at);
-- Ricerca per nome normalizzato all'interno della stessa cartella/organizzazione.
create index if not exists archive_folders_name_idx    on archive_folders(organization_id, lower(name));

-- ─────────────── Collegamento file → cartella ───────────────
alter table files add column if not exists folder_id uuid references archive_folders(id) on delete set null;
create index if not exists files_folder_id_idx on files(folder_id);

-- ─────────────── Guard anti-ciclo (spostamento cartelle) ───────────────
-- Impedisce: parent = sé stessa, cicli, profondità patologica. Applicata sia in
-- INSERT sia in UPDATE del parent_folder_id.
create or replace function public.archive_folders_prevent_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ancestor uuid;
  depth int := 0;
begin
  if new.parent_folder_id is null then
    return new;
  end if;
  if new.parent_folder_id = new.id then
    raise exception 'Una cartella non può essere figlia di sé stessa';
  end if;
  ancestor := new.parent_folder_id;
  while ancestor is not null loop
    depth := depth + 1;
    if ancestor = new.id then
      raise exception 'Spostamento non valido: creerebbe un ciclo di cartelle';
    end if;
    if depth > 64 then
      raise exception 'Profondità delle cartelle eccessiva';
    end if;
    select parent_folder_id into ancestor from archive_folders where id = ancestor;
  end loop;
  return new;
end;
$$;

drop trigger if exists archive_folders_no_cycle on archive_folders;
create trigger archive_folders_no_cycle
  before insert or update on archive_folders
  for each row execute function public.archive_folders_prevent_cycle();

-- ─────────────── RLS (membro interno della propria org) ───────────────
alter table archive_folders enable row level security;
drop policy if exists archive_folders_member_all on archive_folders;
create policy archive_folders_member_all on archive_folders
  for all using (public.is_internal_org_member(organization_id))
  with check (public.is_internal_org_member(organization_id));

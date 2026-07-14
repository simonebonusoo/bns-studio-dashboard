-- ============================================================================
-- BnsStudio 1.1.0 — Integrazione GitHub (§3-4)
--
-- Modello a livello ORGANIZZAZIONE. Sicurezza (§30):
--   • NESSUN token/secret in queste tabelle né nel frontend. La connessione è
--     una GitHub App: app_id + private key vivono come SECRET dell'Edge Function
--     (server-side); gli installation token sono a vita breve e generati
--     on-demand dalla function, mai persistiti.
--   • `github_connections` tiene solo metadati pubblici dell'installazione.
--   • Scrittura della connessione ristretta agli admin; lettura ai membri interni.
--
-- Migration ADDITIVA e idempotente.
-- ============================================================================

-- Helper: l'utente corrente è admin/owner dell'organizzazione?
create or replace function public.is_org_admin(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_member(org) and public.org_role(org) in ('owner','admin');
$$;

-- ─────────────── Connessione GitHub (una per organizzazione) ───────────────
create table if not exists public.github_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  installation_id bigint,                 -- id installazione GitHub App
  account_login text,                     -- org/utente GitHub collegato
  account_type text,                      -- 'Organization' | 'User'
  account_avatar_url text,
  status text not null default 'connected'
    check (status in ('connecting','connected','error','revoked')),
  error_message text,
  connected_by uuid references members(id) on delete set null,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)                -- una sola connessione per org
);

-- ─────────────── Repository collegati ai progetti ───────────────
create table if not exists public.project_repositories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  repo_id bigint not null,                -- id numerico GitHub del repo
  full_name text not null,                -- owner/name
  owner text not null,
  name text not null,
  private boolean not null default false,
  default_branch text,
  html_url text,
  -- Campi opzionali per contesto operativo (popolati quando disponibili).
  open_issues int,
  open_pull_requests int,
  last_pushed_at timestamptz,
  linked_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, project_id, repo_id)  -- no duplicati per progetto
);

create index if not exists project_repositories_project_idx on public.project_repositories (project_id);
create index if not exists project_repositories_org_idx on public.project_repositories (organization_id);

-- ─────────────── RLS ───────────────
alter table public.github_connections enable row level security;
alter table public.project_repositories enable row level security;

-- Connessione: lettura membri interni, scrittura SOLO admin (§4).
drop policy if exists github_connections_read on public.github_connections;
create policy github_connections_read on public.github_connections
  for select using (public.is_internal_org_member(organization_id));
drop policy if exists github_connections_admin_write on public.github_connections;
create policy github_connections_admin_write on public.github_connections
  for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Link repo↔progetto: lettura e scrittura ai membri interni.
drop policy if exists project_repositories_member_all on public.project_repositories;
create policy project_repositories_member_all on public.project_repositories
  for all
  using (public.is_internal_org_member(organization_id))
  with check (public.is_internal_org_member(organization_id));

-- ============================================================================
-- BNS Studio OS — schema iniziale (produzione Supabase / PostgreSQL)
-- Multi-organizzazione. Ogni tabella privata è isolata da organization_id + RLS.
-- Questo schema è PREDISPOSTO: l'app gira in demo (IndexedDB) finché non si
-- configura Supabase. Applicare con: supabase db push  (o via MCP apply_migration)
-- ============================================================================

create extension if not exists "pgcrypto";
-- ─────────────── Organizzazioni e membri ───────────────
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  currency text not null default 'EUR',
  locale text not null default 'it-IT',
  timezone text not null default 'Europe/Rome',
  vat text,
  created_at timestamptz not null default now()
);
-- profiles: 1:1 con auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  avatar_color text default '#71717a',
  created_at timestamptz not null default now()
);
create type member_role as enum (
  'owner','admin','project_manager','designer','developer','collaborator','accountant','client'
);
create type member_status as enum ('invited','active','unavailable','suspended','inactive');
create table members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  avatar_color text default '#71717a',
  role member_role not null default 'collaborator',
  job_title text,
  skills text[] default '{}',
  weekly_hours numeric default 40,
  internal_rate numeric default 0,
  client_rate numeric default 0,
  collaboration_type text default 'freelance',
  status member_status not null default 'active',
  joined_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, email)
);
create index on members (organization_id);
-- ─────────────── CRM ───────────────
create table companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  sector text, size text, website text, vat text, city text, country text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on companies (organization_id);
create type client_status as enum ('lead','prospect','active','inactive','past_client','partner','archived');
create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  type text not null default 'company',
  display_name text not null,
  first_name text, last_name text, company_name text,
  email text, phone text, website text, vat text, tax_code text,
  address text, city text, province text, zip text, country text,
  sector text, source text,
  status client_status not null default 'lead',
  priority text not null default 'medium',
  owner_id uuid references members(id) on delete set null,
  tags text[] default '{}',
  notes text,
  last_contact_at timestamptz, next_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on clients (organization_id, status);
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  client_id uuid references clients(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  stage text not null default 'new',
  value numeric not null default 0,
  probability numeric not null default 0,
  service_id uuid,
  source text,
  owner_id uuid references members(id) on delete set null,
  priority text default 'medium',
  expected_close_date date, next_follow_up_at timestamptz,
  lost_reason text, notes text, tags text[] default '{}',
  "order" int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on opportunities (organization_id, stage);
-- ─────────────── Servizi ───────────────
create table services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, description text, category text,
  base_price numeric default 0, price_unit text default 'fixed', vat_rate numeric default 22,
  estimated_hours numeric, internal_cost numeric, target_margin numeric,
  active boolean default true, color text default '#b0d62e',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on services (organization_id);
-- ─────────────── Progetti / task ───────────────
create type project_status as enum
  ('lead','draft','planned','active','waiting_client','review','paused','completed','cancelled','archived');
create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null, description text,
  client_id uuid references clients(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  manager_id uuid references members(id) on delete set null,
  member_ids uuid[] default '{}',
  service_id uuid references services(id) on delete set null,
  status project_status not null default 'planned',
  priority text default 'medium',
  health text default 'on_track',
  start_date date, due_date date, completed_at timestamptz,
  contract_value numeric default 0, budget numeric default 0,
  estimated_hours numeric default 0, target_margin numeric,
  progress int default 0, color text default '#b0d62e', tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code)
);
create index on projects (organization_id, status);
create table milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null, description text,
  status text default 'planned', due_date date, completed_at timestamptz,
  client_visible boolean default false, "order" int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on milestones (organization_id, project_id);
create table tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  milestone_id uuid references milestones(id) on delete set null,
  title text not null, description text,
  status text not null default 'todo', priority text default 'medium',
  assignee_ids uuid[] default '{}',
  start_date date, due_date date, estimated_hours numeric,
  client_visible boolean default false, completed_at timestamptz,
  "order" int default 0, tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on tasks (organization_id, project_id, status);
-- ─────────────── Tempo ───────────────
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  description text, date date not null, started_at timestamptz,
  duration_minutes int not null default 0,
  billable boolean default true, hourly_rate numeric, internal_cost numeric,
  approved boolean default false, running boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on time_entries (organization_id, member_id, date);
-- ─────────────── Documenti finanziari ───────────────
create table estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  number text not null, version int default 1,
  client_id uuid references clients(id) on delete set null,
  opportunity_id uuid references opportunities(id) on delete set null,
  status text not null default 'draft', currency text default 'EUR',
  issue_date date not null, expiry_date date,
  items jsonb not null default '[]',
  global_discount_pct numeric default 0, deposit_pct numeric,
  notes text, terms text, accepted_at timestamptz, rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, number)
);
create index on estimates (organization_id, status);
create table invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  number text not null,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  estimate_id uuid references estimates(id) on delete set null,
  status text not null default 'draft', currency text default 'EUR',
  issue_date date not null, due_date date,
  items jsonb not null default '[]',
  global_discount_pct numeric default 0, withholding_pct numeric default 0,
  notes text, payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, number)
);
create index on invoices (organization_id, status);
create table payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  amount numeric not null, currency text default 'EUR', date date not null,
  method text default 'bank_transfer', reference text,
  status text not null default 'completed', notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on payments (organization_id, invoice_id);
create table transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type text not null, category text, description text,
  amount numeric not null, currency text default 'EUR', date date not null,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  vendor text, method text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on transactions (organization_id, type, date);
create table contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  number text not null, title text not null,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  estimate_id uuid references estimates(id) on delete set null,
  type text default 'single_project', status text default 'draft',
  value numeric default 0, start_date date, end_date date,
  signed_by_client boolean default false, signed_by_studio boolean default false, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, number)
);
-- ─────────────── Risorse e collaborazione ───────────────
create table files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, mime text, size bigint default 0,
  project_id uuid references projects(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  folder text, client_visible boolean default false,
  uploaded_by uuid references members(id) on delete set null,
  storage_path text, tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null, type text default 'custom',
  start_at timestamptz not null, end_at timestamptz not null, all_day boolean default false,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  location text, meeting_link text, description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text not null, entity_id uuid not null,
  author_id uuid references members(id) on delete set null,
  content text not null, visibility text default 'internal', edited boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on comments (organization_id, entity_type, entity_id);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references members(id) on delete cascade,
  type text not null, title text not null, body text,
  entity_type text, entity_id uuid, read boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on notifications (organization_id, user_id, read);
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references members(id) on delete set null,
  action text not null, entity_type text, entity_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);
create index on activity_logs (organization_id, entity_type);
create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null, type text, content text,
  project_id uuid references projects(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  author_id uuid references members(id) on delete set null,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

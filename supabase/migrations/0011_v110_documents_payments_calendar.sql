-- ============================================================================
-- BNS Studio OS v1.1.0 — documenti, rate, contratti ricorrenti e calendario
-- Migrazione incrementale e non distruttiva: estende il modello esistente.
-- ============================================================================

create table if not exists public.payment_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','due_soon','paid','overdue','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (payment_id, installment_number)
);

create index if not exists payment_installments_org_payment_idx
  on public.payment_installments (organization_id, payment_id, installment_number);

alter table public.files
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists document_category text default 'Altro',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists files_org_project_category_idx
  on public.files (organization_id, project_id, document_category);

alter table public.documents
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id uuid,
  add column if not exists representation text default 'markdown',
  add column if not exists version integer not null default 1,
  add column if not exists file_id uuid references public.files(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists documents_source_idx
  on public.documents (organization_id, source_entity_type, source_entity_id, representation);

alter table public.contracts
  add column if not exists recurrence text not null default 'one_time',
  add column if not exists billing_frequency text not null default 'one_time',
  add column if not exists renewal_type text not null default 'none';

alter table public.calendar_events
  add column if not exists recurrence text not null default 'none',
  add column if not exists recurrence_until date,
  add column if not exists invited_emails text[] default '{}',
  add column if not exists notes text;

alter table public.payment_installments enable row level security;

drop policy if exists payment_installments_finance_read on public.payment_installments;
create policy payment_installments_finance_read
  on public.payment_installments
  for select
  using (public.is_internal_org_member(organization_id));

drop policy if exists payment_installments_finance_write on public.payment_installments;
create policy payment_installments_finance_write
  on public.payment_installments
  for all
  using (public.is_internal_org_member(organization_id) and public.can_finance(organization_id))
  with check (public.is_internal_org_member(organization_id) and public.can_finance(organization_id));

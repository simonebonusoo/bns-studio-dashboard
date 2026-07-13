-- ============================================================================
-- BnsStudio 1.1.0 — allineamento incrementale con lo schema production.
--
-- Le migration remote 0009/0010 avevano gia' introdotto rate, ricorrenze
-- contratti e varianti documento con nomi diversi da quelli usati dal frontend
-- v1.1.0. Questa migration non elimina nulla: aggiunge colonne compatibili,
-- backfill dei valori equivalenti e aggiorna i vincoli in modo non distruttivo.
-- ============================================================================

-- ─────────────── Rate pagamenti: compat layer su 0009 ───────────────
alter table public.payment_installments
  add column if not exists installment_number integer,
  add column if not exists paid_at timestamptz,
  add column if not exists notes text;

update public.payment_installments
set
  installment_number = coalesce(installment_number, seq),
  paid_at = coalesce(paid_at, paid_date::timestamptz),
  notes = coalesce(notes, note)
where installment_number is null
   or (paid_at is null and paid_date is not null)
   or (notes is null and note is not null);

alter table public.payment_installments
  alter column installment_number set default 1,
  alter column installment_number set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_installments_installment_number_check'
  ) then
    alter table public.payment_installments
      add constraint payment_installments_installment_number_check
      check (installment_number > 0);
  end if;
end $$;

alter table public.payment_installments
  drop constraint if exists payment_installments_status_check;

alter table public.payment_installments
  add constraint payment_installments_status_check
  check (status in ('pending','scheduled','due_soon','paid','overdue','cancelled'));

create unique index if not exists payment_installments_payment_number_uidx
  on public.payment_installments (payment_id, installment_number)
  where payment_id is not null and deleted_at is null;

create index if not exists payment_installments_org_payment_idx
  on public.payment_installments (organization_id, payment_id, installment_number);

-- ─────────────── Archivio file: metadata e collegamento entita' ───────────────
alter table public.files
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists document_category text not null default 'Altro',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists files_org_project_category_idx
  on public.files (organization_id, project_id, document_category);

create index if not exists files_entity_idx
  on public.files (organization_id, entity_type, entity_id);

-- ─────────────── Documenti: sorgente e rappresentazione Markdown/PDF ─────────
alter table public.documents
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id uuid,
  add column if not exists representation text not null default 'markdown',
  add column if not exists version integer not null default 1,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists documents_source_idx
  on public.documents (organization_id, source_entity_type, source_entity_id, representation);

-- ─────────────── Contratti: nomi usati dal frontend v1.1.0 ───────────────
alter table public.contracts
  add column if not exists billing_frequency text not null default 'one_time',
  add column if not exists renewal_type text not null default 'none';

update public.contracts
set
  billing_frequency = coalesce(nullif(billing_frequency, ''), billing_cycle, 'one_time'),
  renewal_type = case
    when renewal_type is not null and renewal_type <> '' then renewal_type
    when auto_renew then 'automatic'
    else 'none'
  end;

alter table public.contracts
  drop constraint if exists contracts_recurrence_check;

alter table public.contracts
  add constraint contracts_recurrence_check
  check (recurrence in ('none','one_time','weekly','monthly','quarterly','semiannual','yearly','annual','custom'));

-- ─────────────── Calendario: ricorrenze e invitati esterni ───────────────
alter table public.calendar_events
  add column if not exists recurrence text not null default 'none',
  add column if not exists recurrence_until date,
  add column if not exists invited_emails text[] not null default '{}',
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'calendar_events_recurrence_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_recurrence_check
      check (recurrence in ('none','daily','weekly','monthly','yearly','custom'));
  end if;
end $$;

-- ─────────────── RLS nuove entita'/colonne ───────────────
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

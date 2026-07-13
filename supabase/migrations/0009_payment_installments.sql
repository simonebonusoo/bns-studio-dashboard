-- ============================================================================
-- BnsStudio 1.1.0 — Pagamenti rateizzati (§9)
--
-- Le rate sono uno SCHEDULING di pagamenti attesi, distinto dagli incassi reali
-- (tabella `payments`). Una rata è ancorata al contesto economico esistente
-- (progetto / fattura / contratto) senza duplicarne il modello, e quando viene
-- saldata può puntare al `payment` reale che l'ha chiusa.
--
-- Stati persistiti: pending | paid | cancelled.
-- Gli stati temporali (in scadenza / scaduta) NON sono persistiti: si derivano
-- da `due_date` a runtime, così restano sempre coerenti (§9).
--
-- Migration ADDITIVA e idempotente. Non modifica tabelle esistenti.
-- ============================================================================

create table if not exists public.payment_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  -- Contesto economico: almeno uno tra project/invoice/contract dovrebbe essere
  -- valorizzato. Il vincolo è applicativo (validazione), non hard a DB, per non
  -- irrigidire casi legittimi (es. acconto generico su cliente).
  project_id  uuid references projects(id)  on delete cascade,
  invoice_id  uuid references invoices(id)  on delete cascade,
  contract_id uuid references contracts(id) on delete cascade,
  client_id   uuid references clients(id)   on delete set null,

  -- Pagamento reale che ha saldato la rata (se presente).
  payment_id  uuid references payments(id)  on delete set null,

  seq       int not null default 1,               -- progressivo 1..n nel piano
  amount    numeric(14,2) not null,               -- numeric = decimale esatto
  currency  text not null default 'EUR',
  due_date  date,
  paid_date date,
  status    text not null default 'pending'
              check (status in ('pending','paid','cancelled')),
  note      text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists payment_installments_org_idx      on public.payment_installments (organization_id);
create index if not exists payment_installments_project_idx  on public.payment_installments (project_id);
create index if not exists payment_installments_invoice_idx  on public.payment_installments (invoice_id);
create index if not exists payment_installments_contract_idx on public.payment_installments (contract_id);
-- ─────────────── RLS: tabella finanziaria ───────────────
-- Lettura ai membri interni, scrittura solo a chi ha accesso finanziario,
-- coerente con estimates/invoices/payments/transactions/contracts (§30).
alter table public.payment_installments enable row level security;
drop policy if exists payment_installments_finance_read on public.payment_installments;
create policy payment_installments_finance_read on public.payment_installments
  for select using (public.is_internal_org_member(organization_id));
drop policy if exists payment_installments_finance_write on public.payment_installments;
create policy payment_installments_finance_write on public.payment_installments
  for all
  using (public.is_internal_org_member(organization_id) and public.can_finance(organization_id))
  with check (public.is_internal_org_member(organization_id) and public.can_finance(organization_id));

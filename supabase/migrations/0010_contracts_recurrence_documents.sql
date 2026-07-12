-- ============================================================================
-- BnsStudio 1.1.0 — Contratti ricorrenti + varianti documento PDF/Markdown
-- (§10, §11)
--
-- 1) contracts: campi di ricorrenza/rinnovo per gestire contratti ricorrenti,
--    attivi, terminati, futuri (la gerarchia Cliente→Progetto→Contratto è già
--    coperta da client_id/project_id).
-- 2) documents: diventa il "documento logico" che può avere due rappresentazioni
--    della STESSA entità — binaria/originale (PDF in `files`) e machine-readable
--    (Markdown) — e può essere collegato a un contratto, comparendo nell'Archivio.
--
-- Migration ADDITIVA e idempotente: solo add column, nessuna modifica distruttiva.
-- Coperta dalle policy RLS esistenti (contracts_finance_*, documents_member_all).
-- ============================================================================

-- ─────────────── Contratti: ricorrenza / rinnovo ───────────────
alter table public.contracts
  add column if not exists recurrence text not null default 'none',
  add column if not exists auto_renew boolean not null default false,
  add column if not exists renewal_date date,
  add column if not exists billing_cycle text;
-- Vincolo di dominio sui valori di ricorrenza (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contracts_recurrence_check'
  ) then
    alter table public.contracts
      add constraint contracts_recurrence_check
      check (recurrence in ('none','weekly','monthly','quarterly','semiannual','yearly','custom'));
  end if;
end $$;
-- ─────────────── Documenti: varianti PDF + Markdown ───────────────
alter table public.documents
  add column if not exists contract_id uuid references public.contracts(id) on delete set null,
  -- Rappresentazione binaria/originale (PDF) archiviata in `files`/Storage.
  add column if not exists file_id uuid references public.files(id) on delete set null,
  -- Rappresentazione machine-readable per i workflow AI (Claude): sorgente MD
  -- dello stesso documento logico. NON è una conversione casuale del PDF.
  add column if not exists markdown text,
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
create index if not exists documents_contract_idx on public.documents (contract_id);
create index if not exists documents_file_idx on public.documents (file_id);

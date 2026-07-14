-- ============================================================================
-- BnsStudio — Cleanup drift `payment_installments` (post-merge)
--
-- Durante lo sviluppo parallelo la tabella si è ritrovata con COLONNE DUPLICATE:
--   • seq         (0009 pre-merge)  ⇄  installment_number (0011, usata dal codice)
--   • paid_date   (0009 pre-merge)  ⇄  paid_at            (0011, usata dal codice)
--   • note        (0009 pre-merge)  ⇄  notes              (0011, usata dal codice)
--
-- Il codice (installmentService + type PaymentInstallment) usa SOLO la seconda
-- serie. Le colonne pre-merge sono inutilizzate e — verificato in produzione —
-- VUOTE (seq tutti al default 1, paid_date/note NULL). Le rimuoviamo.
--
-- Idempotente (drop ... if exists). NON tocca dati reali.
-- ============================================================================

alter table public.payment_installments
  drop column if exists seq,
  drop column if exists paid_date,
  drop column if exists note;

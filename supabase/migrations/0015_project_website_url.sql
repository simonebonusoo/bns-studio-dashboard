-- ============================================================================
-- BnsStudio 1.1.0 — Riallineamento repo ⇄ produzione
--
-- La colonna projects.website_url risulta GIÀ applicata in produzione (versione
-- 0015 in supabase_migrations.schema_migrations) ma il file mancava nel repo.
-- Questo file riallinea la storia migration locale allo stato remoto reale.
-- Idempotente: non ha effetto se la colonna esiste già.
-- ============================================================================

alter table public.projects
  add column if not exists website_url text;

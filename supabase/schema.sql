-- BNS Studio OS — schema completo.
-- Lo schema è mantenuto nelle migrazioni versionate:
--   supabase/migrations/0001_init.sql   → tabelle, tipi, indici, constraint
--   supabase/migrations/0002_rls.sql    → Row Level Security e helper
--   supabase/migrations/0003_domain_alignment.sql → allineamento non distruttivo
--   supabase/migrations/0004_bootstrap_owner.sql → profilo automatico + bootstrap owner
--   supabase/migrations/0005_rls_baseline.sql     → helper + RLS idempotenti (stato deterministico)
--   supabase/migrations/0006_storage.sql          → bucket Storage + policy
--   supabase/migrations/0007_bootstrap_available.sql → segnale onboarding (bootstrap disponibile?)
-- Applicare con la Supabase CLI:  supabase db push
-- oppure eseguire in ordine i file di migrations/ sul database.
\i migrations/0001_init.sql
\i migrations/0002_rls.sql
\i migrations/0003_domain_alignment.sql
\i migrations/0004_bootstrap_owner.sql
\i migrations/0005_rls_baseline.sql
\i migrations/0006_storage.sql
\i migrations/0007_bootstrap_available.sql

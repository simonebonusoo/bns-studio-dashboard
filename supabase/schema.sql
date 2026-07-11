-- BNS Studio OS — schema completo.
-- Lo schema è mantenuto nelle migrazioni versionate:
--   supabase/migrations/0001_init.sql   → tabelle, tipi, indici, constraint
--   supabase/migrations/0002_rls.sql    → Row Level Security e helper
-- Applicare con la Supabase CLI:  supabase db push
-- oppure eseguire in ordine i file di migrations/ sul database.
\i migrations/0001_init.sql
\i migrations/0002_rls.sql

# Database

## Modalità demo (IndexedDB / Dexie)

Definito in `src/data/db.ts`. Ogni store rispecchia una tabella del modello di dominio. I dati demo sono generati in `src/data/seed.ts` in modo **coerente e interconnesso** (i pagamenti si riferiscono a fatture reali, le ore ai progetti, ecc.) così che le analytics siano calcolabili.

## Modalità produzione (PostgreSQL / Supabase)

Schema in `supabase/migrations/`:

- `0001_init.sql` — tabelle, tipi enum, indici, unique/foreign key, soft delete (`deleted_at`).
- `0002_rls.sql` — Row Level Security (vedi [RLS.md](RLS.md)).

### Tabelle principali

`organizations`, `profiles`, `members`, `companies`, `clients`, `opportunities`, `services`, `projects`, `milestones`, `tasks`, `time_entries`, `estimates`, `invoices`, `payments`, `transactions`, `contracts`, `files`, `calendar_events`, `comments`, `notifications`, `activity_logs`, `documents`.

### Convenzioni

- `id uuid` (default `gen_random_uuid()`).
- `organization_id` su ogni tabella privata → isolamento multi-tenant + RLS.
- `created_at` / `updated_at` / `deleted_at` (soft delete).
- Righe di preventivi/fatture salvate come `jsonb` (`items`) per flessibilità.
- Indici su `(organization_id, <colonna di filtro>)`.

### Applicare lo schema

```bash
supabase db push
# oppure eseguire in ordine i file di supabase/migrations/
```

## Tipi TypeScript

In demo i tipi sono in `src/types`. In produzione si possono generare dai tipi Supabase (`supabase gen types typescript`) e mappare al modello di dominio nel service layer.

# Database

## Modalità demo (IndexedDB / Dexie)

Definito in `apps/web/data/db.ts`. Ogni store rispecchia una tabella del modello di dominio. I dati demo sono generati in `apps/web/data/seed.ts` in modo coerente e interconnesso.

## Modalità produzione (PostgreSQL / Supabase)

Schema in `supabase/migrations/` (tutte applicate al progetto remoto
`twgdcmuxevaddfhjlfcn`):

- `0001_init.sql` — tabelle, tipi enum, indici, unique/foreign key, soft delete (`deleted_at`).
- `0002_rls.sql` — Row Level Security iniziale (vedi [RLS.md](RLS.md)).
- `0003_domain_alignment.sql` — colonne aggiuntive del dominio (non distruttiva).
- `0004_bootstrap_owner.sql` — trigger profilo automatico + funzione `bootstrap_owner` (vedi [BOOTSTRAP.md](BOOTSTRAP.md)).
- `0005_rls_baseline.sql` — helper + policy RLS **idempotenti** (stato deterministico).
- `0006_storage.sql` — bucket Storage privato `bns-files` + policy (vedi [SECURITY.md](SECURITY.md)).

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

### Mapping e tabelle non esposte

- Il layer repository frontend (`apps/web/services/repository.ts`) mantiene un
  mapping esplicito `snake_case` ↔ `camelCase`, type-safe, senza `any` /
  `@ts-ignore`. `undefined` non viene mai inviato; nessuna proprietà camelCase
  raggiunge il database.
- Le tabelle `opportunities`, `milestones`, `tasks`, `comments`, `documents`
  restano nello schema per compatibilità ma **non sono esposte** nella UI
  (Pipeline, Opportunità e Task sono stati rimossi).
- `notifications` e `activity_logs` sono trattate come append-only (senza
  `deleted_at`).

## Tipi TypeScript

I tipi del database sono **generati** dal progetto collegato e versionati in
`apps/web/types/database.generated.ts`:

```bash
supabase gen types typescript --linked --schema public > apps/web/types/database.generated.ts
```

Il client Supabase è tipizzato con `createClient<Database>(...)`. Il dominio
applicativo camelCase vive in `apps/web/types` e il repository fa da ponte con
lo schema snake_case.

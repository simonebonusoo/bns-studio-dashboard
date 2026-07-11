# Modalità demo vs produzione

La selezione è **centralizzata** in `apps/web/config/env.ts` e non è
reimplementata altrove.

## Come viene scelta

```ts
// apps/web/config/env.ts
const demoFlag = VITE_DEMO_MODE === 'true';
const hasSupabaseCredentials = Boolean(VITE_SUPABASE_URL && supabaseKey);
IS_DEMO = demoFlag || !hasSupabaseCredentials;
IS_SUPABASE = !IS_DEMO;
```

dove `supabaseKey = VITE_SUPABASE_PUBLISHABLE_KEY || VITE_SUPABASE_ANON_KEY`.

- **`VITE_DEMO_MODE=true`** oppure credenziali Supabase mancanti → **demo (Dexie)**.
- **`VITE_DEMO_MODE=false` + URL + publishable key** → **produzione (Supabase)**.

Non esiste fallback silenzioso: se in produzione una chiamata Supabase fallisce,
l'errore viene propagato e gestito dalla UI (nessun ripiego su Dexie).

## Demo locale (Dexie / IndexedDB)

- Persistenza: **IndexedDB** via Dexie (`apps/web/data/db.ts`).
- Seeding: `seedDatabase()` in `apps/web/main.tsx` popola i dati alla prima
  apertura (idempotente). Dataset demo: Studio Dentistico Romeo, Kokoro Sushi
  Roma, K9 Security Academy, ChemLab.
- Login: email/password contro lo store `users` (solo demo).
- I dati **persistono al refresh** e restano nel browser dell'utente.

## Produzione (Supabase)

- Auth: **Supabase Auth** reale (`signInWithPassword`, `signOut`, `getSession`,
  `onAuthStateChange`, `resetPasswordForEmail`, `updateUser`).
- Dati: **PostgreSQL + RLS**. Client tipizzato con lo schema reale
  (`apps/web/types/database.generated.ts`).
- File: **Supabase Storage** (bucket privato `bns-files`, URL firmati).
- Il repository Supabase è **implementato** (`apps/web/services/repository.ts`):
  stesse firme `list/get/create/update/remove/hardDelete/count` usate dalla UI.

## Passaggio demo → produzione

1. `supabase db push` — applica schema, RLS, bootstrap, Storage.
2. Compila `.env` (in `apps/web/`):

   ```
   VITE_DEMO_MODE=false
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   # opzionale: VITE_SUPABASE_STORAGE_BUCKET=bns-files
   ```
3. Registra il primo utente via Supabase Auth (dashboard o signup) e chiama il
   bootstrap owner (vedi [BOOTSTRAP.md](BOOTSTRAP.md)).
4. **Non** importare automaticamente i dati demo: restano solo in Dexie.

> La `VITE_SUPABASE_ANON_KEY` è accettata solo per retrocompatibilità: la
> configurazione principale è la **publishable key**. Nessun secret/service role
> nel frontend.

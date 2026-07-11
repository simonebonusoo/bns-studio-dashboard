# Modalità demo vs produzione

## Come viene scelta

`src/config/env.ts`:

```ts
IS_DEMO = VITE_DEMO_MODE === 'true' || !VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY
```

Senza credenziali Supabase → **demo locale**.

## Demo locale

- Persistenza: **IndexedDB** via Dexie (`src/data/db.ts`).
- Seeding: `seedDatabase()` in `src/main.tsx` popola i dati alla prima apertura (idempotente, protetto da un flag in `meta`).
- Login: verifica email/password contro lo store `users` (solo demo — nessuna password reale).
- Reset: `resetDemo()` (Impostazioni → Ripristina demo) cancella e ricarica i dati iniziali.
- I dati **persistono al refresh** e restano nel browser dell'utente.

## Produzione

- Auth: Supabase Auth (email/password; Google/GitHub/2FA predisposti).
- Dati: PostgreSQL + RLS; Storage per i file; Realtime dove utile.
- Il service layer (`src/services/repository.ts`) va esteso con l'adapter Supabase mantenendo le stesse firme già usate dalla UI.
- **Nessun secret** nel frontend: solo `VITE_SUPABASE_ANON_KEY`. La service role key resta lato Edge Functions.

## Passaggio demo → produzione

1. `supabase db push` (schema + RLS).
2. Compila `.env` con URL e anon key.
3. Implementa l'adapter Supabase nel service layer.
4. (Opzionale) importa i dati demo con `supabase/seed.sql` + procedura di import.

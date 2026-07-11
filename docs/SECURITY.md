# Sicurezza

## Applicato

- **RLS** su tutte le tabelle con `organization_id` (produzione).
- **Autorizzazione per ruolo** in UI (`can()`), rafforzata da RLS lato DB.
- **Validazione input** con Zod nei form.
- **Soft delete** (`deleted_at`) con conferma per operazioni distruttive (`ConfirmDialog`).
- **Error boundary** applicativa: nessuno stack trace sensibile mostrato all'utente.
- **Nessun secret nel frontend**: solo la `anon key`. Service role e chiavi Stripe restano nelle Edge Functions.
- **Rendering sicuro**: React esegue l'escaping; nessun `dangerouslySetInnerHTML` su input utente.

## Da completare in produzione

- Sanitizzazione dell'HTML per l'editor documenti rich text (TipTap) quando abilitato.
- Policy RLS dedicate al ruolo `client` (vedi [RLS.md](RLS.md)).
- URL firmati e MIME/limiti dimensione per Supabase Storage.
- Rate limiting su Edge Functions per gli endpoint pubblici (es. webhook).
- 2FA (predisposta) e gestione sessioni/dispositivi.

## Dati sensibili

In produzione **non** salvare dati finanziari sensibili in `localStorage`. In demo i dati restano in IndexedDB locale al browser e sono dichiaratamente dimostrativi.

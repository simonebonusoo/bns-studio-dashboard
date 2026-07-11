# Sicurezza

## Applicato

- **RLS** su tutte le tabelle con `organization_id` (produzione).
- **Autorizzazione per ruolo** in UI (`can()`), rafforzata da RLS lato DB.
- **Validazione input** con Zod nei form.
- **Soft delete** (`deleted_at`) con conferma per operazioni distruttive (`ConfirmDialog`).
- **Error boundary** applicativa: nessuno stack trace sensibile mostrato all'utente.
- **Nessun secret nel frontend**: solo la **publishable key** (o anon key per
  retrocompatibilità). Service role e chiavi Stripe restano lato server / Edge.
- **Storage privato**: bucket `bns-files` non pubblico, accesso solo via **URL
  firmati** temporanei; isolamento per organizzazione via path + policy
  (`0006_storage.sql`). Limite dimensione lato bucket (50MB) e lato app
  (`VITE_MAX_UPLOAD_SIZE_MB`, default 25MB); MIME validato in upload.
- **Rendering sicuro**: React esegue l'escaping; nessun `dangerouslySetInnerHTML` su input utente.

## Da completare in produzione

- Sanitizzazione dell'HTML per l'editor documenti rich text (TipTap) quando abilitato.
- Policy RLS dedicate al ruolo `client` per il portale (oggi il client non ha
  alcun accesso ai dati interni — stato conservativo e **sicuro**; vedi [RLS.md](RLS.md)).
- Allow-list MIME a livello di bucket (attualmente validazione lato app).
- Rate limiting su Edge Functions per gli endpoint pubblici (es. webhook).
- 2FA (predisposta) e gestione sessioni/dispositivi.

## Dati sensibili

In produzione **non** salvare dati finanziari sensibili in `localStorage`. In demo i dati restano in IndexedDB locale al browser e sono dichiaratamente dimostrativi.

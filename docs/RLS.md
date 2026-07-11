# Row Level Security

Definita inizialmente in `supabase/migrations/0002_rls.sql` e **riaffermata in
modo idempotente** in `0005_rls_baseline.sql`. Quest'ultima garantisce che, sul
database remoto, helper e policy esistano davvero (lo stato precedente della
0002 non era verificabile): funzioni `create or replace`, policy `drop policy if
exists` + `create`. La separazione tra organizzazioni è applicata **a livello di
database**, non solo nel frontend.

## Funzioni helper

- `is_org_member(org uuid)` — l'utente autenticato (`auth.uid()`) è membro attivo dell'organizzazione.
- `org_role(org uuid)` — ruolo dell'utente nell'organizzazione.
- `can_finance(org uuid)` — `true` per `owner`, `admin`, `project_manager`, `accountant`.
- `is_internal_org_member(org uuid)` — membro attivo con ruolo **≠ `client`**.

Tutte `SECURITY DEFINER STABLE` con `search_path = public`.

## Regole

| Ambito | Policy |
|--------|--------|
| `profiles` | ognuno legge/aggiorna il proprio record |
| `organizations` | lettura ai soli membri interni |
| Tabelle standard | accesso completo ai soli membri interni dell'organizzazione |
| Tabelle finanziarie (`estimates`, `invoices`, `payments`, `transactions`, `contracts`) | lettura ai membri interni, scrittura solo a chi passa `can_finance()` |

## Da completare per il portale cliente

Il ruolo `client` oggi è trattato in modo conservativo: **nessun accesso privato di default**.

Per esporre un portale cliente servono policy aggiuntive read-only:

- vedere solo i propri progetti (via `clients.owner` / associazione cliente↔utente);
- solo elementi con `client_visible = true` (milestone, deliverable, file, commenti con `visibility='client'`);
- **mai** note interne, costi, margini, tariffe o altri clienti.

Questi filtri vanno espressi come policy `USING` dedicate per ciascuna tabella esposta al portale prima di aprire l'accesso live ai clienti.

## Storage

Il bucket privato `bns-files` isola gli oggetti per organizzazione tramite il
primo segmento del path (`<organization_id>/...`) e la funzione
`is_internal_org_member` (vedi `0006_storage.sql`). Accesso ai file solo via URL
firmati temporanei.

## Principio

> Nessun controllo di autorizzazione sostanziale deve dipendere solo dal frontend. La UI nasconde ciò che l'utente non può fare; l'RLS **impedisce** l'accesso ai dati.

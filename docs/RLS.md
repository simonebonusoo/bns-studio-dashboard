# Row Level Security

Definita in `supabase/migrations/0002_rls.sql`. La separazione tra organizzazioni è applicata **a livello di database**, non solo nel frontend.

## Funzioni helper

- `is_org_member(org uuid)` — l'utente autenticato (`auth.uid()`) è membro attivo dell'organizzazione.
- `org_role(org uuid)` — ruolo dell'utente nell'organizzazione.
- `can_finance(org uuid)` — `true` per `owner`, `admin`, `project_manager`, `accountant`.

## Regole

| Ambito | Policy |
|--------|--------|
| `profiles` | ognuno legge/aggiorna il proprio record |
| `organizations` | lettura ai soli membri |
| Tabelle standard (clienti, progetti, task, file, commenti, …) | tutte le operazioni consentite ai membri dell'organizzazione |
| Tabelle finanziarie (`estimates`, `invoices`, `payments`, `transactions`, `contracts`) | lettura ai membri, **scrittura solo** a chi passa `can_finance()` |

## Da completare per il portale cliente

Il ruolo `client` richiede policy aggiuntive (documentate come TODO nel file SQL):

- vedere solo i propri progetti (via `clients.owner` / associazione cliente↔utente);
- solo elementi con `client_visible = true` (milestone, deliverable, file, commenti con `visibility='client'`);
- **mai** note interne, costi, margini, tariffe o altri clienti.

Questi filtri vanno espressi come policy `USING` dedicate per ciascuna tabella esposta al portale.

## Principio

> Nessun controllo di autorizzazione sostanziale deve dipendere solo dal frontend. La UI nasconde ciò che l'utente non può fare; l'RLS **impedisce** l'accesso ai dati.

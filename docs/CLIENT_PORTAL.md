# Portale cliente

> **Stato: predisposto/parziale.** Il ruolo `client`, i flag `client_visible` e le `visibility` dei commenti esistono nel modello dati e nella UI; il set completo di pagine dedicate al cliente e le policy RLS relative sono da completare.

## Principio

Il cliente accede a una vista **separata e ridotta**: vede solo i propri dati condivisi e non ha accesso a informazioni interne.

## Il cliente PUÒ vedere

Propri progetti, stato, milestone e timeline pubbliche (`client_visible=true`), deliverable/file condivisi, revisioni, commenti `visibility='client'`, preventivi, contratti, fatture, pagamenti, scadenze.

## Il cliente NON deve vedere

Note interne, margini, costi, tariffe interne, workload, altri clienti, commenti `visibility='internal'`, attività riservate.

## Implementazione

- **Dati**: già presenti i campi `client_visible` (task, milestone, file) e `visibility` (commenti).
- **RLS**: le policy per il ruolo `client` sono documentate come TODO in `supabase/migrations/0002_rls.sql` — vanno filtrate su associazione cliente↔utente e sui flag di visibilità.
- **UI**: le pagine `/portal`, `/portal/projects/:id`, approvazioni deliverable sono da aggiungere come layout separato con guardia sul permesso `client_portal.access`.

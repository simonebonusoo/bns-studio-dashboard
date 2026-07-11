# BNS Markdown Import Architecture

## Flusso

```text
upload locale
-> parse Markdown
-> entity extraction
-> normalization
-> duplicate detection
-> review UI
-> repositories
-> Supabase / Dexie
```

## Layer

- `apps/web/features/import/ImportPage.tsx`
  Responsabile solo della UX wizard.
- `apps/web/services/markdownImport/markdownParser.ts`
  Parsing deterministic/local del documento.
- `entityExtractor.ts`
  Costruzione di `ImportCandidate` intermedi non persistiti.
- `duplicateDetector.ts`
  Confronto con i dati reali e risoluzione hints.
- `importExecutor.ts`
  Import ordinato via repository esistenti.
- `apps/web/services/repository.ts`
  Persistenza coerente con organization isolation, activity log e invalidation.

## Modello intermedio

Il parser non crea direttamente record Supabase. Usa invece `ImportCandidate`:

- `temporaryId`
- `entityType`
- `sourceFile`
- `sourceSection`
- `confidence`
- `rawFields`
- `normalizedFields`
- `relationshipHints`
- `warnings`
- `duplicateStatus`
- `action`

## Ordine import

Ordine attuale:

1. `clients`
2. `services`
3. `projects`
4. `estimates`
5. `contracts`
6. `invoices`
7. `payments`
8. `transactions`
9. `events`

## Duplicati

Matching principale:

- client: `vat` -> `email` -> `displayName`
- service: `name`
- project: `code` oppure `name + client`
- estimate/contract/invoice: `number`
- payment: `client + invoice + amount + date + reference`
- transaction: `type + amount + date + description`
- event: `title + start`

Stati duplicato:

- `new`
- `existing_identical`
- `existing_different`
- `ambiguous_match`
- `invalid`

## Failure model

Non c e transazione cross-table frontend.

Ogni record passa per stati runtime:

- `pending`
- `importing`
- `success`
- `failed`
- `skipped`

Il batch puo quindi completarsi con errori parziali senza fingere atomicita.

## Import history

La tabella `markdown_imports` salva:

- file importati
- numero candidate
- conteggi creati/aggiornati/skippati/falliti
- summary sintetico non sensibile

## Sicurezza

- nessuna query `supabase.from(...)` nei componenti React
- nessun secondo data layer persistente
- validazione prima della persistenza
- activity feed alimentato dagli stessi repository
- query invalidation su dashboard e analytics dopo le mutation

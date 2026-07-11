# BnsStudio Functional Audit

## Entita esposte in UI

- clients
- services
- projects
- estimates
- contracts
- invoices
- payments
- transactions
- calendar events
- files

Non sono state reintrodotte UI per:

- pipeline
- opportunities
- task management operativa

## Markdown Importer

Stato attuale:

- route `/import`
- wizard in 4 step
- parsing locale di file `.md` e `.markdown`
- supporto multi-file e multi-entity
- duplicate detection
- review modificabile prima dell import
- persistenza via repository
- import history persistita in `markdown_imports`

## CRUD e azioni distruttive

Azioni esplicitate o rinforzate in UI:

- projects: modifica, archivia, elimina definitivamente
- estimates: modifica, elimina
- invoices: modifica, elimina
- transactions: modifica, elimina

Azioni gia presenti e mantenute:

- clients
- services
- contracts
- payments
- calendar events
- files

## Delete safety

Guardrail principali:

- blocco hard delete di project se esistono milestone, time entry, fatture, pagamenti, contratti, file, eventi o movimenti collegati
- blocco delete di estimate se esistono contratti o fatture collegati
- blocco delete di invoice se esistono pagamenti collegati
- warning espliciti su delete di pagamenti e movimenti finanziari

# BnsStudio Data Model

## Entita primarie

- `clients`
- `services`
- `projects`
- `estimates`
- `contracts`
- `invoices`
- `payments`
- `transactions`
- `calendar_events`
- `files`
- `markdown_imports`

## Relazioni principali

- `projects.clientId -> clients.id`
- `projects.serviceId -> services.id`
- `estimates.clientId -> clients.id`
- `contracts.clientId -> clients.id`
- `contracts.projectId -> projects.id`
- `contracts.estimateId -> estimates.id`
- `invoices.clientId -> clients.id`
- `invoices.projectId -> projects.id`
- `invoices.estimateId -> estimates.id`
- `payments.clientId -> clients.id`
- `payments.invoiceId -> invoices.id`
- `payments.projectId -> projects.id`
- `transactions.clientId -> clients.id`
- `transactions.projectId -> projects.id`
- `calendar_events.clientId -> clients.id`
- `calendar_events.projectId -> projects.id`
- `files.clientId -> clients.id`
- `files.projectId -> projects.id`

## Import history

`markdown_imports` contiene metadati sintetici per audit:

- `file_names`
- `files_count`
- `candidate_count`
- `created_count`
- `updated_count`
- `skipped_count`
- `failed_count`
- `status`
- `summary`

## Persistenza

- produzione: Supabase/PostgreSQL
- demo: Dexie/IndexedDB
- accesso sempre via repository tipizzati

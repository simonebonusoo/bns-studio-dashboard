# Ruoli e permessi

Sorgente di verità: `src/features/auth/permissions.ts`. In UI si usa `useAuth().can(permission)`.

## Ruoli

`owner`, `admin`, `project_manager`, `designer`, `developer`, `collaborator`, `accountant`, `client`.

## Permessi granulari

`clients.read/write/delete`, `projects.read/write/assign/archive`, `time.log/approve`, `finances.read/manage`, `estimates.read/manage`, `invoices.read/manage`, `payments.manage`, `team.read/manage`, `files.read/write`, `settings.manage`, `audit.read`, `imports.manage`, `automations.manage`, `client_portal.access`.

## Matrice sintetica

| Ruolo | Clienti | Progetti | Time | Finanze | Team | Impostazioni |
|-------|---------|----------|------|---------|------|--------------|
| owner | ✔ tutto | ✔ | ✔ | ✔ | ✔ | ✔ |
| admin | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| project_manager | lettura/scrittura | ✔ + assegna | ✔ | lettura preventivi/fatture | lettura | — |
| designer / developer | lettura | assegnati | ✔ | — | — | — |
| collaborator | — | assegnati | ✔ | — | — | — |
| accountant | lettura | lettura | — | ✔ gestione | — | — |
| client | nessun accesso privato di default | nessun accesso privato di default | — | — | — | — |

I permessi finanziari determinano anche la visibilità di margini, budget e saldo documenti.

`imports.manage` abilita la sezione `Importa Markdown` e la gestione del wizard di import.

In produzione l'RLS rafforza questi permessi. Il ruolo `client` oggi è bloccato di default finché non verranno introdotte policy read-only su dati esplicitamente condivisi.

# Ruoli e permessi

Sorgente di verità: `src/features/auth/permissions.ts`. In UI si usa `useAuth().can(permission)`.

## Ruoli

`owner`, `admin`, `project_manager`, `designer`, `developer`, `collaborator`, `accountant`, `client`.

## Permessi granulari

`clients.read/write/delete`, `leads.read/write`, `projects.read/write/assign/archive`, `tasks.read/manage`, `time.log/approve`, `finances.read/manage`, `estimates.read/manage`, `invoices.read/manage`, `payments.manage`, `team.read/manage`, `files.read/write`, `settings.manage`, `audit.read`, `automations.manage`, `client_portal.access`.

## Matrice sintetica

| Ruolo | Clienti | Progetti | Task | Finanze | Team | Impostazioni |
|-------|---------|----------|------|---------|------|--------------|
| owner | ✔ tutto | ✔ | ✔ | ✔ | ✔ | ✔ |
| admin | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (no eliminazione org) |
| project_manager | lettura/scrittura | ✔ + assegna | ✔ | lettura preventivi/fatture | lettura | — |
| designer / developer | lettura | assegnati | ✔ (assegnati) | — | — | — |
| collaborator | — | assegnati | assegnati | — | — | — |
| accountant | lettura | lettura | — | ✔ gestione | — | — |
| client | — | portale (propri) | — | propri documenti | — | — |

I permessi finanziari (`finances.*`, `payments.manage`, ecc.) determinano anche la **visibilità dei margini/costi** nelle pagine progetto.

In produzione questi permessi sono rafforzati dall'RLS (vedi [RLS.md](RLS.md)): il frontend nasconde, il database blocca.

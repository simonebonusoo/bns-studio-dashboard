# Architettura

## Principi

- **Monorepo semplice**: `apps/web` ospita l'app React/Vite, `apps/desktop` la shell Tauri, `apps/api` solo predisposizioni server-side leggere.
- **Separazione dei livelli**: UI (`components`, `features`) → hook dati (`hooks`) → service layer (`services`) → repository (`demo` Dexie / `production` Supabase).
- **Nessuna query DB nei componenti React**: la UI passa sempre da hook o
  service. I componenti non chiamano mai direttamente Dexie, `supabase.from()`
  o Supabase Storage.
- **Interfaccia dati unica**: ogni repository espone `list/get/create/update/remove/hardDelete/count`.
- **Client Supabase unico e tipizzato** (`services/supabase.ts`,
  `createClient<Database>`), publishable key, sessione persistita.
- **File**: `services/fileService.ts` è l'unico punto che tocca lo storage
  binario (Supabase Storage in prod con URL firmati, data-URI in demo).
- **Stato**: React Query per i dati persistiti, Zustand solo per auth/UI/timer.

## Flusso di una scrittura

```
Form (RHF + Zod) → useCreate/useUpdate (React Query)
  → repositories.<entity>.create() (service)
  → Dexie (demo) | Supabase (prod)
  → invalidateQueries([entity]) + [analytics]
  → UI e grafici si aggiornano
```

## Struttura app

`apps/web` resta organizzata per feature: `app`, `components`, `features`, `hooks`, `services`, `data`, `lib`, `stores`, `types`, `schemas`.

I moduli commerciali `Pipeline`, `Opportunità` e `Task` non sono più presenti nella UI esposta.

## Calcoli di dominio

La logica economica (`src/lib/finance.ts`) è **pura e testata**: totali documento, IVA, sconti, ritenuta, saldo fattura, redditività progetto. Nessun calcolo economico è duplicato nella UI.

## Analytics

`services/analytics.ts` aggrega solo dati reali di pagamenti, fatture, progetti, servizi e time tracking. Nessun array statico, nessuna sezione analytics separata per "finanza".

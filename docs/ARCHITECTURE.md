# Architettura

## Principi

- **Separazione dei livelli**: UI (`components`, `features`) → hook dati (`hooks`) → service layer (`services`) → sorgente dati (Dexie in demo, Supabase in produzione). I componenti non interrogano mai direttamente il database.
- **Un'unica interfaccia dati**: `createRepository()` espone `list/get/create/update/remove`. La stessa firma sarà reimplementata su Supabase senza toccare la UI.
- **Modello di dominio tipizzato** in `src/types` (entità + enum), condiviso da UI, service e validazioni.
- **Validazione ai bordi** con Zod (`src/schemas`) nei form.
- **Stato**: React Query per i dati server/persistiti; Zustand solo per stato applicativo (auth, tema/sidebar, timer).

## Flusso di una scrittura

```
Form (RHF + Zod) → useCreate/useUpdate (React Query)
  → repositories.<entity>.create() (service)
  → Dexie (demo) | Supabase (prod)
  → invalidateQueries([entity]) + [analytics]
  → UI e grafici si aggiornano
```

## Modularità per feature

Ogni cartella in `src/features/*` contiene pagine e componenti di quel dominio. Il routing (`src/app/router.tsx`) usa `lazy()` + `Suspense` per code splitting: ogni pagina è un chunk separato.

## Calcoli di dominio

La logica economica (`src/lib/finance.ts`) è **pura e testata**: totali documento, IVA, sconti, ritenuta, saldo fattura, redditività progetto. Nessun calcolo economico è duplicato nella UI.

## Analytics

`src/services/analytics.ts` aggrega i dati reali (pagamenti, fatture, progetti, ore, pipeline) in un unico oggetto consumato dalla dashboard e dalla pagina Analytics — nessun dato inventato o array statico.

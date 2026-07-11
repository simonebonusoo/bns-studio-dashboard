# BNS Studio OS

Il **sistema operativo interno** dello studio creativo BNS Studio: CRM, progetti, task, time tracking, preventivi, fatture, pagamenti, analytics — in un'unica applicazione. Costruito come MVP reale e come fondazione tecnica per un futuro gestionale SaaS multi-organizzazione.

> **Stato:** MVP funzionante in **modalità demo locale** (IndexedDB). Il backend Supabase è **predisposto** (schema + RLS pronti) ma non collegato a un progetto live. Vedi [Limiti attuali](#limiti-attuali).

---

## Stack

| Area | Tecnologie |
|------|-----------|
| Frontend | React 18, Vite 6, TypeScript strict, Tailwind CSS |
| Routing / dati | React Router 6 (lazy + code splitting), TanStack Query, TanStack Table |
| Form / validazione | React Hook Form, Zod |
| Stato | Zustand (auth, UI, timer) |
| Grafici | Recharts |
| Drag & drop | dnd-kit (pipeline + kanban task) |
| Persistenza demo | Dexie (IndexedDB) |
| Backend (predisposto) | Supabase — PostgreSQL, Auth, Storage, RLS, Edge Functions |
| Notifiche | Sonner · Icone: Lucide · Date: date-fns |
| Test | Vitest + Testing Library |

## Avvio rapido

```bash
npm install
npm run dev      # http://localhost:5173  (parte in demo locale, nessun backend richiesto)
```

Altri comandi:

```bash
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint
npm run test        # vitest
npm run build       # build di produzione
```

## Modalità demo locale

Senza variabili `VITE_SUPABASE_*` (o con `VITE_DEMO_MODE=true`) l'app:

- parte senza backend e **popola IndexedDB** con dati demo realistici alla prima apertura;
- salva ogni modifica localmente nel browser (persiste al refresh);
- mostra un badge "Demo locale";
- permette di ripristinare i dati demo da **Impostazioni → Ripristina demo**.

### Credenziali demo

| Ruolo | Email | Password |
|-------|-------|----------|
| Proprietario | `admin@bnsstudio.demo` | `admin1234` |
| Project Manager | `manager@bnsstudio.demo` | `manager1234` |
| Designer | `designer@bnsstudio.demo` | `designer1234` |
| Collaboratore | `collaborator@bnsstudio.demo` | `collaborator1234` |
| Cliente | `client@bnsstudio.demo` | `client1234` |

## Modalità produzione (Supabase)

1. Crea un progetto Supabase e applica le migrazioni:
   ```bash
   supabase db push        # esegue supabase/migrations/0001_init.sql + 0002_rls.sql
   ```
2. Compila `.env` (vedi `.env.example`) con `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Il service layer (`src/services`) è progettato per esporre le stesse firme sia in demo sia su Supabase: l'adapter Supabase va implementato in `repository.ts` mantenendo l'interfaccia.

Dettagli in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) e [docs/DEMO_MODE.md](docs/DEMO_MODE.md).

## Struttura

```
src/
  app/          router, layout (sidebar/topbar), providers, guardie route
  components/   ui/ charts/ tables/ navigation/ feedback/  (design system)
  features/     auth, dashboard, clients, leads, projects, tasks, calendar,
                team, time-tracking, estimates, contracts, invoices, payments,
                finance, analytics, files, services, settings, notifications
  services/     repository (Dexie), analytics, projectService
  data/         db.ts (schema Dexie) + seed.ts (dati demo)
  lib/          finance (calcoli testati), format, cn, id
  hooks/        useEntities (CRUD via React Query), useAnalytics
  schemas/      validazioni Zod
  types/        modello di dominio + enum
  config/       env, brandConfig
supabase/       migrations/ (schema + RLS), functions/, seed.sql
tests/          unit/ (calcoli finanziari)
docs/           ARCHITECTURE, DATABASE, RLS, PERMISSIONS, DEMO_MODE, FINANCE,
                CLIENT_PORTAL, SECURITY, TESTING, DEPLOYMENT, ROADMAP
```

## Cosa funziona davvero (MVP)

- **Auth demo** con sessione persistente e route protette per ruolo.
- **RBAC**: 8 ruoli con permessi granulari applicati in UI (e via RLS in produzione).
- **Dashboard** con KPI e grafici **calcolati dai dati reali** del database.
- **CRM clienti**: lista, filtri, ricerca, creazione/modifica, dettaglio, export CSV.
- **Pipeline** commerciale con **drag & drop** (dnd-kit) e aggiornamento probabilità.
- **Progetti**: griglia/lista, creazione, dettaglio con redditività, board task.
- **Task**: kanban drag & drop; il completamento aggiorna l'avanzamento del progetto.
- **Time tracking**: timer globale avviabile → crea registrazioni reali; timesheet.
- **Preventivi/Fatture**: calcolo reale di imponibile, sconti, IVA, ritenuta, totale; stampa/PDF via browser; conversione preventivo→fattura.
- **Pagamenti**: registrazione che **aggiorna il saldo** della fattura.
- **Entrate/uscite**, **Analytics** (economici + operativi), **Team/workload**, **Calendario**, **File**, **Servizi**, **Notifiche**, **Impostazioni**.

Vedi il report di stato dettagliato in fondo a questo file e in [docs/ROADMAP.md](docs/ROADMAP.md).

## Limiti attuali

- Supabase **non è collegato**: l'app gira in demo locale. Schema e RLS sono forniti e pronti da applicare, l'adapter dati Supabase è da implementare mantenendo le firme del service layer.
- **Portale cliente**, contratti con firma, automazioni ed editor documenti rich text (TipTap) sono **predisposti/parziali** (dati e UI di base presenti, workflow completo da estendere).
- Upload file in demo salva **metadati** (Supabase Storage in produzione).
- I test E2E (Playwright) e l'ampia suite d'integrazione sono **da aggiungere**; sono presenti i test unitari sui calcoli finanziari.

## Disclaimer

BNS Studio OS è uno strumento **gestionale interno**. Non sostituisce consulenza fiscale o legale e **non è un servizio certificato di fatturazione elettronica**: le fatture generate vanno verificate. I dati finanziari dipendono dalla correttezza dei dati inseriti.

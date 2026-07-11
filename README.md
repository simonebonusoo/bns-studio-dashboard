# BNS Studio OS

Sistema operativo interno per BNS Studio, ripulito e semplificato attorno ai moduli operativi realmente esposti:

- Dashboard
- Clienti
- Progetti
- Calendario
- Time Tracking
- Membri / Workload
- Preventivi, Contratti, Fatture, Pagamenti, Entrate e uscite
- Analytics
- File
- Servizi
- Notifiche
- Impostazioni

`Pipeline`, `Opportunità` e `Task` non sono più esposti nell'interfaccia. Le relative strutture DB restano mantenute solo come predisposizione tecnica non pubblica.

## Monorepo

```text
apps/
  web/       React + Vite
  desktop/   Tauri shell
  api/       predisposizione server-side minimale
packages/
  ui/
  types/
  config/
  shared/
supabase/
docs/
tests/
```

## Avvio

```bash
npm install
npm run dev
```

Script disponibili dalla root:

```bash
npm run dev
npm run dev:web
npm run dev:desktop
npm run build
npm run build:web
npm run build:desktop
npm run typecheck
npm run lint
npm run test
```

## Modalità dati

- `demo`: IndexedDB via Dexie con seed locale coerente sui soli clienti Romeo, Kokoro, K9 e ChemLab
- `production`: repository Supabase **implementato** (Auth + PostgreSQL + RLS +
  Storage), stesse firme CRUD del layer demo, client tipizzato con lo schema reale

Le variabili usate dal frontend (in `apps/web/.env`) sono:

```bash
VITE_DEMO_MODE=false                 # true (o credenziali mancanti) → demo Dexie
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # chiave client principale
# VITE_SUPABASE_ANON_KEY=...         # accettata solo per retrocompatibilità
# VITE_SUPABASE_STORAGE_BUCKET=bns-files
```

Nessun secret / service role nel frontend. Passaggio a Supabase: vedi
[docs/DEMO_MODE.md](docs/DEMO_MODE.md) e [docs/BOOTSTRAP.md](docs/BOOTSTRAP.md).

## Credenziali demo

| Ruolo | Email | Password |
|------|------|------|
| Owner | `admin@bnsstudio.demo` | `admin1234` |
| Project Manager | `manager@bnsstudio.demo` | `manager1234` |
| Designer | `designer@bnsstudio.demo` | `designer1234` |
| Developer | `dev@bnsstudio.demo` | `developer1234` |
| Accountant | `finance@bnsstudio.demo` | `finance1234` |

## Stato reale

- Il dataset demo è piccolo, coerente e riconciliabile.
- Analytics usa solo dati reali del seed o del repository attivo.
- Il layer React non interroga direttamente Dexie o Supabase.
- La web app builda correttamente dal workspace `apps/web`.
- La shell desktop è configurata in `apps/desktop`, ma in questo ambiente il comando `tauri` non è disponibile, quindi build e run desktop non sono verificabili end-to-end.

Dettagli aggiuntivi in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/RLS.md](docs/RLS.md) e [docs/TESTING.md](docs/TESTING.md).

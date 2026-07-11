# Test

## Presenti

**Unit — calcoli finanziari** (`tests/unit/finance.test.ts`, 13 test, Vitest):

- totale riga (quantità, sconto riga, IVA);
- totali documento (sconto globale, ritenuta, acconto);
- somma pagamenti (completed/refunded/pending);
- saldo fattura (unpaid / partially_paid / paid);
- redditività progetto (costo lavoro, margine, scostamento ore, timer esclusi).

```bash
npm run test
```

## Da aggiungere (predisposto)

- **Integrazione**: creazione cliente/progetto, conversione preventivo→fattura, registrazione pagamento, vista file lista/griglia, controllo permessi.
- **E2E**: login demo, dashboard, timesheet, file manager, fatturazione, analytics, logout.

## Qualità

```bash
npm run typecheck   # TypeScript strict, 0 errori
npm run lint        # ESLint
npm run build:web   # build web
```

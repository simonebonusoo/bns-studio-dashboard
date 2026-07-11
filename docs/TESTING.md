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

- **Integrazione** (Testing Library + Vitest, ambiente jsdom già configurato): creazione cliente/lead/progetto/task, cambio fase opportunità, conversione preventivo→fattura, registrazione pagamento e aggiornamento saldo, controllo permessi.
- **E2E** (Playwright): login demo, creazione entità, drag & drop kanban, avvio/stop timer, flusso preventivo→fattura→pagamento, analytics, logout. La cartella `tests/e2e/` è prevista dalla configurazione (`vitest` la esclude).

## Qualità

```bash
npm run typecheck   # TypeScript strict, 0 errori
npm run lint        # ESLint
npm run build       # build di produzione
```

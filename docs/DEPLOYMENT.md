# Deploy

## Build

```bash
npm run build      # genera dist/ (statico)
npm run preview    # anteprima locale della build
```

L'output è un'app statica: deployabile su Vercel, Netlify, Cloudflare Pages o qualsiasi hosting statico. Configurare il **fallback SPA** su `index.html` (rewrite di tutte le route).

## Variabili ambiente

Minime per la demo: nessuna. Per la produzione (in `apps/web/.env`):
`VITE_DEMO_MODE=false`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
(la `VITE_SUPABASE_ANON_KEY` è accettata solo per retrocompatibilità).

## Supabase

1. Crea/collega il progetto Supabase (già collegato: ref `twgdcmuxevaddfhjlfcn`).
2. Applica le migrazioni (già applicate al remoto):
   ```bash
   supabase link --project-ref <ref>
   supabase db push   # 0001 … 0006 (schema, RLS, bootstrap, Storage)
   ```
3. Genera i tipi dopo modifiche allo schema:
   ```bash
   supabase gen types typescript --linked --schema public > apps/web/types/database.generated.ts
   ```
4. Il bucket Storage privato `bns-files` e le policy sono creati da
   `0006_storage.sql`.
5. Crea il primo owner: vedi [BOOTSTRAP.md](BOOTSTRAP.md).
6. Deploy Edge Functions predisposte:
   ```bash
   supabase functions deploy stripe-webhook
   supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
   ```

## Checklist pre-produzione

- [x] Migrazioni applicate al remoto (0001–0006).
- [x] Repository/adapter Supabase implementato (Auth + DB + Storage).
- [x] `.env` senza service role key nel frontend (solo publishable key).
- [x] `npm run typecheck && npm run lint && npm run test && npm run build` verdi.
- [ ] RLS verificata a runtime con utenti di ruoli diversi (owner/accountant/collaborator).
- [ ] Rewrite SPA configurato sull'hosting.
- [ ] Primo owner creato via bootstrap.

# Deploy

## Build

```bash
npm run build      # genera dist/ (statico)
npm run preview    # anteprima locale della build
```

L'output è un'app statica: deployabile su Vercel, Netlify, Cloudflare Pages o qualsiasi hosting statico. Configurare il **fallback SPA** su `index.html` (rewrite di tutte le route).

## Variabili ambiente

Vedi `.env.example`. Minime per la demo: nessuna. Per la produzione: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Supabase

1. Crea il progetto Supabase.
2. Applica le migrazioni:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
3. (Opzionale) `supabase/seed.sql` per l'organizzazione iniziale.
4. Crea i bucket Storage e le policy per i file privati.
5. Deploy Edge Functions predisposte:
   ```bash
   supabase functions deploy stripe-webhook
   supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
   ```

## Checklist pre-produzione

- [ ] Migrazioni applicate, RLS verificata con utenti di ruoli diversi.
- [ ] Adapter Supabase del service layer implementato.
- [ ] `.env` senza service role key nel frontend.
- [ ] Rewrite SPA configurato.
- [ ] `npm run typecheck && npm run lint && npm run test && npm run build` verdi.

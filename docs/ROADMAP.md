# Roadmap

## Stato moduli

| Modulo | Stato |
|--------|-------|
| Monorepo `apps/web` + `apps/desktop` + `apps/api` | ✅ Completo |
| Dashboard operativa semplificata | ✅ Completo |
| CRM clienti essenziale | ✅ Completo |
| Progetti, Calendario, Time tracking | ✅ Completo |
| Team + Workload | ✅ Completo |
| Preventivi, Contratti, Fatture, Pagamenti, Entrate/Uscite | ✅ Completo |
| Analytics (Panoramica + Operazioni) | ✅ Completo |
| File manager lista/griglia persistente | ✅ Completo |
| Supabase repository layer tipizzato | ✅ Implementato (client tipizzato, mapping type-safe); da validare a runtime |
| Auth produzione (Supabase) | ✅ Implementata (login/logout/session/reset/updateUser) |
| Bootstrap primo owner | ✅ Funzione SQL `bootstrap_owner` + trigger profilo |
| Supabase Storage (file manager) | ✅ Bucket privato + policy + URL firmati |
| Schema DB + RLS | ✅ Migrazioni 0001–0006 applicate; policy client ancora conservative (sicure) |
| Shell desktop Tauri | 🟡 Configurata, non verificabile qui senza comando `tauri` |
| Portale cliente condiviso | ⬜ Da completare con policy read-only esplicite |
| Test integrazione ed E2E | ⬜ Da aggiungere |

## Prossimi passi consigliati

1. Creare il primo owner (bootstrap) e validare a runtime CRUD, auth e RLS con
   utenti di ruoli diversi (owner/accountant/collaborator).
2. Introdurre policy client read-only per file, milestone, commenti e documenti condivisi.
3. Aggiungere test d'integrazione ai flussi cliente→preventivo→fattura→pagamento.
4. Valutare l'estrazione reale dei package `ui/types/config/shared`.
5. Verificare Tauri con CLI disponibile nell'ambiente.

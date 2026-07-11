# Roadmap

## Stato moduli

| Modulo | Stato |
|--------|-------|
| Architettura, design system, demo mode | ✅ Completo |
| Auth demo + RBAC (8 ruoli, permessi) | ✅ Completo |
| Dashboard con KPI e grafici dai dati reali | ✅ Completo |
| CRM clienti (CRUD, filtri, dettaglio, CSV) | ✅ Completo |
| Pipeline lead (drag & drop) + lista opportunità | ✅ Completo |
| Progetti (CRUD, dettaglio, redditività) | ✅ Completo |
| Task (kanban drag & drop, avanzamento auto) | ✅ Completo |
| Time tracking (timer globale, timesheet) | ✅ Completo |
| Preventivi (calcoli, PDF/stampa, → fattura) | ✅ Completo |
| Fatture + Pagamenti (saldo aggiornato) | ✅ Completo |
| Entrate/uscite, Analytics, Team, Calendario, File, Servizi, Notifiche, Impostazioni | ✅ Completo (funzionale) |
| Schema DB + RLS produzione | 🟡 Predisposto (SQL pronto, non collegato) |
| Adapter dati Supabase nel service layer | 🟡 Da implementare |
| Contratti (firma), Milestone/Deliverable/Revisioni | 🟡 Parziale |
| Portale cliente | 🟡 Predisposto |
| Automazioni (trigger→azione) | 🟡 Predisposto |
| Documenti rich text (TipTap), Import CSV completo | 🟡 Parziale |
| Test integrazione + E2E (Playwright) | ⬜ Da aggiungere |
| Notifiche email, integrazioni (Stripe live, Google Calendar, SDI) | ⬜ Predisposto, non attivo |

## Prossimi passi consigliati

1. Implementare l'adapter Supabase nel service layer (stesse firme del repository demo).
2. Applicare e testare l'RLS con utenti reali dei diversi ruoli.
3. Completare il portale cliente con layout dedicato e policy RLS `client`.
4. Aggiungere test d'integrazione ed E2E ai flussi critici.
5. Editor documenti TipTap + versioning.
6. Motore automazioni trigger-condition-action.
7. Integrazioni: Stripe live, Google Calendar, fatturazione elettronica IT.

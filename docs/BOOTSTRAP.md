# Bootstrap del primo owner (produzione)

Il database di produzione parte **vuoto** (nessun utente, nessun membro). Questa
è la procedura sicura per creare il primo owner di BNS Studio. **Non** si
inseriscono righe manuali in `auth.users`.

## Componenti (migration `0004_bootstrap_owner.sql`)

- **Trigger `on_auth_user_created`** su `auth.users`: alla registrazione crea
  automaticamente la riga `profiles` collegata. È volutamente a prova di errore
  (qualsiasi eccezione viene ingoiata) per non bloccare mai signup/login.
- **Funzione `bootstrap_owner(p_org_name, p_org_slug, p_first_name, p_last_name)`**
  (`SECURITY DEFINER`, eseguibile solo da utenti `authenticated`): crea (se
  manca) l'organizzazione e collega il chiamante come `owner` attivo. È
  idempotente e **si auto-blocca**: se l'organizzazione ha già un owner attivo e
  il chiamante non ne è membro, l'operazione viene negata (niente escalation).

Flusso risultante:

```
auth user (Simone)  →  profile  →  organization "BNS Studio"  →  member (role=owner)
```

## Procedura

1. **Crea l'utente** con uno di questi metodi:
   - Supabase Studio → **Authentication → Add user** (email + password), oppure
   - dal frontend con `supabase.auth.signUp({ email, password })` se la
     registrazione è abilitata.

   Il trigger crea automaticamente il `profile`.

2. **Esegui il bootstrap dall'app (consigliato)**: apri `localhost:5173/login`,
   accedi con quelle credenziali. Poiché non hai ancora una membership, l'app ti
   porta automaticamente alla pagina **`/onboarding`** ("Inizializza BNS
   Studio"): inserisci Nome/Cognome e premi **Configura BNS Studio**. Questo
   chiama la RPC `bootstrap_owner` con la tua sessione, ricarica il contesto e ti
   fa entrare in Dashboard come `owner`. Nessuna console, nessuna RPC manuale.

   In alternativa, via RPC `bootstrap_owner` autenticato come quell'utente
   (mai dall'SQL Editor come service role: `auth.uid()` sarebbe null).

3. **Verifica**: dopo l'onboarding sei già in Dashboard. Al refresh, `authService`
   trova la riga `members` collegata al profilo e ricarica organizzazione +
   ruolo `owner` senza secondo login.

## Stati di onboarding (produzione)

La guardia `RequireAuth` e la pagina `/onboarding` distinguono 4 stati espliciti:

| Stato | Condizione | Destinazione |
|-------|-----------|--------------|
| A | non autenticato | `/login` |
| B | autenticato, senza membership, **bootstrap disponibile** | `/onboarding` → form "Inizializza BNS Studio" |
| C | autenticato, con membership | applicazione |
| D | autenticato, senza membership, **bootstrap non disponibile** | `/onboarding` → "Account non associato · Contatta un amministratore" |

La distinzione B/D usa la RPC `bootstrap_available()` (`0007`, `SECURITY DEFINER`,
solo booleano): true se l'org non ha ancora un owner attivo.

## Note di sicurezza

- `bootstrap_owner` e `bootstrap_available` sono concesse solo al ruolo
  `authenticated` (`revoke ... from public`).
- `bootstrap_owner` è **auto-bloccante**: dopo il primo owner attivo, le chiamate
  da utenti non-membri vengono rifiutate → la pagina onboarding mostra lo stato D.
  Nessun utente futuro può diventare owner da questa pagina.
- L'onboarding **non** fa insert diretti su `organizations`/`members`: l'unico
  boundary è la RPC. Nessun `service_role` nel frontend.
- I membri successivi si invitano dall'app (Team) come membership dell'org, non
  tramite bootstrap.

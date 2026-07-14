# BNS Studio OS — Desktop (Tauri)

Questa cartella prepara l'app desktop con **Tauri 2** riusando **la stessa build web** (`dist/`), senza modificare la versione browser.

> **Stato: build verificata.** Il comando workspace genera `.app` e `.dmg`; signing e notarization richiedono credenziali Apple Developer.

## Requisiti

- [Rust](https://www.rust-lang.org/tools/install)
- CLI Tauri: `npm i -D @tauri-apps/cli`
- Icone in `src-tauri/icons/` (genera con `npx tauri icon <path/logo.png>`)

## Comandi

```bash
npm run dev:desktop     # avvia l'app desktop
npm run build:desktop   # genera BnsStudio.app e il DMG
npm run notarize:mac    # firma/notarizza con credenziali Apple Developer
```

Vedi `docs/DESKTOP_DISTRIBUTION.md` per le variabili richieste da Apple Notary Service.

## Come resta compatibile con il web

- Il frontend è identico: Tauri carica `dist/` (build Vite standard).
- `src/lib/platform.ts` espone `isTauri`/`platformLabel`: eventuali funzioni native
  vanno attivate solo quando `isTauri === true`, così la versione web non cambia.
- Nessuna dipendenza Tauri è importata nel codice frontend: la web build non include nulla di Tauri.

# BNS Studio OS — Desktop (Tauri) — PREDISPOSTO

Questa cartella prepara l'app desktop con **Tauri 2** riusando **la stessa build web** (`dist/`), senza modificare la versione browser.

> **Stato: predisposto.** I file di configurazione ci sono; per compilare il binario desktop servono il toolchain Rust e la CLI Tauri (non installati di default per non appesantire la build web).

## Requisiti

- [Rust](https://www.rust-lang.org/tools/install)
- CLI Tauri: `npm i -D @tauri-apps/cli`
- Icone in `src-tauri/icons/` (genera con `npx tauri icon <path/logo.png>`)

## Comandi

```bash
npx tauri dev     # avvia l'app desktop (usa `npm run dev` come frontend)
npx tauri build   # genera l'eseguibile (usa `npm run build`)
```

## Come resta compatibile con il web

- Il frontend è identico: Tauri carica `dist/` (build Vite standard).
- `src/lib/platform.ts` espone `isTauri`/`platformLabel`: eventuali funzioni native
  vanno attivate solo quando `isTauri === true`, così la versione web non cambia.
- Nessuna dipendenza Tauri è importata nel codice frontend: la web build non include nulla di Tauri.

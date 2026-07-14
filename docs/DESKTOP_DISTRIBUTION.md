# Distribuzione Desktop macOS

BnsStudio Desktop usa Tauri 2 e riutilizza la build web in `apps/web/dist`.

## Build

```bash
npm run build:desktop
```

Output principali:

- `apps/desktop/src-tauri/target/release/bundle/macos/BnsStudio.app`
- `apps/desktop/src-tauri/target/release/bundle/dmg/BnsStudio_1.1.0_aarch64.dmg`

## Signing e notarization

Per distribuire il DMG senza warning Gatekeeper servono credenziali Apple
Developer. Il repository include lo script:

```bash
npm run notarize:mac
```

Variabili richieste:

- `APPLE_ID`: Apple ID usato per Apple Developer.
- `APPLE_TEAM_ID`: Team ID Apple Developer.
- `APPLE_APP_SPECIFIC_PASSWORD`: password app-specific per Notary Service.

Variabile opzionale:

- `APPLE_SIGNING_IDENTITY`: identita' certificato Developer ID Application, ad
  esempio `Developer ID Application: BNS Studio S.r.l. (TEAMID)`.

Lo script firma `BnsStudio.app` e il DMG quando `APPLE_SIGNING_IDENTITY` e'
presente, invia il DMG ad Apple Notary Service, applica lo staple e verifica
Gatekeeper con `spctl`.

Non inserire credenziali Apple nel repository. Usare variabili ambiente locali o
segreti del sistema CI.

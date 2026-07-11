/**
 * Rilevamento piattaforma. Astrae le differenze web / desktop (Tauri) senza
 * accoppiare l'app a Tauri: la versione web resta pienamente funzionante.
 */

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** true quando l'app gira dentro il runtime desktop Tauri. */
export const isTauri =
  typeof window !== 'undefined' &&
  // Tauri inietta questi global nel webview
  ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);

/** Modificatore da mostrare nelle scorciatoie in base all'OS. */
export const modKey = isMac ? '⌘' : 'Ctrl';

/** Etichetta piattaforma per diagnostica/UI. */
export const platformLabel: 'desktop' | 'web' = isTauri ? 'desktop' : 'web';

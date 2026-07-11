/**
 * Configurazione ambiente centralizzata.
 *
 * BNS Studio OS ha due modalità mutuamente esclusive, selezionate qui una volta
 * sola (nessun altro modulo deve reimplementare questa logica):
 *
 *   • DEMO      → dati in IndexedDB (Dexie). Attiva se VITE_DEMO_MODE=true
 *                 oppure se mancano le credenziali Supabase.
 *   • PRODUCTION→ Supabase Auth + PostgreSQL + RLS + Storage. Attiva quando
 *                 VITE_DEMO_MODE=false e sono presenti URL + publishable key.
 *
 * La chiave client principale è la PUBLISHABLE key (sb_publishable_…).
 * Per retrocompatibilità è ancora accettata la vecchia ANON key (JWT).
 * Il frontend NON deve MAI contenere service role / secret / password DB.
 */

const raw = import.meta.env;

/** publishable key nuova (sb_publishable_…) con fallback alla vecchia anon key. */
const supabaseKey =
  ((raw.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '') ||
  ((raw.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '');

export const env = {
  appName: (raw.VITE_APP_NAME as string) ?? 'BNS Studio OS',
  appUrl: (raw.VITE_APP_URL as string) ?? 'http://localhost:5173',
  supabaseUrl: (raw.VITE_SUPABASE_URL as string) ?? '',
  /** Chiave client pubblica (publishable o anon). Mai secret/service role. */
  supabaseKey,
  currency: (raw.VITE_DEFAULT_CURRENCY as string) ?? 'EUR',
  locale: (raw.VITE_DEFAULT_LOCALE as string) ?? 'it-IT',
  timezone: (raw.VITE_DEFAULT_TIMEZONE as string) ?? 'Europe/Rome',
  maxUploadMb: Number(raw.VITE_MAX_UPLOAD_SIZE_MB ?? 25),
  /** bucket Storage per i file privati dell'organizzazione. */
  storageBucket: (raw.VITE_SUPABASE_STORAGE_BUCKET as string) ?? 'bns-files',
  stripeKey: (raw.VITE_STRIPE_PUBLISHABLE_KEY as string) ?? '',
} as const;

const demoFlag = String(raw.VITE_DEMO_MODE).toLowerCase() === 'true';

/** true quando URL + chiave client Supabase sono presenti. */
export const HAS_SUPABASE_ENV = Boolean(env.supabaseUrl && env.supabaseKey);

/** true quando NON è configurato Supabase → si usa IndexedDB (Dexie). */
export const IS_DEMO = demoFlag || !HAS_SUPABASE_ENV;

/** true quando l'app deve usare Supabase reale (Auth + DB + Storage). */
export const IS_SUPABASE = !IS_DEMO;

// Esposizione SOLO in sviluppo per verifica runtime della modalità.
// Nessun secret: solo booleani e il flag demo. Non presente in build di produzione.
if (raw.DEV && typeof window !== 'undefined') {
  (window as unknown as { __BNS_ENV?: unknown }).__BNS_ENV = {
    IS_DEMO,
    IS_SUPABASE,
    HAS_SUPABASE_ENV,
    VITE_DEMO_MODE: String(raw.VITE_DEMO_MODE),
    supabaseUrlSet: Boolean(env.supabaseUrl),
    supabaseKeySet: Boolean(env.supabaseKey),
  };
}

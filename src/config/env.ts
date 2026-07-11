/**
 * Configurazione ambiente centralizzata.
 * La modalità DEMO è attiva se mancano le credenziali Supabase
 * oppure se VITE_DEMO_MODE=true.
 */

const raw = import.meta.env;

export const env = {
  appName: (raw.VITE_APP_NAME as string) ?? 'BNS Studio OS',
  appUrl: (raw.VITE_APP_URL as string) ?? 'http://localhost:5173',
  supabaseUrl: (raw.VITE_SUPABASE_URL as string) ?? '',
  supabaseAnonKey: (raw.VITE_SUPABASE_ANON_KEY as string) ?? '',
  currency: (raw.VITE_DEFAULT_CURRENCY as string) ?? 'EUR',
  locale: (raw.VITE_DEFAULT_LOCALE as string) ?? 'it-IT',
  timezone: (raw.VITE_DEFAULT_TIMEZONE as string) ?? 'Europe/Rome',
  maxUploadMb: Number(raw.VITE_MAX_UPLOAD_SIZE_MB ?? 25),
  stripeKey: (raw.VITE_STRIPE_PUBLISHABLE_KEY as string) ?? '',
} as const;

/** true quando NON è configurato Supabase → si usa IndexedDB (Dexie). */
export const IS_DEMO =
  String(raw.VITE_DEMO_MODE).toLowerCase() === 'true' ||
  !env.supabaseUrl ||
  !env.supabaseAnonKey;

export const IS_SUPABASE = !IS_DEMO;

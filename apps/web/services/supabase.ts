import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, IS_SUPABASE } from '@/config/env';
import type { Database } from '@/types/database.generated';

/**
 * Client Supabase unico e centralizzato, tipizzato con lo schema reale del
 * database (`Database` generato da `supabase gen types`). Tutti i moduli
 * (repository, auth, storage) devono usare esclusivamente questo client.
 *
 * La chiave usata è quella pubblica (publishable/anon): nessun secret nel
 * frontend. La sessione è persistita e auto-refreshata dal SDK.
 */
export type TypedSupabaseClient = SupabaseClient<Database>;

let client: TypedSupabaseClient | null = null;

export function getSupabaseClient(): TypedSupabaseClient {
  if (!IS_SUPABASE) {
    throw new Error(
      'Supabase non è configurato: imposta VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY, oppure usa la modalità demo.',
    );
  }
  if (!client) {
    client = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

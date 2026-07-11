/**
 * apps/api
 *
 * Contiene solo predisposizioni server-side leggere:
 * - helper per Supabase Edge Functions
 * - mapping/server adapters che non devono vivere nel frontend
 * - tipi condivisibili lato server in una fase successiva
 *
 * Supabase resta il backend principale del progetto.
 */

export interface ApiPlaceholder {
  runtime: 'supabase';
  status: 'minimal';
}

export const apiPlaceholder: ApiPlaceholder = {
  runtime: 'supabase',
  status: 'minimal',
};

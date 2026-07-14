/**
 * Client frontend dell'integrazione GitHub (§3-4).
 *
 * Non contiene alcun secret: chiama l'Edge Function `github` (server-side), che
 * custodisce App ID + private key e genera installation token a vita breve.
 * Il frontend riceve solo metadati pubblici e la lista repo.
 */
import { getSupabaseClient } from '@/services/supabase';
import type { GithubRepo } from '@/types';

type GithubAction = 'status' | 'connect' | 'disconnect' | 'list_repos';

async function invoke<T>(action: GithubAction, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabaseClient().functions.invoke('github', {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message ?? 'Chiamata GitHub non riuscita');
  const payload = data as { error?: string } & T;
  if (payload?.error) throw new Error(payload.error);
  return payload as T;
}

export const githubService = {
  /** true se l'Edge Function ha i secret configurati (App collegabile). */
  isConfigured: () => invoke<{ configured: boolean }>('status').then((r) => r.configured),
  /** Registra un'installazione GitHub App (solo admin). */
  connect: (installationId: number) => invoke<{ connection: unknown }>('connect', { installation_id: installationId }),
  /** Revoca la connessione a livello organizzazione (solo admin). */
  disconnect: () => invoke<{ ok: boolean }>('disconnect'),
  /** Elenca i repository accessibili dall'installazione collegata. */
  listRepos: () => invoke<{ repositories: GithubRepo[] }>('list_repos').then((r) => r.repositories),
};

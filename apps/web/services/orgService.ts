import { IS_DEMO } from '@/config/env';
import { getSupabaseClient } from '@/services/supabase';

/**
 * Servizio organizzazione: gestisce il bootstrap del primo owner in produzione.
 *
 * In produzione l'app conosce l'organizzazione corrente tramite la riga
 * `members` collegata al profilo dell'utente (vedi authService). Un utente
 * appena registrato non ha ancora membership: chiamando `bootstrapOwner()`
 * diventa owner dell'organizzazione BNS Studio (funzione SQL `bootstrap_owner`,
 * SECURITY DEFINER e auto-bloccante — vedi migration 0004).
 */
export const orgService = {
  /**
   * Inizializza (una sola volta) l'organizzazione e rende l'utente autenticato
   * owner attivo. Restituisce l'organization_id. No-op esplicito in demo.
   */
  async bootstrapOwner(params?: {
    orgName?: string;
    orgSlug?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<string> {
    if (IS_DEMO) {
      throw new Error('Bootstrap owner non disponibile in modalità demo.');
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('bootstrap_owner', {
      p_org_name: params?.orgName ?? 'BNS Studio',
      p_org_slug: params?.orgSlug ?? 'bns-studio',
      p_first_name: params?.firstName ?? undefined,
      p_last_name: params?.lastName ?? undefined,
    });
    if (error) throw error;
    return data as string;
  },

  /**
   * true se il bootstrap owner è ancora disponibile per l'organizzazione
   * indicata (nessun owner attivo esistente). Distingue lo stato onboarding
   * "primo setup" (true) da "account non ancora associato" (false).
   */
  async isBootstrapAvailable(orgSlug = 'bns-studio'): Promise<boolean> {
    if (IS_DEMO) return false;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('bootstrap_available', {
      p_org_slug: orgSlug,
    });
    if (error) throw error;
    return Boolean(data);
  },
};

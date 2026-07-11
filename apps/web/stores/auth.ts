import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '@/services/authService';
import { clearActiveSession, setActiveSession } from '@/services/session';
import type { Member, Role } from '@/types';
import { ROLE_PERMISSIONS, type Permission } from '@/features/auth/permissions';

/**
 * Esito del login per la UI:
 *   • 'ok'          → autenticato con membership → applicazione;
 *   • 'onboarding'  → autenticato ma senza organizzazione → /onboarding;
 *   • 'error'       → credenziali non valide o errore.
 */
export type LoginStatus = 'ok' | 'onboarding' | 'error';

interface AuthState {
  /** id utente Auth (Supabase) o utente demo. Presente anche senza membership. */
  userId: string | null;
  memberId: string | null;
  organizationId: string | null;
  member: Member | null;
  role: Role | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<LoginStatus>;
  logout: () => void;
  hydrate: () => Promise<void>;
  /** Ricarica profilo/membership/organization dalla sessione corrente (post-bootstrap). */
  refresh: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const EMPTY = {
  memberId: null,
  organizationId: null,
  member: null,
  role: null,
} as const;

/**
 * In produzione sincronizza lo store con gli eventi di sessione Supabase:
 * logout automatico su SIGNED_OUT (es. token scaduto o logout da altra scheda).
 * Registrato una sola volta. In demo è no-op.
 */
let authListenerReady = false;
function setupAuthListener() {
  if (authListenerReady) return;
  authListenerReady = true;
  authService.onAuthStateChange((event, hasSession) => {
    if (event === 'SIGNED_OUT' || !hasSession) {
      clearActiveSession();
      useAuth.setState({ userId: null, ...EMPTY });
    }
  });
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      userId: null,
      memberId: null,
      organizationId: null,
      member: null,
      role: null,
      loading: false,
      error: null,

      async login(email, password) {
        set({ loading: true, error: null });
        let outcome: Awaited<ReturnType<typeof authService.login>>;
        try {
          outcome = await authService.login(email, password);
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Errore di autenticazione',
          });
          return 'error';
        }

        if (outcome.kind === 'invalid') {
          set({ loading: false, error: 'Credenziali non valide' });
          return 'error';
        }

        if (outcome.kind === 'no-organization') {
          // Sessione Supabase valida ma senza membership: stato onboarding.
          clearActiveSession();
          set({ userId: outcome.userId, ...EMPTY, loading: false, error: null });
          setupAuthListener();
          return 'onboarding';
        }

        setActiveSession(outcome.session);
        set({
          userId: outcome.session.userId,
          memberId: outcome.session.memberId,
          organizationId: outcome.session.organizationId,
          member: outcome.session.member,
          role: outcome.session.role,
          loading: false,
          error: null,
        });
        setupAuthListener();
        return 'ok';
      },

      logout() {
        void authService.logout();
        clearActiveSession();
        set({ userId: null, ...EMPTY, error: null });
      },

      async hydrate() {
        const { memberId } = get();
        const outcome = await authService.hydrate(memberId);
        if (outcome.kind === 'none') {
          clearActiveSession();
          set({ userId: null, ...EMPTY });
        } else if (outcome.kind === 'no-organization') {
          clearActiveSession();
          set({ userId: outcome.userId, ...EMPTY });
        } else {
          setActiveSession(outcome.session);
          set({
            userId: outcome.session.userId,
            memberId: outcome.session.memberId,
            organizationId: outcome.session.organizationId,
            member: outcome.session.member,
            role: outcome.session.role,
          });
        }
        setupAuthListener();
      },

      async refresh() {
        await get().hydrate();
      },

      can(permission) {
        const role = get().role;
        if (!role) return false;
        return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
      },
    }),
    {
      name: 'bns-auth',
      partialize: (s) => ({ userId: s.userId, memberId: s.memberId, organizationId: s.organizationId }),
    },
  ),
);

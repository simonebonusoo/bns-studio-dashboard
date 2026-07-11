import { db } from '@/data/db';
import { getSupabaseClient } from '@/services/supabase';
import { IS_DEMO, env } from '@/config/env';
import type { Member, Role } from '@/types';

interface AuthSession {
  userId: string;
  memberId: string;
  organizationId: string;
  member: Member;
  role: Role;
}

function mapMemberRow(row: Record<string, unknown>): Member {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    email: String(row.email),
    avatarColor: String(row.avatar_color ?? '#71717a'),
    role: row.role as Member['role'],
    jobTitle: String(row.job_title ?? ''),
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    weeklyHours: Number(row.weekly_hours ?? 40),
    internalRate: Number(row.internal_rate ?? 0),
    clientRate: Number(row.client_rate ?? 0),
    collaborationType: String(row.collaboration_type ?? 'freelance') as Member['collaborationType'],
    status: row.status as Member['status'],
    joinedAt: String(row.joined_at ?? new Date().toISOString()),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  };
}

/**
 * Esito autenticazione. `no-organization` è uno stato di prima classe: l'utente
 * Supabase è valido ma non ha ancora una membership → onboarding, NON errore.
 */
export type AuthOutcome =
  | { kind: 'session'; session: AuthSession }
  | { kind: 'no-organization'; userId: string }
  | { kind: 'invalid' };

/** Esito idratazione sessione (all'avvio / refresh). */
export type HydrateOutcome =
  | { kind: 'session'; session: AuthSession }
  | { kind: 'no-organization'; userId: string }
  | { kind: 'none' };

async function demoLogin(email: string, password: string): Promise<AuthOutcome> {
  const user = await db.users
    .where('email')
    .equals(email.trim().toLowerCase())
    .first();

  if (!user || user.password !== password) {
    return { kind: 'invalid' };
  }

  const member = await db.members.get(user.memberId);
  if (!member) {
    return { kind: 'invalid' };
  }

  return {
    kind: 'session',
    session: {
      userId: user.id,
      memberId: user.memberId,
      organizationId: user.organizationId,
      member,
      role: member.role,
    },
  };
}

async function demoHydrate(memberId: string | null): Promise<HydrateOutcome> {
  if (!memberId) return { kind: 'none' };
  const member = await db.members.get(memberId);
  if (!member) return { kind: 'none' };
  const user = await db.users.where('memberId').equals(memberId).first();
  if (!user) return { kind: 'none' };

  return {
    kind: 'session',
    session: {
      userId: user.id,
      memberId: user.memberId,
      organizationId: member.organizationId,
      member,
      role: member.role,
    },
  };
}

async function supabaseLogin(email: string, password: string): Promise<AuthOutcome> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    return { kind: 'invalid' }; // credenziali non valide
  }

  const { data: memberRow, error: memberError } = await supabase
    .from('members')
    .select('*')
    .eq('profile_id', data.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    throw memberError; // errore DB reale: propaga (nessun fallback silenzioso)
  }
  if (!memberRow) {
    // Autenticato ma senza organizzazione: la sessione Supabase resta valida,
    // niente logout, niente errore generico, niente fallback demo → onboarding.
    return { kind: 'no-organization', userId: data.user.id };
  }

  const member = mapMemberRow(memberRow);
  return {
    kind: 'session',
    session: {
      userId: data.user.id,
      memberId: member.id,
      organizationId: member.organizationId,
      member,
      role: member.role,
    },
  };
}

async function supabaseHydrate(): Promise<HydrateOutcome> {
  const supabase = getSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return { kind: 'none' };

  const { data: memberRow, error } = await supabase
    .from('members')
    .select('*')
    .eq('profile_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!memberRow) {
    return { kind: 'no-organization', userId: user.id };
  }

  const member = mapMemberRow(memberRow);
  return {
    kind: 'session',
    session: {
      userId: user.id,
      memberId: member.id,
      organizationId: member.organizationId,
      member,
      role: member.role,
    },
  };
}

async function supabaseLogout() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}

export const authService = {
  async login(email: string, password: string): Promise<AuthOutcome> {
    return IS_DEMO ? demoLogin(email, password) : supabaseLogin(email, password);
  },

  async hydrate(memberId: string | null): Promise<HydrateOutcome> {
    return IS_DEMO ? demoHydrate(memberId) : supabaseHydrate();
  },

  async logout() {
    if (!IS_DEMO) {
      await supabaseLogout();
    }
  },

  /** Invia l'email di reset password (solo produzione). */
  async requestPasswordReset(email: string): Promise<void> {
    if (IS_DEMO) return; // in demo non c'è invio email reale
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${env.appUrl}/login`,
    });
    if (error) throw error;
  },

  /** Aggiorna la password dell'utente autenticato (solo produzione). */
  async updatePassword(newPassword: string): Promise<void> {
    if (IS_DEMO) {
      throw new Error('Cambio password non disponibile in modalità demo.');
    }
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  /**
   * Sottoscrive gli eventi di sessione Supabase (refresh token, logout da
   * un'altra scheda…). Restituisce una funzione di cleanup. In demo è no-op.
   */
  onAuthStateChange(handler: (event: string, hasSession: boolean) => void): () => void {
    if (IS_DEMO) return () => undefined;
    const supabase = getSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      handler(event, Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  },
};

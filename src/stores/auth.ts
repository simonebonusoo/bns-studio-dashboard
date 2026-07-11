import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/data/db';
import type { Member, Role } from '@/types';
import { ROLE_PERMISSIONS, type Permission } from '@/features/auth/permissions';

interface AuthState {
  userId: string | null;
  memberId: string | null;
  member: Member | null;
  role: Role | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hydrate: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      userId: null,
      memberId: null,
      member: null,
      role: null,
      loading: false,
      error: null,

      async login(email, password) {
        set({ loading: true, error: null });
        const user = await db.users
          .where('email')
          .equals(email.trim().toLowerCase())
          .first();
        if (!user || user.password !== password) {
          set({ loading: false, error: 'Credenziali non valide' });
          return false;
        }
        const member = (await db.members.get(user.memberId)) ?? null;
        set({
          userId: user.id,
          memberId: user.memberId,
          member,
          role: member?.role ?? null,
          loading: false,
          error: null,
        });
        return true;
      },

      logout() {
        set({ userId: null, memberId: null, member: null, role: null, error: null });
      },

      async hydrate() {
        const { memberId } = get();
        if (!memberId) return;
        const member = (await db.members.get(memberId)) ?? null;
        set({ member, role: member?.role ?? null });
      },

      can(permission) {
        const role = get().role;
        if (!role) return false;
        return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
      },
    }),
    {
      name: 'bns-auth',
      partialize: (s) => ({ userId: s.userId, memberId: s.memberId }),
    },
  ),
);

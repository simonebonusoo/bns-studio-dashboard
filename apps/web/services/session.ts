import type { Member, Role } from '@/types';

export interface ActiveSession {
  userId: string | null;
  memberId: string | null;
  organizationId: string | null;
  member: Member | null;
  role: Role | null;
}

let activeSession: ActiveSession = {
  userId: null,
  memberId: null,
  organizationId: null,
  member: null,
  role: null,
};

export function setActiveSession(next: Partial<ActiveSession>) {
  activeSession = {
    ...activeSession,
    ...next,
  };
}

export function clearActiveSession() {
  activeSession = {
    userId: null,
    memberId: null,
    organizationId: null,
    member: null,
    role: null,
  };
}

export function getActiveSession() {
  return activeSession;
}

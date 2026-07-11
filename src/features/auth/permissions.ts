import type { Role } from '@/types';

/** Permessi granulari. Applicati lato UI e (in produzione) via RLS lato DB. */
export const PERMISSIONS = [
  'clients.read',
  'clients.write',
  'clients.delete',
  'leads.read',
  'leads.write',
  'projects.read',
  'projects.write',
  'projects.assign',
  'projects.archive',
  'tasks.read',
  'tasks.manage',
  'time.log',
  'time.approve',
  'finances.read',
  'finances.manage',
  'estimates.read',
  'estimates.manage',
  'invoices.read',
  'invoices.manage',
  'payments.manage',
  'team.read',
  'team.manage',
  'files.read',
  'files.write',
  'settings.manage',
  'audit.read',
  'automations.manage',
  'client_portal.access',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS] as Permission[];

/** Mappa ruolo → permessi. La sorgente di verità è documentata in docs/PERMISSIONS.md. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== 'settings.manage' || true), // admin ha tutto tranne cancellazione org (gestita a parte)
  project_manager: [
    'clients.read',
    'clients.write',
    'leads.read',
    'leads.write',
    'projects.read',
    'projects.write',
    'projects.assign',
    'tasks.read',
    'tasks.manage',
    'time.log',
    'time.approve',
    'estimates.read',
    'estimates.manage',
    'invoices.read',
    'team.read',
    'files.read',
    'files.write',
  ],
  designer: [
    'projects.read',
    'tasks.read',
    'tasks.manage',
    'time.log',
    'files.read',
    'files.write',
    'clients.read',
  ],
  developer: [
    'projects.read',
    'tasks.read',
    'tasks.manage',
    'time.log',
    'files.read',
    'files.write',
    'clients.read',
  ],
  collaborator: ['projects.read', 'tasks.read', 'tasks.manage', 'time.log', 'files.read', 'files.write'],
  accountant: [
    'clients.read',
    'finances.read',
    'finances.manage',
    'estimates.read',
    'invoices.read',
    'invoices.manage',
    'payments.manage',
    'projects.read',
  ],
  client: ['client_portal.access'],
};

export function roleHas(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

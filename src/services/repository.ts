import type { Table } from 'dexie';
import { db } from '@/data/db';
import { nowISO, uid } from '@/lib/id';
import { ORGANIZATION_ID } from '@/data/seed';

/**
 * Repository generico sul database demo (Dexie).
 * Il service layer resta l'unico punto di accesso ai dati: i componenti non
 * interrogano mai direttamente Dexie/Supabase.
 *
 * In produzione (Supabase) queste stesse firme verranno reimplementate su
 * PostgreSQL + RLS mantenendo l'interfaccia invariata.
 */
export interface BaseRow {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export function createRepository<T extends BaseRow>(table: Table<T, string>) {
  return {
    async list(filter?: (row: T) => boolean): Promise<T[]> {
      const rows = await table.where('organizationId').equals(ORGANIZATION_ID).toArray();
      const active = rows.filter((r) => !r.deletedAt);
      return filter ? active.filter(filter) : active;
    },

    async get(id: string): Promise<T | undefined> {
      const row = await table.get(id);
      return row && !row.deletedAt ? row : undefined;
    },

    async create(data: Omit<T, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> & Partial<T>): Promise<T> {
      const row = {
        ...data,
        id: data.id ?? uid(),
        organizationId: ORGANIZATION_ID,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      } as T;
      await table.add(row);
      return row;
    },

    async update(id: string, patch: Partial<T>): Promise<T> {
      const existing = await table.get(id);
      if (!existing) throw new Error(`Record ${id} non trovato`);
      const updated = { ...existing, ...patch, updatedAt: nowISO() } as T;
      await table.put(updated);
      return updated;
    },

    /** Soft delete (imposta deletedAt). */
    async remove(id: string): Promise<void> {
      const existing = await table.get(id);
      if (!existing) return;
      await table.put({ ...existing, deletedAt: nowISO(), updatedAt: nowISO() });
    },

    /** Eliminazione definitiva (solo per operazioni amministrative). */
    async hardDelete(id: string): Promise<void> {
      await table.delete(id);
    },
  };
}

export const repositories = {
  members: createRepository(db.members),
  companies: createRepository(db.companies),
  clients: createRepository(db.clients),
  opportunities: createRepository(db.opportunities),
  services: createRepository(db.services),
  projects: createRepository(db.projects),
  milestones: createRepository(db.milestones),
  tasks: createRepository(db.tasks),
  timeEntries: createRepository(db.timeEntries),
  estimates: createRepository(db.estimates),
  invoices: createRepository(db.invoices),
  payments: createRepository(db.payments),
  transactions: createRepository(db.transactions),
  contracts: createRepository(db.contracts),
  files: createRepository(db.files),
  events: createRepository(db.events),
  comments: createRepository(db.comments),
  notifications: createRepository(db.notifications),
  activityLogs: createRepository(db.activityLogs),
  documents: createRepository(db.documents),
};

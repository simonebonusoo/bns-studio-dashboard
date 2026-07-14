import type { Table } from 'dexie';
import { db } from '@/data/db';
import { IS_DEMO } from '@/config/env';
import { nowISO, uid } from '@/lib/id';
import { getActiveSession } from '@/services/session';
import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/services/supabase';
import type { Database } from '@/types/database.generated';
import { recordActivity } from '@/services/activity';

/**
 * Repository centralizzato: i componenti React non interrogano mai direttamente
 * Dexie o Supabase. La modalità (demo/produzione) è decisa una sola volta in
 * `@/config/env`. Ogni repository espone la stessa interfaccia tipizzata.
 */
export interface BaseRow {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface EntityRepository<T extends BaseRow> {
  list: (filter?: (row: T) => boolean) => Promise<T[]>;
  get: (id: string) => Promise<T | undefined>;
  create: (data: Omit<T, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> & Partial<T>) => Promise<T>;
  update: (id: string, patch: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
  hardDelete: (id: string) => Promise<void>;
  count: () => Promise<number>;
}

type PublicTables = Database['public']['Tables'];
type TableName = keyof PublicTables | 'payment_installments';

const ACTIVITY_ENTITY_BY_TABLE: Partial<Record<TableName, string>> = {
  members: 'member',
  companies: 'company',
  clients: 'client',
  opportunities: 'opportunity',
  services: 'service',
  projects: 'project',
  milestones: 'milestone',
  tasks: 'task',
  time_entries: 'time_entry',
  estimates: 'estimate',
  invoices: 'invoice',
  payments: 'payment',
  payment_installments: 'payment_installment',
  transactions: 'transaction',
  contracts: 'contract',
  files: 'file',
  calendar_events: 'event',
  comments: 'comment',
  documents: 'document',
  markdown_imports: 'markdown_import',
};

/** Riga DB generica: chiavi snake_case, valori sconosciuti. */
type DbRow = Record<string, unknown>;

/**
 * Mapping snake_case (colonne DB) ⇄ camelCase (dominio) per i nomi che non
 * seguono la conversione automatica (es. campi del calendario e dei file).
 */
const SPECIAL_TO_DB: Record<string, string> = {
  start: 'start_at',
  end: 'end_at',
  url: 'storage_path',
};

const SPECIAL_FROM_DB: Record<string, string> = {
  start_at: 'start',
  end_at: 'end',
  storage_path: 'url',
};

function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function mapToDbKey(key: string) {
  return SPECIAL_TO_DB[key] ?? toSnakeCase(key);
}

function mapFromDbKey(key: string) {
  return SPECIAL_FROM_DB[key] ?? toCamelCase(key);
}

const NULLABLE_EMPTY_SUFFIXES = ['Id', 'Date', 'At'];

function shouldNullifyEmptyString(key: string, value: unknown) {
  return value === '' && NULLABLE_EMPTY_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

function normalizeForDatabase<T>(value: T, key?: string): T {
  if (key && shouldNullifyEmptyString(key, value)) {
    return null as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForDatabase(entry)) as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, normalizeForDatabase(entryValue, entryKey)]),
    ) as T;
  }
  return value;
}

/**
 * Converte un oggetto di dominio (camelCase) in una riga DB (snake_case),
 * scartando i valori `undefined`. Nessuna proprietà camelCase raggiunge mai il
 * database. Il risultato è tipizzato come Row Insert/Update della tabella `K`.
 */
function serialize(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [mapToDbKey(key), value]),
  );
}

/** Converte una riga DB (snake_case) nell'oggetto di dominio (camelCase). */
function deserialize<T>(row: DbRow): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [mapFromDbKey(key), value]),
  ) as T;
}

function requireOrganizationId() {
  const organizationId = getActiveSession().organizationId;
  if (!organizationId && IS_DEMO) {
    throw new Error('Organizzazione demo non inizializzata');
  }
  return organizationId;
}

async function recordRepositoryActivity(
  tableName: TableName,
  action: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  const entityType = ACTIVITY_ENTITY_BY_TABLE[tableName];
  if (!entityType) return;
  try {
    await recordActivity({ action, entityType, entityId, metadata });
  } catch (error) {
    console.error(`[BnsStudio] Activity log fallita per ${tableName}:${action}`, error);
  }
}

// ─────────────────────────── Demo (Dexie) ───────────────────────────

function createDemoRepository<T extends BaseRow>(tableName: TableName, table: Table<T, string>): EntityRepository<T> {
  return {
    async list(filter?: (row: T) => boolean): Promise<T[]> {
      const organizationId = requireOrganizationId();
      if (!organizationId) return [];
      const rows = await table.where('organizationId').equals(organizationId).toArray();
      const active = rows.filter((r) => !r.deletedAt);
      return filter ? active.filter(filter) : active;
    },

    async get(id: string): Promise<T | undefined> {
      const row = await table.get(id);
      return row && !row.deletedAt ? row : undefined;
    },

    async create(data: Omit<T, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> & Partial<T>): Promise<T> {
      const organizationId = requireOrganizationId();
      if (!organizationId) throw new Error('Organizzazione demo non disponibile');
      const row = {
        ...data,
        id: data.id ?? uid(),
        organizationId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      } as T;
      await table.add(row);
      await recordRepositoryActivity(tableName, 'create', row.id);
      return row;
    },

    async update(id: string, patch: Partial<T>): Promise<T> {
      const existing = await table.get(id);
      if (!existing) throw new Error(`Record ${id} non trovato`);
      const updated = { ...existing, ...patch, updatedAt: nowISO() } as T;
      await table.put(updated);
      await recordRepositoryActivity(
        tableName,
        Object.prototype.hasOwnProperty.call(patch, 'status') ? 'status_change' : 'update',
        id,
      );
      return updated;
    },

    /** Soft delete (imposta deletedAt). */
    async remove(id: string): Promise<void> {
      const existing = await table.get(id);
      if (!existing) return;
      await table.put({ ...existing, deletedAt: nowISO(), updatedAt: nowISO() });
      await recordRepositoryActivity(tableName, 'delete', id);
    },

    /** Eliminazione definitiva (solo per operazioni amministrative). */
    async hardDelete(id: string): Promise<void> {
      await table.delete(id);
      await recordRepositoryActivity(tableName, 'delete', id);
    },

    async count(): Promise<number> {
      const organizationId = requireOrganizationId();
      if (!organizationId) return 0;
      const rows = await table.where('organizationId').equals(organizationId).toArray();
      return rows.filter((row) => !row.deletedAt).length;
    },
  };
}

// ───────────────────────── Produzione (Supabase) ─────────────────────────

interface DbQueryResult {
  data: DbRow[] | null;
  error: PostgrestError | null;
  count: number | null;
}

interface DbSingleResult {
  data: DbRow | null;
  error: PostgrestError | null;
}

interface DbFilter extends PromiseLike<DbQueryResult> {
  eq(column: string, value: string | number | boolean): DbFilter;
  is(column: string, value: null): DbFilter;
  single(): PromiseLike<DbSingleResult>;
  maybeSingle(): PromiseLike<DbSingleResult>;
}

interface DbInsertResult {
  select(columns: string): { single(): PromiseLike<DbSingleResult> };
}

interface DbUpdateResult extends PromiseLike<DbQueryResult> {
  eq(column: string, value: string | number | boolean): DbUpdateResult & {
    select(columns: string): { single(): PromiseLike<DbSingleResult> };
  };
}

interface DbDeleteResult {
  eq(column: string, value: string | number | boolean): PromiseLike<DbQueryResult>;
}

interface DbTableQuery {
  select(columns: string): DbFilter;
  select(columns: string, options: { count: 'exact'; head: boolean }): DbFilter;
  insert(values: DbRow): DbInsertResult;
  update(values: DbRow): DbUpdateResult;
  delete(): DbDeleteResult;
}

function dbTable<K extends TableName>(name: K): DbTableQuery {
  const client = getSupabaseClient() as unknown as { from: (relation: string) => unknown };
  return client.from(name) as DbTableQuery;
}

function throwSupabaseError(tableName: TableName, operation: string, error: PostgrestError): never {
  if (import.meta.env.DEV) {
    console.error('[BnsStudio] Supabase query failed', {
      table: tableName,
      operation,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }
  throw error;
}

interface SupabaseRepoOptions {
  softDelete: boolean;
}

function createSupabaseRepository<T extends BaseRow, K extends TableName>(
  tableName: K,
  { softDelete }: SupabaseRepoOptions,
): EntityRepository<T> {
  return {
    async list(filter?: (row: T) => boolean) {
      let query = dbTable(tableName).select('*');
      if (softDelete) query = query.is('deleted_at', null);
      const { data, error } = await query;
      if (error) throwSupabaseError(tableName, 'list', error);
      const rows = (data ?? []).map((row) => deserialize<T>(row));
      return filter ? rows.filter(filter) : rows;
    },

    async get(id: string) {
      let query = dbTable(tableName).select('*').eq('id', id);
      if (softDelete) query = query.is('deleted_at', null);
      const { data, error } = await query.maybeSingle();
      if (error) throwSupabaseError(tableName, 'get', error);
      return data ? deserialize<T>(data) : undefined;
    },

    async create(data) {
      const organizationId = requireOrganizationId();
      if (!organizationId) {
        throw new Error('Organizzazione Supabase non disponibile: nessuna sessione attiva.');
      }

      const payload = serialize(normalizeForDatabase({
        ...data,
        ...(data.id ? { id: data.id } : {}),
        organizationId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }));

      const { data: row, error } = await dbTable(tableName)
        .insert(payload)
        .select('*')
        .single();

      if (error) throwSupabaseError(tableName, 'create', error);
      if (!row) throw new Error(`Creazione ${tableName} non riuscita: nessuna riga restituita.`);
      await recordRepositoryActivity(tableName, 'create', String(row.id));
      return deserialize<T>(row);
    },

    async update(id, patch) {
      const payload = serialize(normalizeForDatabase({ ...patch, updatedAt: nowISO() }));
      const { data: row, error } = await dbTable(tableName)
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throwSupabaseError(tableName, 'update', error);
      if (!row) throw new Error(`Aggiornamento ${tableName} non riuscito: record ${id} inesistente.`);
      await recordRepositoryActivity(
        tableName,
        Object.prototype.hasOwnProperty.call(patch, 'status') ? 'status_change' : 'update',
        id,
      );
      return deserialize<T>(row);
    },

    async remove(id) {
      if (!softDelete) {
        const { error } = await dbTable(tableName).delete().eq('id', id);
        if (error) throwSupabaseError(tableName, 'delete', error);
        await recordRepositoryActivity(tableName, 'delete', id);
        return;
      }
      const payload = serialize({ deletedAt: nowISO(), updatedAt: nowISO() });
      const { error } = await dbTable(tableName).update(payload).eq('id', id);
      if (error) throwSupabaseError(tableName, 'remove', error);
      await recordRepositoryActivity(tableName, 'delete', id);
    },

    async hardDelete(id) {
      const { error } = await dbTable(tableName).delete().eq('id', id);
      if (error) throwSupabaseError(tableName, 'hardDelete', error);
      await recordRepositoryActivity(tableName, 'delete', id);
    },

    async count() {
      let query = dbTable(tableName).select('*', { count: 'exact', head: true });
      if (softDelete) query = query.is('deleted_at', null);
      const { count, error } = await query;
      if (error) throwSupabaseError(tableName, 'count', error);
      return count ?? 0;
    },
  };
}

function createRepository<T extends BaseRow, K extends TableName>(
  tableName: K,
  demoTable: Table<T, string>,
  options: SupabaseRepoOptions = { softDelete: true },
): EntityRepository<T> {
  return IS_DEMO
    ? createDemoRepository(tableName, demoTable)
    : createSupabaseRepository<T, K>(tableName, options);
}

const APPEND_ONLY: SupabaseRepoOptions = { softDelete: false };

export const repositories = {
  members: createRepository('members', db.members),
  companies: createRepository('companies', db.companies),
  clients: createRepository('clients', db.clients),
  opportunities: createRepository('opportunities', db.opportunities),
  services: createRepository('services', db.services),
  projects: createRepository('projects', db.projects),
  milestones: createRepository('milestones', db.milestones),
  tasks: createRepository('tasks', db.tasks),
  timeEntries: createRepository('time_entries', db.timeEntries),
  estimates: createRepository('estimates', db.estimates),
  invoices: createRepository('invoices', db.invoices),
  payments: createRepository('payments', db.payments),
  paymentInstallments: createRepository('payment_installments', db.paymentInstallments),
  transactions: createRepository('transactions', db.transactions),
  contracts: createRepository('contracts', db.contracts),
  files: createRepository('files', db.files),
  events: createRepository('calendar_events', db.events),
  comments: createRepository('comments', db.comments),
  notifications: createRepository('notifications', db.notifications, APPEND_ONLY),
  activityLogs: createRepository('activity_logs', db.activityLogs, APPEND_ONLY),
  markdownImports: createRepository('markdown_imports', db.markdownImports),
  documents: createRepository('documents', db.documents),
  githubConnections: createRepository('github_connections', db.githubConnections, APPEND_ONLY),
  projectRepositories: createRepository('project_repositories', db.projectRepositories),
};

export type RepositoryKey = keyof typeof repositories;

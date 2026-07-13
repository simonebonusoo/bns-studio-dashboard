import { repositories } from '@/services/repository';
import { IS_SUPABASE } from '@/config/env';
import { getSupabaseClient } from '@/services/supabase';

export async function nextProjectCode() {
  return nextSequentialCode({
    table: 'projects',
    column: 'code',
    prefix: 'PRJ-2026-',
    padding: 3,
    fallback: () => repositories.projects.list().then((items) => items.map((item) => item.code)),
  });
}

export async function nextEstimateNumber() {
  return nextSequentialCode({
    table: 'estimates',
    column: 'number',
    prefix: 'PREV-2026-',
    padding: 4,
    fallback: () => repositories.estimates.list().then((items) => items.map((item) => item.number)),
  });
}

export async function nextInvoiceNumber() {
  return nextSequentialCode({
    table: 'invoices',
    column: 'number',
    prefix: 'FAT-2026-',
    padding: 4,
    fallback: () => repositories.invoices.list().then((items) => items.map((item) => item.number)),
  });
}

export async function nextContractNumber() {
  return nextSequentialCode({
    table: 'contracts',
    column: 'number',
    prefix: 'CTR-2026-',
    padding: 3,
    fallback: () => repositories.contracts.list().then((items) => items.map((item) => item.number)),
  });
}

type NumberTable = 'projects' | 'estimates' | 'invoices' | 'contracts';

interface SequentialConfig {
  table: NumberTable;
  column: 'code' | 'number';
  prefix: string;
  padding: number;
  fallback: () => Promise<string[]>;
}

async function nextSequentialCode(config: SequentialConfig) {
  const existing = IS_SUPABASE
    ? await listSupabaseValues(config.table, config.column)
    : await config.fallback();
  const next = maxSequence(existing, config.prefix) + 1;
  return `${config.prefix}${String(next).padStart(config.padding, '0')}`;
}

async function listSupabaseValues(table: NumberTable, column: 'code' | 'number') {
  const client = getSupabaseClient() as unknown as {
    from: (tableName: NumberTable) => {
      select: (columns: string) => PromiseLike<{
        data: Array<Record<string, unknown>> | null;
        error: { message: string } | null;
      }>;
    };
  };
  const { data, error } = await client.from(table).select(column);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row[column])
    .filter((value): value is string => typeof value === 'string');
}

function maxSequence(values: string[], prefix: string) {
  return values.reduce((max, value) => {
    if (!value.startsWith(prefix)) return max;
    const sequence = Number(value.slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
}

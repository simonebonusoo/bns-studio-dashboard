import { db } from '@/data/db';
import { IS_DEMO } from '@/config/env';
import { getActiveSession } from '@/services/session';
import { getSupabaseClient } from '@/services/supabase';
import type { Organization } from '@/types';

type OrganizationRow = Record<string, unknown>;

export interface OrganizationSettingsPatch {
  name: string;
  email: string;
  vat: string;
  currency: string;
  timezone: string;
  locale: string;
}

function mapOrganization(row: OrganizationRow): Organization {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    email: row.email ? String(row.email) : null,
    currency: String(row.currency ?? 'EUR'),
    locale: String(row.locale ?? 'it-IT'),
    timezone: String(row.timezone ?? 'Europe/Rome'),
    vat: row.vat ? String(row.vat) : null,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

function activeOrganizationId() {
  const organizationId = getActiveSession().organizationId;
  if (!organizationId) throw new Error('Organizzazione non disponibile');
  return organizationId;
}

export async function getCurrentOrganization(): Promise<Organization | null> {
  const organizationId = activeOrganizationId();
  if (IS_DEMO) {
    return (await db.organizations.get(organizationId)) ?? null;
  }

  const supabase = getSupabaseClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: OrganizationRow | null; error: Error | null }>;
        };
      };
    };
  };
  const { data, error } = await supabase.from('organizations').select('*').eq('id', organizationId).maybeSingle();
  if (error) throw error;
  return data ? mapOrganization(data) : null;
}

export async function updateCurrentOrganization(patch: OrganizationSettingsPatch): Promise<Organization> {
  const organizationId = activeOrganizationId();
  const now = new Date().toISOString();
  if (IS_DEMO) {
    const current = await db.organizations.get(organizationId);
    if (!current) throw new Error('Organizzazione demo non trovata');
    const updated = { ...current, ...patch, updatedAt: now };
    await db.organizations.put(updated);
    return updated;
  }

  const payload = {
    name: patch.name,
    email: patch.email || null,
    vat: patch.vat || null,
    currency: patch.currency,
    timezone: patch.timezone,
    locale: patch.locale,
    updated_at: now,
  };

  const supabase = getSupabaseClient() as unknown as {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => {
          select: (columns: string) => {
            single: () => Promise<{ data: OrganizationRow | null; error: Error | null }>;
          };
        };
      };
    };
  };
  const { data, error } = await supabase.from('organizations').update(payload).eq('id', organizationId).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('Salvataggio organizzazione non riuscito');
  return mapOrganization(data);
}

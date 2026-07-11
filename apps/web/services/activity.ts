import { db } from '@/data/db';
import { IS_DEMO } from '@/config/env';
import { nowISO, uid } from '@/lib/id';
import { getActiveSession } from '@/services/session';
import { getSupabaseClient } from '@/services/supabase';
import type { Json } from '@/types/database.generated';
import type { ActivityLog } from '@/types';

export interface ActivityInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

const SKIPPED_ENTITY_TYPES = new Set(['activity_log', 'notification']);

export async function recordActivity(input: ActivityInput): Promise<void> {
  const session = getActiveSession();
  if (!session.organizationId || SKIPPED_ENTITY_TYPES.has(input.entityType)) return;

  if (IS_DEMO) {
    const timestamp = nowISO();
    const row: ActivityLog = {
      id: uid(),
      organizationId: session.organizationId,
      actorId: session.memberId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.activityLogs.add(row);
    return;
  }

  const { error } = await getSupabaseClient().from('activity_logs').insert({
    organization_id: session.organizationId,
    actor_id: session.memberId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: (input.metadata ?? {}) as Json,
    created_at: nowISO(),
  });
  if (error) throw error;
}

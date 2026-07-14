import { IS_DEMO } from '@/config/env';
import { db } from '@/data/db';
import { nowISO, uid } from '@/lib/id';
import { getActiveSession } from '@/services/session';
import { getSupabaseClient } from '@/services/supabase';
import { repositories } from '@/services/repository';
import { fileService } from '@/services/fileService';
import type {
  Client,
  Contract,
  Estimate,
  FileItem,
  Invoice,
  Member,
  Notification,
  Payment,
  Project,
  StudioConversation,
  StudioConversationMember,
  StudioConversationRead,
  StudioEntityReference,
  StudioEntityType,
  StudioMessage,
  StudioMessageAttachment,
  StudioMessageReaction,
  StudioMessageSave,
  Task,
} from '@/types';

const DEFAULT_CHANNELS = [
  { name: 'generale', slug: 'generale', description: 'Aggiornamenti trasversali e comunicazioni di team.' },
  { name: 'commerciale', slug: 'commerciale', description: 'Lead, offerte, follow-up e opportunita.' },
  { name: 'sviluppo', slug: 'sviluppo', description: 'Frontend, backend, automazioni e problemi tecnici.' },
  { name: 'design', slug: 'design', description: 'UI, brand, asset, revisioni creative.' },
  { name: 'amministrazione', slug: 'amministrazione', description: 'Fatture, pagamenti, contratti e scadenze.' },
  { name: 'contenuti', slug: 'contenuti', description: 'Copy, piani editoriali, materiale cliente.' },
] as const;

type DbRow = Record<string, unknown>;
type StudioTable =
  | 'studio_conversations'
  | 'studio_conversation_members'
  | 'studio_messages'
  | 'studio_message_reactions'
  | 'studio_message_saves'
  | 'studio_conversation_reads'
  | 'studio_message_attachments';

export interface StudioWorkspace {
  conversations: StudioConversation[];
  conversationMembers: StudioConversationMember[];
  reads: StudioConversationRead[];
  members: Member[];
  projects: Project[];
  clients: Client[];
  tasks: Task[];
  estimates: Estimate[];
  contracts: Contract[];
  invoices: Invoice[];
  payments: Payment[];
  files: FileItem[];
  notifications: Notification[];
  unreadByConversation: Record<string, number>;
}

export interface StudioMessagesPage {
  messages: StudioMessage[];
  reactions: StudioMessageReaction[];
  saves: StudioMessageSave[];
  attachments: StudioMessageAttachment[];
  threadCounts: Record<string, number>;
  hasMore: boolean;
  nextBefore?: string;
}

export interface StudioSendInput {
  conversationId: string;
  authorId: string;
  content: string;
  parentMessageId?: string | null;
  references?: StudioEntityReference[];
  mentionIds?: string[];
  mentionEveryone?: boolean;
  files?: File[];
}

function organizationId() {
  const id = getActiveSession().organizationId;
  if (!id) throw new Error('Organizzazione non disponibile');
  return id;
}

function memberId() {
  const id = getActiveSession().memberId;
  if (!id) throw new Error('Membro non disponibile');
  return id;
}

function toSnake(value: string) {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function toCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function serialize(row: DbRow): DbRow {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined).map(([key, value]) => [toSnake(key), value]));
}

function deserialize<T>(row: DbRow): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [toCamel(key), value])) as T;
}

function supabaseTable(table: StudioTable) {
  return (getSupabaseClient() as unknown as { from: (relation: string) => any }).from(table);
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'studio';
}

function activeInternalMembers(members: Member[]) {
  return members.filter((m) => m.role !== 'client' && m.status === 'active');
}

function studioId() {
  return IS_DEMO ? uid() : crypto.randomUUID();
}

function projectConversation(project: Project, createdBy?: string | null): Omit<StudioConversation, 'createdAt' | 'updatedAt'> {
  const slug = `progetto-${slugify(project.code || project.name)}`;
  return {
    id: studioId(),
    organizationId: project.organizationId,
    type: 'project',
    name: project.code.toLowerCase(),
    slug,
    description: project.name,
    projectId: project.id,
    isPrivate: false,
    createdBy: createdBy ?? undefined,
    archivedAt: null,
    deletedAt: null,
  };
}

async function insertSupabase<T>(table: StudioTable, payload: Partial<T>) {
  const { error } = await supabaseTable(table).insert(serialize(payload as DbRow));
  if (error) throw error;
  return payload as T;
}

async function updateSupabase<T>(table: StudioTable, id: string, patch: Partial<T>) {
  const { data, error } = await supabaseTable(table).update(serialize(patch as DbRow)).eq('id', id).select('*').single();
  if (error) throw error;
  return deserialize<T>(data as DbRow);
}

async function listSupabase<T>(table: StudioTable) {
  const { data, error } = await supabaseTable(table).select('*').is('deleted_at', null);
  if (error) throw error;
  return ((data ?? []) as DbRow[]).map((row) => deserialize<T>(row));
}

async function upsertConversationMember(conversationId: string, targetMemberId: string, role: StudioConversationMember['role'] = 'member') {
  const org = organizationId();
  const timestamp = nowISO();
  if (IS_DEMO) {
    const existing = await db.studioConversationMembers
      .where('conversationId')
      .equals(conversationId)
      .toArray()
      .then((rows) => rows.find((row) => row.memberId === targetMemberId && !row.deletedAt));
    if (existing) return existing;
    const row: StudioConversationMember = {
      id: studioId(),
      organizationId: org,
      conversationId,
      memberId: targetMemberId,
      role,
      joinedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
    await db.studioConversationMembers.add(row);
    return row;
  }

  const { data, error } = await supabaseTable('studio_conversation_members')
    .upsert(
      serialize({
        organizationId: org,
        conversationId,
        memberId: targetMemberId,
        role,
        joinedAt: timestamp,
        updatedAt: timestamp,
      }),
      { onConflict: 'conversation_id,member_id' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return deserialize<StudioConversationMember>(data as DbRow);
}

async function createConversation(input: Partial<StudioConversation> & Pick<StudioConversation, 'type' | 'name'>) {
  const timestamp = nowISO();
  const row: StudioConversation = {
    id: input.id ?? studioId(),
    organizationId: organizationId(),
    type: input.type,
    name: input.name.trim(),
    slug: input.slug ?? slugify(input.name),
    description: input.description ?? null,
    projectId: input.projectId ?? null,
    isPrivate: input.isPrivate ?? false,
    createdBy: input.createdBy ?? memberId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: input.archivedAt ?? null,
    deletedAt: null,
  };

  if (IS_DEMO) {
    await db.studioConversations.add(row);
  } else {
    await insertSupabase<StudioConversation>('studio_conversations', row);
  }
  await upsertConversationMember(row.id, row.createdBy ?? memberId(), 'owner');
  return row;
}

async function ensureDefaults(members: Member[], projects: Project[]) {
  const org = organizationId();
  const currentMember = memberId();
  const conversations = IS_DEMO
    ? await db.studioConversations.where('organizationId').equals(org).toArray()
    : await listSupabase<StudioConversation>('studio_conversations');
  const active = conversations.filter((c: StudioConversation) => !c.deletedAt && !c.archivedAt);

  const existingChannelSlugs = new Set(active.filter((c: StudioConversation) => c.type === 'channel').map((c) => c.slug));
  for (const channel of DEFAULT_CHANNELS) {
    if (existingChannelSlugs.has(channel.slug)) continue;
    const created = await createConversation({
      type: 'channel',
      name: channel.name,
      slug: channel.slug,
      description: channel.description,
      createdBy: currentMember,
    });
    for (const teamMember of activeInternalMembers(members)) {
      await upsertConversationMember(created.id, teamMember.id);
    }
  }

  const existingProjectIds = new Set(active.map((c: StudioConversation) => c.projectId).filter(Boolean));
  for (const project of projects.filter((p) => ['planned', 'active', 'waiting_client', 'review', 'paused'].includes(p.status))) {
    if (existingProjectIds.has(project.id)) continue;
    const row = projectConversation(project, currentMember);
    const created = await createConversation(row);
    const projectMembers = new Set([project.managerId, ...(project.memberIds ?? []), currentMember].filter(Boolean) as string[]);
    for (const id of projectMembers) await upsertConversationMember(created.id, id);
  }
}

async function unreadCounts(conversations: StudioConversation[], reads: StudioConversationRead[]) {
  const org = organizationId();
  const readByConversation = new Map(reads.map((read) => [read.conversationId, read.lastReadAt]));
  const result: Record<string, number> = {};
  for (const conversation of conversations) result[conversation.id] = 0;
  if (conversations.length === 0) return result;

  if (IS_DEMO) {
    const messages = await db.studioMessages.where('organizationId').equals(org).toArray();
    for (const message of messages) {
      if (message.deletedAt || message.parentMessageId) continue;
      const lastRead = readByConversation.get(message.conversationId);
      if (!lastRead || message.createdAt > lastRead) result[message.conversationId] = (result[message.conversationId] ?? 0) + 1;
    }
    return result;
  }

  const oldestRead = reads.length > 0 ? reads.map((r) => r.lastReadAt).sort()[0] : '1970-01-01T00:00:00.000Z';
  const { data, error } = await supabaseTable('studio_messages')
    .select('conversation_id, created_at')
    .eq('organization_id', org)
    .is('deleted_at', null)
    .is('parent_message_id', null)
    .gt('created_at', oldestRead);
  if (error) throw error;
  for (const row of data ?? []) {
    const conversationId = String(row.conversation_id);
    const lastRead = readByConversation.get(conversationId);
    if (!lastRead || String(row.created_at) > lastRead) result[conversationId] = (result[conversationId] ?? 0) + 1;
  }
  return result;
}

async function createMentionNotifications(message: StudioMessage) {
  const metadata = message.metadata ?? {};
  const targets = new Set(metadata.mentions ?? []);
  if (metadata.mentionEveryone) {
    const members = await repositories.members.list() as Member[];
    for (const m of activeInternalMembers(members)) targets.add(m.id);
  }
  targets.delete(message.authorId);
  for (const target of targets) {
    await repositories.notifications.create({
      userId: target,
      type: 'mention',
      title: 'Ti hanno menzionato in Studio',
      body: message.content.slice(0, 140),
      entityType: 'studio_message',
      entityId: message.id,
      read: false,
    });
  }
}

export const studioService = {
  async loadWorkspace(): Promise<StudioWorkspace> {
    const [members, projects, clients, tasks, estimates, contracts, invoices, payments, files, notifications] = await Promise.all([
      repositories.members.list() as Promise<Member[]>,
      repositories.projects.list() as Promise<Project[]>,
      repositories.clients.list() as Promise<Client[]>,
      repositories.tasks.list() as Promise<Task[]>,
      repositories.estimates.list() as Promise<Estimate[]>,
      repositories.contracts.list() as Promise<Contract[]>,
      repositories.invoices.list() as Promise<Invoice[]>,
      repositories.payments.list() as Promise<Payment[]>,
      repositories.files.list() as Promise<FileItem[]>,
      repositories.notifications.list() as Promise<Notification[]>,
    ]);

    await ensureDefaults(members, projects);
    const org = organizationId();
    const [conversations, conversationMembers, reads] = IS_DEMO
      ? await Promise.all([
          db.studioConversations.where('organizationId').equals(org).toArray(),
          db.studioConversationMembers.where('organizationId').equals(org).toArray(),
          db.studioConversationReads.where('organizationId').equals(org).toArray(),
        ])
      : await Promise.all([
          listSupabase<StudioConversation>('studio_conversations'),
          listSupabase<StudioConversationMember>('studio_conversation_members'),
          listSupabase<StudioConversationRead>('studio_conversation_reads'),
        ]);
    const activeConversations = conversations.filter((c: StudioConversation) => !c.deletedAt && !c.archivedAt);
    return {
      conversations: activeConversations,
      conversationMembers,
      reads,
      members,
      projects,
      clients,
      tasks,
      estimates,
      contracts,
      invoices,
      payments,
      files,
      notifications,
      unreadByConversation: await unreadCounts(activeConversations, reads),
    };
  },

  async listMessages(conversationId: string, before?: string, limit = 40): Promise<StudioMessagesPage> {
    const org = organizationId();
    let messages: StudioMessage[];
    if (IS_DEMO) {
      const rows = await db.studioMessages
        .where('conversationId')
        .equals(conversationId)
        .toArray();
      messages = rows
        .filter((m) => !m.deletedAt && !m.parentMessageId && (!before || m.createdAt < before))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, limit + 1);
    } else {
      let query = supabaseTable('studio_messages')
        .select('*')
        .eq('organization_id', org)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .is('parent_message_id', null)
        .order('created_at', { ascending: false })
        .limit(limit + 1);
      if (before) query = query.lt('created_at', before);
      const { data, error } = await query;
      if (error) throw error;
      messages = ((data ?? []) as DbRow[]).map((row) => deserialize<StudioMessage>(row));
    }
    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const messageIds = page.map((m) => m.id);
    const threadParentIds = page.map((m) => m.id);
    const [reactions, saves, attachments] = await this.listMessageMeta([...messageIds, ...threadParentIds]);
    const threadCounts = await this.threadCounts(messageIds);
    return { messages: page, reactions, saves, attachments, threadCounts, hasMore, nextBefore: page[0]?.createdAt };
  },

  async threadCounts(parentMessageIds: string[]): Promise<Record<string, number>> {
    const counts = Object.fromEntries(parentMessageIds.map((id) => [id, 0])) as Record<string, number>;
    if (parentMessageIds.length === 0) return counts;
    const org = organizationId();
    if (IS_DEMO) {
      const parentIds = new Set(parentMessageIds);
      const rows = await db.studioMessages.where('organizationId').equals(org).toArray();
      for (const message of rows) {
        if (!message.parentMessageId || message.deletedAt || !parentIds.has(message.parentMessageId)) continue;
        counts[message.parentMessageId] = (counts[message.parentMessageId] ?? 0) + 1;
      }
      return counts;
    }
    const { data, error } = await supabaseTable('studio_messages')
      .select('parent_message_id')
      .eq('organization_id', org)
      .in('parent_message_id', parentMessageIds)
      .is('deleted_at', null);
    if (error) throw error;
    for (const row of data ?? []) {
      const parentId = String(row.parent_message_id);
      counts[parentId] = (counts[parentId] ?? 0) + 1;
    }
    return counts;
  },

  async listThread(parentMessageId: string): Promise<StudioMessagesPage> {
    const org = organizationId();
    let messages: StudioMessage[];
    if (IS_DEMO) {
      messages = (await db.studioMessages.where('parentMessageId').equals(parentMessageId).toArray())
        .filter((m) => !m.deletedAt)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    } else {
      const { data, error } = await supabaseTable('studio_messages')
        .select('*')
        .eq('organization_id', org)
        .eq('parent_message_id', parentMessageId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      messages = ((data ?? []) as DbRow[]).map((row) => deserialize<StudioMessage>(row));
    }
    const [reactions, saves, attachments] = await this.listMessageMeta(messages.map((m) => m.id));
    return { messages, reactions, saves, attachments, threadCounts: {}, hasMore: false };
  },

  async listMessageMeta(messageIds: string[]): Promise<[StudioMessageReaction[], StudioMessageSave[], StudioMessageAttachment[]]> {
    if (messageIds.length === 0) return [[], [], []];
    const org = organizationId();
    if (IS_DEMO) {
      const [reactions, saves, attachments] = await Promise.all([
        db.studioMessageReactions.where('organizationId').equals(org).toArray(),
        db.studioMessageSaves.where('organizationId').equals(org).toArray(),
        db.studioMessageAttachments.where('organizationId').equals(org).toArray(),
      ]);
      const ids = new Set(messageIds);
      return [
        reactions.filter((row) => ids.has(row.messageId) && !row.deletedAt),
        saves.filter((row) => ids.has(row.messageId) && !row.deletedAt),
        attachments.filter((row) => ids.has(row.messageId) && !row.deletedAt),
      ];
    }

    const [reactions, saves, attachments] = await Promise.all([
      supabaseTable('studio_message_reactions').select('*').eq('organization_id', org).in('message_id', messageIds).is('deleted_at', null),
      supabaseTable('studio_message_saves').select('*').eq('organization_id', org).in('message_id', messageIds).is('deleted_at', null),
      supabaseTable('studio_message_attachments').select('*').eq('organization_id', org).in('message_id', messageIds).is('deleted_at', null),
    ]);
    if (reactions.error) throw reactions.error;
    if (saves.error) throw saves.error;
    if (attachments.error) throw attachments.error;
    return [
      ((reactions.data ?? []) as DbRow[]).map((row) => deserialize<StudioMessageReaction>(row)),
      ((saves.data ?? []) as DbRow[]).map((row) => deserialize<StudioMessageSave>(row)),
      ((attachments.data ?? []) as DbRow[]).map((row) => deserialize<StudioMessageAttachment>(row)),
    ];
  },

  async sendMessage(input: StudioSendInput) {
    const timestamp = nowISO();
    const id = studioId();
    const message: StudioMessage = {
      id,
      organizationId: organizationId(),
      conversationId: input.conversationId,
      authorId: input.authorId,
      parentMessageId: input.parentMessageId ?? null,
      content: input.content,
      metadata: {
        mentions: input.mentionIds ?? [],
        mentionEveryone: input.mentionEveryone ?? false,
        references: input.references ?? [],
      },
      edited: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    if (IS_DEMO) {
      await db.studioMessages.add(message);
    } else {
      await insertSupabase<StudioMessage>('studio_messages', message);
    }

    if (input.files?.length) {
      for (const file of input.files) {
        const uploaded = await fileService.upload({
          file,
          entityType: 'studio_message',
          entityId: id,
          folder: 'Studio',
          metadata: { conversationId: input.conversationId },
        });
        const attachment: StudioMessageAttachment = {
          id: studioId(),
          organizationId: organizationId(),
          messageId: id,
          fileId: uploaded.id,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          deletedAt: null,
        };
        if (IS_DEMO) await db.studioMessageAttachments.add(attachment);
        else await insertSupabase<StudioMessageAttachment>('studio_message_attachments', attachment);
      }
    }

    await createMentionNotifications(message);
    return message;
  },

  async updateMessage(message: StudioMessage, content: string) {
    const patch = { content, edited: true, updatedAt: nowISO() };
    if (IS_DEMO) {
      const updated = { ...message, ...patch };
      await db.studioMessages.put(updated);
      return updated;
    }
    return updateSupabase<StudioMessage>('studio_messages', message.id, patch);
  },

  async deleteMessage(message: StudioMessage) {
    const patch = { deletedAt: nowISO(), updatedAt: nowISO(), content: 'Messaggio eliminato' };
    if (IS_DEMO) {
      await db.studioMessages.put({ ...message, ...patch });
      return;
    }
    await updateSupabase<StudioMessage>('studio_messages', message.id, patch);
  },

  async toggleReaction(messageId: string, emoji: string) {
    const org = organizationId();
    const currentMember = memberId();
    if (IS_DEMO) {
      const existing = (await db.studioMessageReactions.where('messageId').equals(messageId).toArray())
        .find((row) => row.memberId === currentMember && row.emoji === emoji && !row.deletedAt);
      if (existing) {
        await db.studioMessageReactions.delete(existing.id);
        return;
      }
      await db.studioMessageReactions.add({
        id: studioId(),
        organizationId: org,
        messageId,
        memberId: currentMember,
        emoji,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        deletedAt: null,
      });
      return;
    }
    const { data } = await supabaseTable('studio_message_reactions')
      .select('*')
      .eq('message_id', messageId)
      .eq('member_id', currentMember)
      .eq('emoji', emoji)
      .maybeSingle();
    if (data) {
      const { error } = await supabaseTable('studio_message_reactions').delete().eq('id', String(data.id));
      if (error) throw error;
      return;
    }
    await insertSupabase<StudioMessageReaction>('studio_message_reactions', {
      organizationId: org,
      messageId,
      memberId: currentMember,
      emoji,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
  },

  async toggleSave(messageId: string) {
    const org = organizationId();
    const currentMember = memberId();
    if (IS_DEMO) {
      const existing = (await db.studioMessageSaves.where('messageId').equals(messageId).toArray())
        .find((row) => row.memberId === currentMember && !row.deletedAt);
      if (existing) {
        await db.studioMessageSaves.delete(existing.id);
        return;
      }
      await db.studioMessageSaves.add({
        id: studioId(),
        organizationId: org,
        messageId,
        memberId: currentMember,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        deletedAt: null,
      });
      return;
    }
    const { data } = await supabaseTable('studio_message_saves')
      .select('*')
      .eq('message_id', messageId)
      .eq('member_id', currentMember)
      .maybeSingle();
    if (data) {
      const { error } = await supabaseTable('studio_message_saves').delete().eq('id', String(data.id));
      if (error) throw error;
      return;
    }
    await insertSupabase<StudioMessageSave>('studio_message_saves', {
      organizationId: org,
      messageId,
      memberId: currentMember,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
  },

  async markRead(conversationId: string) {
    const org = organizationId();
    const currentMember = memberId();
    const timestamp = nowISO();
    if (IS_DEMO) {
      const existing = (await db.studioConversationReads.where('conversationId').equals(conversationId).toArray())
        .find((row) => row.memberId === currentMember);
      const row: StudioConversationRead = {
        id: existing?.id ?? studioId(),
        organizationId: org,
        conversationId,
        memberId: currentMember,
        lastReadAt: timestamp,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
      await db.studioConversationReads.put(row);
      return row;
    }
    const { data, error } = await supabaseTable('studio_conversation_reads')
      .upsert(
        serialize({
          organizationId: org,
          conversationId,
          memberId: currentMember,
          lastReadAt: timestamp,
          updatedAt: timestamp,
        }),
        { onConflict: 'conversation_id,member_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return deserialize<StudioConversationRead>(data as DbRow);
  },

  async createChannel(name: string, description?: string, isPrivate = false) {
    const channel = await createConversation({
      type: 'channel',
      name,
      slug: slugify(name),
      description: description?.trim() || null,
      isPrivate,
    });
    const members = await repositories.members.list() as Member[];
    for (const m of activeInternalMembers(members)) await upsertConversationMember(channel.id, m.id);
    return channel;
  },

  async updateConversation(conversation: StudioConversation, patch: Partial<StudioConversation>) {
    const updated = { ...conversation, ...patch, updatedAt: nowISO() };
    if (IS_DEMO) {
      await db.studioConversations.put(updated);
      return updated;
    }
    return updateSupabase<StudioConversation>('studio_conversations', conversation.id, { ...patch, updatedAt: nowISO() });
  },

  async archiveConversation(conversation: StudioConversation) {
    return this.updateConversation(conversation, { archivedAt: nowISO() });
  },

  async openDm(targetMemberId: string) {
    const currentMember = memberId();
    const [a, b] = [currentMember, targetMemberId].sort();
    const slug = `dm-${a}-${b}`;
    const workspace = await this.loadWorkspace();
    const existing = workspace.conversations.find((c) => c.type === 'dm' && c.slug === slug);
    if (existing) return existing;
    const target = workspace.members.find((m) => m.id === targetMemberId);
    const conversation = await createConversation({
      type: 'dm',
      name: target?.displayName || `${target?.firstName ?? ''} ${target?.lastName ?? ''}`.trim() || 'Messaggio diretto',
      slug,
      isPrivate: true,
    });
    await upsertConversationMember(conversation.id, currentMember);
    await upsertConversationMember(conversation.id, targetMemberId);
    return conversation;
  },

  async savedMessages() {
    const org = organizationId();
    const currentMember = memberId();
    let saves: StudioMessageSave[];
    if (IS_DEMO) {
      saves = (await db.studioMessageSaves.where('organizationId').equals(org).toArray())
        .filter((row) => row.memberId === currentMember && !row.deletedAt);
      const ids = new Set(saves.map((save) => save.messageId));
      return (await db.studioMessages.where('organizationId').equals(org).toArray())
        .filter((message) => ids.has(message.id) && !message.deletedAt)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    const { data: saveRows, error: saveError } = await supabaseTable('studio_message_saves')
      .select('message_id')
      .eq('organization_id', org)
      .eq('member_id', currentMember)
      .is('deleted_at', null);
    if (saveError) throw saveError;
    const ids = ((saveRows ?? []) as DbRow[]).map((row) => String(row.message_id));
    if (ids.length === 0) return [];
    const { data, error } = await supabaseTable('studio_messages')
      .select('*')
      .in('id', ids)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as DbRow[]).map((row) => deserialize<StudioMessage>(row));
  },

  async searchMessages(query: string) {
    const q = query.trim();
    if (!q) return [];
    const org = organizationId();
    if (IS_DEMO) {
      return (await db.studioMessages.where('organizationId').equals(org).toArray())
        .filter((message) => !message.deletedAt && message.content.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 30);
    }
    const { data, error } = await supabaseTable('studio_messages')
      .select('*')
      .eq('organization_id', org)
      .is('deleted_at', null)
      .ilike('content', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return ((data ?? []) as DbRow[]).map((row) => deserialize<StudioMessage>(row));
  },

  entityHref(type: StudioEntityType, id: string) {
    if (type === 'client') return `/clients/${id}`;
    if (type === 'project') return `/projects/${id}`;
    if (type === 'estimate') return `/estimates/${id}`;
    if (type === 'invoice') return `/invoices/${id}`;
    if (type === 'file') return '/files';
    if (type === 'payment') return '/payments';
    if (type === 'contract') return '/contracts';
    return `/projects`;
  },
};

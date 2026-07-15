import type { Member, StudioConversation, StudioEntityReference } from '@/types';

/**
 * Helper di formattazione della sezione Studio.
 *
 * Estratti da `StudioPage.tsx` nella Fase 0 del refactor (vedi
 * `docs/STUDIO_IMPLEMENTATION_PLAN.md`). Questo è il punto di estensione per lo
 * slice **C1 · Editor ricco** (owner: codex): qui vanno aggiunti corsivo,
 * barrato, titoli, liste, citazioni, blocchi di codice e link — mantenendo il
 * testo grezzo (markdown) in `content` e **sanitizzando** l'output HTML.
 *
 * Funzioni pure, senza JSX né dipendenze React: sicure da importare ovunque.
 */

export function memberName(member?: Member | null): string {
  if (!member) return 'Sistema';
  return member.displayName || `${member.firstName} ${member.lastName}`;
}

export function conversationTitle(
  conversation?: StudioConversation | null,
  members?: Member[],
  currentMemberId?: string | null,
): string {
  if (!conversation) return 'Studio';
  if (conversation.type === 'dm') {
    const other = members?.find((member) => conversation.slug.includes(member.id) && member.id !== currentMemberId);
    return other ? memberName(other) : conversation.name;
  }
  return conversation.type === 'project' ? conversation.name : `#${conversation.name}`;
}

/**
 * Rende il contenuto in HTML (per `dangerouslySetInnerHTML`). Oggi supporta:
 * escaping, `code` inline, **grassetto**, a-capo, menzioni `@member:` e
 * riferimenti entità `[[ref:]]`. Estendere qui per l'editor ricco (C1).
 */
export function formatMessage(content: string, mentions: Member[], references: StudioEntityReference[]): string {
  const mentionById = new Map(mentions.map((member) => [member.id, member]));
  const referenceById = new Map(references.map((reference) => [reference.id, reference]));
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/`([^`]+)`/g, '<code class="rounded bg-surface-2 px-1 py-0.5 text-[0.92em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />')
    .replace(/@(member:[a-zA-Z0-9_-]+)/g, (_, token: string) => {
      const id = token.replace('member:', '');
      const member = mentionById.get(id);
      return `<span class="rounded-md bg-accent/15 px-1 font-medium text-fg">@${member ? memberName(member).split(' ')[0] : 'membro'}</span>`;
    })
    .replace(/\[\[(ref:[a-zA-Z0-9_-]+)\]\]/g, (_, token: string) => {
      const reference = referenceById.get(token.replace('ref:', ''));
      return reference
        ? `<a class="rounded-md bg-info/10 px-1 font-medium text-info hover:underline" href="${reference.href}">${reference.label}</a>`
        : '';
    });
}

/** Versione testuale piatta (per anteprime ricerca, notifiche, ecc.). */
export function readableMessageText(content: string, members: Member[], references: StudioEntityReference[]): string {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const referenceById = new Map(references.map((reference) => [reference.id, reference]));
  return content
    .replace(/@(member:[a-zA-Z0-9_-]+)/g, (_, token: string) => {
      const member = memberById.get(token.replace('member:', ''));
      return `@${member ? memberName(member).split(' ')[0] : 'membro'}`;
    })
    .replace(/\[\[(ref:[a-zA-Z0-9_-]+)\]\]/g, (_, token: string) => {
      const reference = referenceById.get(token.replace('ref:', ''));
      return reference?.label ?? '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message);
  return fallback;
}

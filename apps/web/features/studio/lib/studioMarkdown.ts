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

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function safeHref(href: string): string | null {
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeReferenceHref(href: string): string {
  const trimmed = href.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return href;
  return safeHref(trimmed) ?? '#';
}

/**
 * Rende il contenuto in HTML (per `dangerouslySetInnerHTML`). Supporta escaping,
 * `code` inline, blocchi di codice, enfasi, titoli, liste, citazioni, link
 * sicuri, menzioni `@member:` e riferimenti entità `[[ref:]]`.
 */
export function formatMessage(content: string, mentions: Member[], references: StudioEntityReference[]): string {
  const mentionById = new Map(mentions.map((member) => [member.id, member]));
  const referenceById = new Map(references.map((reference) => [reference.id, reference]));
  const placeholders: string[] = [];
  const createPlaceholder = (html: string) => {
    const token = `\uE000${placeholders.length}\uE000`;
    placeholders.push(html);
    return token;
  };
  const restorePlaceholders = (value: string) => value.replace(/\uE000(\d+)\uE000/g, (_, index: string) => placeholders[Number(index)] ?? '');

  const formatInline = (value: string) => {
    const withInlineCode = value.replace(/`([^`]+)`/g, (_, code: string) =>
      createPlaceholder(`<code class="rounded bg-surface-2 px-1 py-0.5 text-[0.92em]">${code}</code>`),
    );

    return withInlineCode
      .replace(/\[([^\]\n]+)\]\(([^\s]+)\)/g, (_, label: string, href: string) => {
        const safeUrl = safeHref(href.replace(/&amp;/g, '&'));
        return safeUrl
          ? `<a class="font-medium text-info hover:underline" href="${escapeAttribute(safeUrl)}" rel="noopener noreferrer" target="_blank">${label}</a>`
          : label;
      })
      .replace(/@(member:[a-zA-Z0-9_-]+)/g, (_, token: string) => {
        const id = token.replace('member:', '');
        const member = mentionById.get(id);
        return `<span class="rounded-md bg-accent/15 px-1 font-medium text-fg">@${member ? memberName(member).split(' ')[0] : 'membro'}</span>`;
      })
      .replace(/\[\[(ref:[a-zA-Z0-9_-]+)\]\]/g, (_, token: string) => {
        const reference = referenceById.get(token.replace('ref:', ''));
        return reference
          ? `<a class="rounded-md bg-info/10 px-1 font-medium text-info hover:underline" href="${escapeAttribute(safeReferenceHref(reference.href))}">${escapeHtml(reference.label)}</a>`
          : '';
      })
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  };

  const escaped = escapeHtml(content).replace(/```([a-zA-Z0-9_-]+)?[^\S\n]*\n?([\s\S]*?)```/g, (_, language: string | undefined, code: string) => {
    const languageClass = language ? ` class="language-${escapeAttribute(language)}"` : '';
    return createPlaceholder(`<pre class="overflow-x-auto rounded-lg bg-surface-2 p-3"><code${languageClass}>${code}</code></pre>`);
  });

  const lines = escaped.split('\n');
  const html: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let blockquoteLines: string[] = [];

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };
  const closeBlockquote = () => {
    if (!blockquoteLines.length) return;
    html.push(`<blockquote class="border-l-2 border-border pl-3 text-muted">${blockquoteLines.join('<br />')}</blockquote>`);
    blockquoteLines = [];
  };

  lines.forEach((line) => {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const unordered = /^-\s+(.+)$/.exec(line);
    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    const quote = /^&gt;\s?(.*)$/.exec(line);

    if (quote) {
      closeList();
      blockquoteLines.push(formatInline(quote[1] ?? ''));
      return;
    }

    closeBlockquote();

    if (heading) {
      closeList();
      const tag = heading[1].length === 1 ? 'h3' : 'h4';
      const className =
        heading[1].length === 1
          ? 'mt-3 text-base font-semibold text-fg'
          : heading[1].length === 2
            ? 'mt-3 text-sm font-semibold text-fg'
            : 'mt-2 text-xs font-semibold uppercase text-muted';
      html.push(`<${tag} class="${className}">${formatInline(heading[2])}</${tag}>`);
      return;
    }

    if (unordered || ordered) {
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        html.push(`<${listType} class="${listType === 'ul' ? 'list-disc' : 'list-decimal'} space-y-1 pl-5">`);
      }
      html.push(`<li>${formatInline((unordered ?? ordered)?.[1] ?? '')}</li>`);
      return;
    }

    closeList();
    html.push(formatInline(line));
  });

  closeList();
  closeBlockquote();

  return restorePlaceholders(html.join('<br />').replace(/<br \/><(\/?(?:ul|ol|li|blockquote|h3|h4|pre)\b)/g, '<$1').replace(/(<\/(?:ul|ol|li|blockquote|h3|h4|pre)>)<br \/>/g, '$1'));
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

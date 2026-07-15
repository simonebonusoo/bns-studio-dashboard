import { useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Copy,
  Edit3,
  MessageSquare,
  MoreHorizontal,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { memberAvatarProps } from '@/lib/memberAvatar';
import { useAuth } from '@/stores/auth';
import type { StudioMessagesPage, StudioWorkspace } from '@/services/studioService';
import type { StudioMessage, StudioMessageReaction } from '@/types';
import { formatMessage, memberName } from '../lib/studioMarkdown';
import { AttachmentPreview } from './AttachmentPreview';

/** Reazioni rapide di default. Slice C3 (codex) sostituirà con emoji picker completo. */
const EMOJI = ['👍', '✅', '🔥', '👀', '💡', '🙏'];

export function MessageItem({
  message,
  workspace,
  page,
  threadCount,
  onThread,
  onReact,
  onSave,
  onEdit,
  onDelete,
}: {
  message: StudioMessage;
  workspace: StudioWorkspace;
  page: StudioMessagesPage;
  threadCount: number;
  onThread: (message: StudioMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onSave: (messageId: string) => void;
  onEdit: (message: StudioMessage) => void;
  onDelete: (message: StudioMessage) => void;
}) {
  const currentMemberId = useAuth((state) => state.memberId);
  const role = useAuth((state) => state.role);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const author = workspace.members.find((member) => member.id === message.authorId);
  const references = message.metadata.references ?? [];
  const mentions = workspace.members.filter((member) => (message.metadata.mentions ?? []).includes(member.id));
  const reactions = page.reactions.filter((reaction) => reaction.messageId === message.id);
  const attachments = page.attachments.filter((attachment) => attachment.messageId === message.id);
  const saved = page.saves.some((save) => save.messageId === message.id && save.memberId === currentMemberId);
  const canManage = message.authorId === currentMemberId || role === 'owner' || role === 'admin';
  const groupedReactions = reactions.reduce<Record<string, StudioMessageReaction[]>>((acc, reaction) => {
    (acc[reaction.emoji] ??= []).push(reaction);
    return acc;
  }, {});

  return (
    <article className="group relative flex gap-3 rounded-lg px-3 py-2 hover:bg-surface-2/70">
      {author ? <Avatar {...memberAvatarProps(author)} size="sm" /> : <Avatar name="Sistema" size="sm" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-fg">{memberName(author)}</span>
          <span className="text-xs text-fg-faint">{formatRelative(message.createdAt)}</span>
          {message.edited && <span className="text-xs text-fg-faint">modificato</span>}
        </div>
        <div
          className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-fg-subtle"
          dangerouslySetInnerHTML={{ __html: formatMessage(message.content, mentions, references) }}
        />
        {attachments.map((attachment) => <AttachmentPreview key={attachment.id} attachment={attachment} files={workspace.files} />)}
        {(Object.keys(groupedReactions).length > 0 || threadCount > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {Object.entries(groupedReactions).map(([emoji, rows]) => {
              const active = rows.some((reaction) => reaction.memberId === currentMemberId);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(message.id, emoji)}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-xs transition-colors',
                    active ? 'border-accent bg-accent/15 text-fg' : 'border-border bg-surface text-fg-subtle hover:bg-surface-2',
                  )}
                >
                  {emoji} {rows.length}
                </button>
              );
            })}
            {threadCount > 0 && (
              <button onClick={() => onThread(message)} className="text-xs font-medium text-info hover:underline">
                {threadCount} risposte
              </button>
            )}
          </div>
        )}
      </div>
      <div className="absolute right-2 top-1.5 flex items-center rounded-lg border border-border bg-surface opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button className="p-1.5 text-fg-subtle hover:text-fg" onClick={() => setEmojiOpen((value) => !value)} title="Reazione">
          <SmilePlus className="h-4 w-4" />
        </button>
        <button className="p-1.5 text-fg-subtle hover:text-fg" onClick={() => onThread(message)} title="Rispondi nel thread">
          <MessageSquare className="h-4 w-4" />
        </button>
        <button className="p-1.5 text-fg-subtle hover:text-fg" onClick={() => onSave(message.id)} title={saved ? 'Rimuovi dai salvati' : 'Salva'}>
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
        <button className="p-1.5 text-fg-subtle hover:text-fg" onClick={() => void navigator.clipboard?.writeText(message.content)} title="Copia testo">
          <Copy className="h-4 w-4" />
        </button>
        {canManage && (
          <button className="p-1.5 text-fg-subtle hover:text-fg" onClick={() => setMenuOpen((value) => !value)} title="Altre opzioni">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
      {emojiOpen && (
        <div className="absolute right-28 top-9 z-20 flex rounded-lg border border-border bg-surface p-1 shadow-pop">
          {EMOJI.map((emoji) => (
            <button key={emoji} className="rounded-md px-2 py-1 hover:bg-surface-2" onClick={() => { onReact(message.id, emoji); setEmojiOpen(false); }}>
              {emoji}
            </button>
          ))}
        </div>
      )}
      {menuOpen && canManage && (
        <div className="absolute right-2 top-9 z-20 w-36 rounded-lg border border-border bg-surface p-1 shadow-pop">
          <button onClick={() => { setMenuOpen(false); onEdit(message); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-subtle hover:bg-surface-2 hover:text-fg">
            <Edit3 className="h-4 w-4" /> Modifica
          </button>
          <button onClick={() => { setMenuOpen(false); onDelete(message); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger hover:bg-danger/10">
            <Trash2 className="h-4 w-4" /> Elimina
          </button>
        </div>
      )}
    </article>
  );
}

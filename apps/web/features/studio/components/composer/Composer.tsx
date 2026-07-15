import { type KeyboardEvent, useMemo, useRef, useState } from 'react';
import { AtSign, Paperclip, Plus, Send, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { memberAvatarProps } from '@/lib/memberAvatar';
import { studioService, type StudioWorkspace } from '@/services/studioService';
import type { Member, StudioEntityReference, StudioEntityType } from '@/types';
import { memberName } from '../../lib/studioMarkdown';

/**
 * Barra di composizione messaggi. Estratta da StudioPage nella Fase 0.
 * Seam `ComposerPlugins`: qui si innestano editor ricco (C1), autocomplete
 * menzioni (C2) e command palette `/` (C5).
 */
export function Composer({
  placeholder,
  workspace,
  onSend,
  compact,
}: {
  placeholder: string;
  workspace: StudioWorkspace;
  onSend: (content: string, mentions: string[], mentionEveryone: boolean, references: StudioEntityReference[], files: File[]) => Promise<void> | void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const [entityOpen, setEntityOpen] = useState(false);
  const [references, setReferences] = useState<StudioEntityReference[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mentionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const member of workspace.members) {
      if (draft.includes(`@member:${member.id}`)) ids.add(member.id);
    }
    return [...ids];
  }, [draft, workspace.members]);
  const mentionEveryone = draft.includes('@tutti');
  const entities = useMemo(() => [
    ...workspace.clients.map((client) => ({ type: 'client' as StudioEntityType, entityId: client.id, label: client.displayName })),
    ...workspace.projects.map((project) => ({ type: 'project' as StudioEntityType, entityId: project.id, label: `${project.code} - ${project.name}` })),
    ...workspace.tasks.map((task) => ({ type: 'task' as StudioEntityType, entityId: task.id, label: task.title })),
    ...workspace.estimates.map((estimate) => ({ type: 'estimate' as StudioEntityType, entityId: estimate.id, label: estimate.number })),
    ...workspace.contracts.map((contract) => ({ type: 'contract' as StudioEntityType, entityId: contract.id, label: contract.number })),
    ...workspace.invoices.map((invoice) => ({ type: 'invoice' as StudioEntityType, entityId: invoice.id, label: invoice.number })),
    ...workspace.payments.map((payment) => ({ type: 'payment' as StudioEntityType, entityId: payment.id, label: payment.reference || payment.id })),
  ].slice(0, 40), [workspace]);

  const send = async () => {
    const content = draft.trim();
    if (sending || (!content && files.length === 0)) return;
    setSending(true);
    try {
      await onSend(content, mentionIds, mentionEveryone, references, files);
      setDraft('');
      setReferences([]);
      setFiles([]);
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === '@') setMentionsOpen(true);
    if (event.key === '/') setEntityOpen(true);
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send();
  };

  const addMention = (member: Member | 'all') => {
    setDraft((value) => `${value}${member === 'all' ? '@tutti' : `@member:${member.id}`} `);
    setMentionsOpen(false);
  };

  const addReference = (entry: { type: StudioEntityType; entityId: string; label: string }) => {
    const reference: StudioEntityReference = {
      id: crypto.randomUUID(),
      type: entry.type,
      entityId: entry.entityId,
      label: entry.label,
      href: studioService.entityHref(entry.type, entry.entityId),
    };
    setReferences((value) => [...value, reference]);
    setDraft((value) => `${value.replace(/\/$/, '')} [[ref:${reference.id}]] `);
    setEntityOpen(false);
  };

  return (
    <div className="relative shrink-0 border-t border-border bg-surface p-3">
      {references.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {references.map((reference) => (
            <span key={reference.id} className="inline-flex items-center gap-1 rounded-md bg-info/10 px-2 py-1 text-xs font-medium text-info">
              {reference.label}
              <button onClick={() => setReferences((rows) => rows.filter((row) => row.id !== reference.id))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((file) => (
            <span key={`${file.name}-${file.size}`} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-fg-subtle">{file.name}</span>
          ))}
        </div>
      )}
      <Textarea
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn('max-h-40 min-h-20 resize-none pr-3', compact && 'min-h-16')}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} title="Allega file">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMentionsOpen((value) => !value)} title="Menziona">
            <AtSign className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setEntityOpen((value) => !value)} title="Cita entita">
            <Plus className="h-4 w-4" />
          </Button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-fg-faint sm:inline">Enter invia, Shift+Enter va a capo</span>
          <Button onClick={() => void send()} loading={sending} disabled={sending || (!draft.trim() && files.length === 0)}>
            <Send className="h-4 w-4" /> Invia
          </Button>
        </div>
      </div>
      {mentionsOpen && (
        <div className="absolute bottom-24 left-3 z-30 max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-pop">
          <button onClick={() => addMention('all')} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2">
            <AtSign className="h-4 w-4" /> tutti
          </button>
          {workspace.members.filter((member) => member.role !== 'client').map((member) => (
            <button key={member.id} onClick={() => addMention(member)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2">
              <Avatar {...memberAvatarProps(member)} size="xs" />
              <span className="truncate">{memberName(member)}</span>
            </button>
          ))}
        </div>
      )}
      {entityOpen && (
        <div className="absolute bottom-24 left-16 z-30 max-h-80 w-[min(420px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-pop">
          {entities.map((entry) => (
            <button key={`${entry.type}-${entry.entityId}`} onClick={() => addReference(entry)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2">
              <span className="truncate">{entry.label}</span>
              <Badge tone="neutral">{entry.type}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

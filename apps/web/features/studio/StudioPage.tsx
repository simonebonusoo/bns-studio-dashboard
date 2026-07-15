import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  AtSign,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  Hash,
  Info,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { IS_DEMO } from '@/config/env';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { memberAvatarProps } from '@/lib/memberAvatar';
import { getSupabaseClient } from '@/services/supabase';
import { studioService, type StudioMessagesPage } from '@/services/studioService';
import { useAuth } from '@/stores/auth';
import { conversationTitle, errorMessage, memberName, readableMessageText } from './lib/studioMarkdown';
import { MessageItem } from './components/MessageItem';
import { Composer } from './components/composer/Composer';
import type {
  StudioConversation,
  StudioEntityReference,
  StudioMessage,
} from '@/types';

export default function StudioPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const member = useAuth((state) => state.member);
  const currentMemberId = useAuth((state) => state.memberId);
  const [selectedSpecial, setSelectedSpecial] = useState<'activity' | 'mentions' | 'saved' | null>(null);
  const [threadRoot, setThreadRoot] = useState<StudioMessage | null>(null);
  const [editing, setEditing] = useState<StudioMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudioMessage | null>(null);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [channelDetailsOpen, setChannelDetailsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [editChannelOpen, setEditChannelOpen] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelPrivate, setChannelPrivate] = useState(false);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelDescription, setEditChannelDescription] = useState('');
  const [editChannelPrivate, setEditChannelPrivate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const selectedConversationId = params.get('c');
  const selectedProjectId = params.get('project');

  const workspaceQuery = useQuery({ queryKey: ['studio', 'workspace'], queryFn: () => studioService.loadWorkspace() });
  const workspace = workspaceQuery.data;
  const activeMember = member ?? workspace?.members.find((teamMember) => teamMember.id === currentMemberId) ?? null;
  const selectedConversation = workspace?.conversations.find((conversation) => conversation.id === selectedConversationId)
    ?? workspace?.conversations.find((conversation) => conversation.projectId === selectedProjectId)
    ?? workspace?.conversations.find((conversation) => conversation.type === 'channel' && conversation.slug === 'generale')
    ?? workspace?.conversations[0]
    ?? null;

  useEffect(() => {
    if (!workspace || selectedConversationId || !selectedConversation) return;
    setParams({ c: selectedConversation.id }, { replace: true });
  }, [workspace, selectedConversation, selectedConversationId, setParams]);

  const messagesQuery = useInfiniteQuery({
    queryKey: ['studio', 'messages', selectedConversation?.id],
    queryFn: ({ pageParam }: { pageParam?: string }) => studioService.listMessages(selectedConversation!.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextBefore : undefined,
    enabled: Boolean(selectedConversation?.id) && !selectedSpecial,
  });
  const threadQuery = useQuery({
    queryKey: ['studio', 'thread', threadRoot?.id],
    queryFn: () => studioService.listThread(threadRoot!.id),
    enabled: Boolean(threadRoot),
  });
  const savedQuery = useQuery({
    queryKey: ['studio', 'saved'],
    queryFn: () => studioService.savedMessages(),
    enabled: selectedSpecial === 'saved',
  });
  const searchQueryResult = useQuery({
    queryKey: ['studio', 'search', searchQuery],
    queryFn: () => studioService.searchMessages(searchQuery),
    enabled: searchQuery.trim().length > 1,
  });

  const invalidateStudio = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['studio'] });
  }, [qc]);

  const sendMutation = useMutation({
    mutationFn: (input: { content: string; mentions: string[]; mentionEveryone: boolean; references: StudioEntityReference[]; files: File[]; parent?: string | null }) =>
      studioService.sendMessage({
        conversationId: selectedConversation!.id,
        authorId: activeMember!.id,
        content: input.content,
        mentionIds: input.mentions,
        mentionEveryone: input.mentionEveryone,
        references: input.references,
        files: input.files,
        parentMessageId: input.parent ?? null,
      }),
    onSuccess: async () => {
      if (selectedConversation?.id) await studioService.markRead(selectedConversation.id);
      invalidateStudio();
      requestAnimationFrame(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      });
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Impossibile inviare il messaggio'));
    },
  });

  const reactionMutation = useMutation({ mutationFn: ({ id, emoji }: { id: string; emoji: string }) => studioService.toggleReaction(id, emoji), onSuccess: invalidateStudio });
  const saveMutation = useMutation({ mutationFn: (id: string) => studioService.toggleSave(id), onSuccess: invalidateStudio });
  const updateMutation = useMutation({ mutationFn: ({ message, content }: { message: StudioMessage; content: string }) => studioService.updateMessage(message, content), onSuccess: () => { setEditing(null); invalidateStudio(); toast.success('Messaggio modificato'); } });
  const deleteMutation = useMutation({ mutationFn: (message: StudioMessage) => studioService.deleteMessage(message), onSuccess: () => { setDeleteTarget(null); invalidateStudio(); toast.success('Messaggio eliminato'); } });
  const createChannelMutation = useMutation({
    mutationFn: () => studioService.createChannel(channelName, channelDescription, channelPrivate),
    onSuccess: (conversation) => {
      setChannelModalOpen(false);
      setChannelName('');
      setChannelDescription('');
      setChannelPrivate(false);
      invalidateStudio();
      setParams({ c: conversation.id });
      toast.success('Canale creato');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Impossibile creare il canale'));
    },
  });
  const updateChannelMutation = useMutation({
    mutationFn: () => {
      if (!selectedConversation) throw new Error('Nessun canale selezionato');
      return studioService.updateConversation(selectedConversation, {
        name: editChannelName.trim(),
        description: editChannelDescription.trim() || null,
        isPrivate: editChannelPrivate,
      });
    },
    onSuccess: () => {
      setEditChannelOpen(false);
      invalidateStudio();
      toast.success('Canale aggiornato');
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'Impossibile aggiornare il canale'));
    },
  });
  const dmMutation = useMutation({
    mutationFn: (targetMemberId: string) => studioService.openDm(targetMemberId),
    onSuccess: (conversation) => {
      setSelectedSpecial(null);
      setThreadRoot(null);
      invalidateStudio();
      setParams({ c: conversation.id });
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (conversation: StudioConversation) => studioService.archiveConversation(conversation),
    onSuccess: () => { invalidateStudio(); toast.success('Canale archiviato'); },
  });

  useEffect(() => {
    if (!selectedConversation?.id) return;
    studioService.markRead(selectedConversation.id).then(invalidateStudio).catch(() => undefined);
  }, [invalidateStudio, selectedConversation?.id]);

  useEffect(() => {
    if (IS_DEMO || !selectedConversation?.id) return;
    const supabase = getSupabaseClient();
    let channel = supabase
      .channel(`studio:${selectedConversation.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'studio_messages', filter: `conversation_id=eq.${selectedConversation.id}` }, invalidateStudio)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'studio_message_reactions' }, invalidateStudio)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'studio_message_saves' }, invalidateStudio);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) supabase.realtime.setAuth(data.session.access_token);
      channel = channel.subscribe();
    }).catch(() => {
      channel = channel.subscribe();
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [invalidateStudio, selectedConversation?.id]);

  const page = useMemo<StudioMessagesPage>(() => {
    const pages = messagesQuery.data?.pages ?? [];
    const messages = pages.flatMap((item) => item.messages).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    return {
      messages,
      reactions: pages.flatMap((item) => item.reactions),
      saves: pages.flatMap((item) => item.saves),
      attachments: pages.flatMap((item) => item.attachments),
      threadCounts: Object.assign({}, ...pages.map((item) => item.threadCounts)),
      hasMore: pages.at(-1)?.hasMore ?? false,
      nextBefore: pages.at(-1)?.nextBefore,
    };
  }, [messagesQuery.data?.pages]);

  if (workspaceQuery.isError) return <ErrorState message="Non è stato possibile caricare Studio." />;
  if (workspaceQuery.isLoading || !workspace || !activeMember) return <LoadingState label="Caricamento Studio..." />;

  const channels = workspace.conversations.filter((conversation) => conversation.type === 'channel');
  const projectConversations = workspace.conversations.filter((conversation) => conversation.type === 'project');
  const dmConversations = workspace.conversations.filter((conversation) => conversation.type === 'dm');
  const threadCounts = new Map<string, number>();
  for (const message of threadQuery.data?.messages ?? []) threadCounts.set(message.parentMessageId ?? '', (threadCounts.get(message.parentMessageId ?? '') ?? 0) + 1);
  const mentionMessages = page.messages.filter((message) => (message.metadata.mentions ?? []).includes(activeMember.id) || message.metadata.mentionEveryone);
  const specialMessages = selectedSpecial === 'saved'
    ? savedQuery.data ?? []
    : selectedSpecial === 'mentions'
      ? mentionMessages
      : selectedSpecial === 'activity'
        ? page.messages
        : null;
  const visibleMessages: StudioMessage[] = specialMessages ?? page.messages;
  const searchResults: StudioMessage[] = searchQuery.trim().length > 1 ? searchQueryResult.data ?? [] : [];
  const selectedConversationMemberIds = new Set(
    workspace.conversationMembers
      .filter((row) => row.conversationId === selectedConversation?.id && !row.deletedAt)
      .map((row) => row.memberId),
  );
  const selectedConversationMembers = workspace.members.filter((teamMember) => selectedConversationMemberIds.has(teamMember.id));
  const selectedProject = selectedConversation?.projectId
    ? workspace.projects.find((project) => project.id === selectedConversation.projectId)
    : null;
  const studioNotifications = workspace.notifications
    .filter((notification) => notification.userId === activeMember.id && notification.entityType === 'studio_message')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 20);
  const canEditSelectedChannel = selectedConversation?.type === 'channel';

  const selectConversation = (conversation: StudioConversation) => {
    setSelectedSpecial(null);
    setThreadRoot(null);
    setParams({ c: conversation.id });
  };

  const openEditChannel = () => {
    if (!selectedConversation) return;
    setEditChannelName(selectedConversation.name);
    setEditChannelDescription(selectedConversation.description ?? '');
    setEditChannelPrivate(selectedConversation.isPrivate);
    setEditChannelOpen(true);
  };

  const selectSpecial = (special: 'activity' | 'mentions' | 'saved') => {
    setSelectedSpecial(special);
    setThreadRoot(null);
  };

  const renderConversationButton = (conversation: StudioConversation) => {
    const active = !selectedSpecial && selectedConversation?.id === conversation.id;
    const unread = workspace.unreadByConversation[conversation.id] ?? 0;
    return (
      <button
        key={conversation.id}
        onClick={() => selectConversation(conversation)}
        className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-fg-subtle hover:bg-surface-2 hover:text-fg', active && 'bg-surface-2 text-fg')}
      >
        {conversation.type === 'project' ? <MessageSquare className="h-4 w-4 shrink-0" /> : conversation.isPrivate ? <Lock className="h-4 w-4 shrink-0" /> : <Hash className="h-4 w-4 shrink-0" />}
        <span className="truncate">{conversation.name}</span>
        {unread > 0 && <Badge tone="accent" className="ml-auto">{unread}</Badge>}
      </button>
    );
  };

  return (
    <div className="flex h-full min-h-[720px] overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-bg/50 md:flex">
        <div className="border-b border-border px-4 py-3">
          <p className="text-base font-semibold tracking-[-0.02em]">Studio</p>
          <p className="text-xs text-fg-subtle">BNS Studio</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {([
              ['activity', 'Tutti i messaggi', MessageSquare],
              ['mentions', 'Menzioni', AtSign],
              ['saved', 'Salvati', Bookmark],
            ] satisfies Array<['activity' | 'mentions' | 'saved', string, typeof MessageSquare]>).map(([key, label, Icon]) => (
              <button key={String(key)} onClick={() => selectSpecial(key)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-fg-subtle hover:bg-surface-2 hover:text-fg', selectedSpecial === key && 'bg-surface-2 text-fg')}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-1 flex items-center justify-between px-2 text-2xs font-semibold uppercase tracking-wide text-fg-faint">
              <span>Canali</span>
              <button
                onClick={() => setChannelModalOpen(true)}
                title="Nuovo canale"
                aria-label="Nuovo canale"
                className="press inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-faint hover:bg-surface-2 hover:text-fg"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {channels.map(renderConversationButton)}
          </div>
          <div className="mt-5">
            <div className="mb-1 flex items-center gap-1 px-2 text-2xs font-semibold uppercase tracking-wide text-fg-faint">
              <ChevronDown className="h-3.5 w-3.5" /> Progetti
            </div>
            {projectConversations.map(renderConversationButton)}
          </div>
          <div className="mt-5">
            <div className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wide text-fg-faint">Messaggi diretti</div>
            {workspace.members.filter((teamMember) => teamMember.role !== 'client' && teamMember.id !== currentMemberId).map((teamMember) => {
              const dm = dmConversations.find((conversation) => conversation.slug.includes(teamMember.id));
              const unread = dm ? workspace.unreadByConversation[dm.id] ?? 0 : 0;
              return (
                <button key={teamMember.id} onClick={() => dmMutation.mutate(teamMember.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-fg-subtle hover:bg-surface-2 hover:text-fg">
                  <Avatar {...memberAvatarProps(teamMember)} size="xs" />
                  <span className="truncate">{memberName(teamMember)}</span>
                  <span className={cn('ml-auto h-2 w-2 rounded-full', teamMember.status === 'active' ? 'bg-success' : 'bg-fg-faint')} />
                  {unread > 0 && <Badge tone="accent">{unread}</Badge>}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-[-0.02em]">
              {selectedSpecial === 'saved' ? 'Salvati' : selectedSpecial === 'mentions' ? 'Menzioni' : selectedSpecial === 'activity' ? 'Tutti i messaggi' : conversationTitle(selectedConversation, workspace.members, currentMemberId)}
            </h1>
            <p className="truncate text-xs text-fg-subtle">
              {selectedConversation?.type === 'project' && selectedConversation.projectId
                ? `${selectedConversation.description} · Progetto`
                : selectedConversation?.description || 'Comunicazione interna BNS Studio'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-fg-faint" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cerca in Studio" className="w-56 pl-8" />
            </div>
            {selectedConversation?.type === 'project' && selectedConversation.projectId && (
              <Button variant="secondary" onClick={() => navigate(`/projects/${selectedConversation.projectId}`)}>
                Apri progetto
              </Button>
            )}
            <Button variant="ghost" size="icon" title="Dettagli conversazione" onClick={() => setChannelDetailsOpen(true)}><Info className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" title="Membri" onClick={() => setMembersOpen(true)}><Users className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" title="Notifiche" onClick={() => setNotificationsOpen(true)} className="relative">
              <Bell className="h-4 w-4" />
              {studioNotifications.some((notification) => !notification.read) && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />}
            </Button>
            {canEditSelectedChannel && (
              <Button variant="ghost" size="icon" title="Modifica canale" onClick={openEditChannel}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {selectedConversation?.type === 'channel' && (
              <Button variant="ghost" size="icon" title="Archivia canale" onClick={() => archiveMutation.mutate(selectedConversation)}>
                <Archive className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>

        {searchResults.length > 0 && (
          <div className="shrink-0 border-b border-border bg-surface-2/60 px-4 py-2">
            <p className="mb-1 text-xs font-semibold text-fg-faint">Risultati ricerca</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {searchResults.map((message) => (
                <button key={message.id} onClick={() => setParams({ c: message.conversationId })} className="max-w-72 shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs hover:bg-surface-2">
                  <span className="block truncate font-medium text-fg">{workspace.members.find((m) => m.id === message.authorId)?.displayName ?? 'Messaggio'}</span>
                  <span className="block truncate text-fg-subtle">
                    {readableMessageText(message.content, workspace.members, message.metadata.references ?? [])}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
          {messagesQuery.isLoading && !selectedSpecial ? (
            <LoadingState label="Caricamento messaggi..." />
          ) : visibleMessages.length === 0 ? (
            <EmptyState
              title={selectedSpecial === 'saved' ? 'Nessun salvato' : selectedSpecial === 'mentions' ? 'Nessuna menzione' : 'Nessun messaggio'}
              description={selectedSpecial === 'saved' ? 'I messaggi che salvi appariranno qui.' : selectedSpecial === 'mentions' ? 'Non hai nuove menzioni.' : `Inizia la conversazione in ${conversationTitle(selectedConversation, workspace.members, currentMemberId)}.`}
            />
          ) : (
            <>
              {!selectedSpecial && messagesQuery.hasNextPage && (
                <div className="mb-2 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => messagesQuery.fetchNextPage()} loading={messagesQuery.isFetchingNextPage}>
                    Carica messaggi precedenti
                  </Button>
                </div>
              )}
              {visibleMessages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  workspace={workspace}
                  page={page}
                  threadCount={page.threadCounts[message.id] ?? threadCounts.get(message.id) ?? 0}
                  onThread={setThreadRoot}
                  onReact={(id, emoji) => reactionMutation.mutate({ id, emoji })}
                  onSave={(id) => saveMutation.mutate(id)}
                  onEdit={setEditing}
                  onDelete={setDeleteTarget}
                />
              ))}
            </>
          )}
        </div>

        {!selectedSpecial && selectedConversation && (
          <Composer
            placeholder={`Scrivi in ${conversationTitle(selectedConversation, workspace.members, currentMemberId)}`}
            workspace={workspace}
            onSend={(content, mentions, mentionEveryone, references, files) => sendMutation.mutateAsync({ content, mentions, mentionEveryone, references, files }).then(() => undefined)}
          />
        )}
      </section>

      {threadRoot && (
        <aside className="hidden w-[360px] shrink-0 flex-col border-l border-border bg-surface lg:flex">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-base font-semibold">Thread</p>
              <p className="text-xs text-fg-subtle">{threadQuery.data?.messages.length ?? 0} risposte</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setThreadRoot(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <MessageItem
              message={threadRoot}
              workspace={workspace}
              page={page}
              threadCount={0}
              onThread={() => undefined}
              onReact={(id, emoji) => reactionMutation.mutate({ id, emoji })}
              onSave={(id) => saveMutation.mutate(id)}
              onEdit={setEditing}
              onDelete={setDeleteTarget}
            />
            <div className="my-2 border-t border-border" />
            {(threadQuery.data?.messages ?? []).map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                workspace={workspace}
                page={threadQuery.data ?? page}
                threadCount={0}
                onThread={() => undefined}
                onReact={(id, emoji) => reactionMutation.mutate({ id, emoji })}
                onSave={(id) => saveMutation.mutate(id)}
                onEdit={setEditing}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
          <Composer
            compact
            placeholder="Rispondi nel thread"
            workspace={workspace}
            onSend={(content, mentions, mentionEveryone, references, files) => sendMutation.mutateAsync({ content, mentions, mentionEveryone, references, files, parent: threadRoot.id }).then(() => undefined)}
          />
        </aside>
      )}

      <Modal open={channelModalOpen} onClose={() => setChannelModalOpen(false)} title="Nuovo canale Studio" size="sm" footer={<><Button variant="ghost" onClick={() => setChannelModalOpen(false)}>Annulla</Button><Button onClick={() => createChannelMutation.mutate()} loading={createChannelMutation.isPending} disabled={!channelName.trim()}><Check className="h-4 w-4" /> Crea</Button></>}>
        <div className="space-y-4">
          <Field label="Nome canale" required><Input value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="es. operations" /></Field>
          <Field label="Descrizione"><Textarea value={channelDescription} onChange={(event) => setChannelDescription(event.target.value)} placeholder="A cosa serve questo canale?" /></Field>
          <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-2/50 p-3 text-sm">
            <input type="checkbox" checked={channelPrivate} onChange={(event) => setChannelPrivate(event.target.checked)} className="mt-1" />
            <span>
              <span className="block font-medium text-fg">Canale privato</span>
              <span className="block text-xs text-fg-subtle">Visibile solo ai membri assegnati alla conversazione.</span>
            </span>
          </label>
        </div>
      </Modal>

      <Modal open={channelDetailsOpen} onClose={() => setChannelDetailsOpen(false)} title="Dettagli conversazione" size="md">
        {selectedConversation && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Nome</p>
              <p className="mt-1 font-medium text-fg">{conversationTitle(selectedConversation, workspace.members, currentMemberId)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Descrizione</p>
              <p className="mt-1 text-fg-subtle">{selectedConversation.description || 'Nessuna descrizione impostata.'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                <p className="text-xs text-fg-faint">Tipo</p>
                <p className="mt-1 font-medium text-fg">{selectedConversation.type === 'project' ? 'Progetto' : selectedConversation.type === 'dm' ? 'Messaggio diretto' : 'Canale'}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                <p className="text-xs text-fg-faint">Visibilità</p>
                <p className="mt-1 font-medium text-fg">{selectedConversation.isPrivate ? 'Privata' : 'Interna'}</p>
              </div>
            </div>
            {selectedProject && (
              <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                <p className="text-xs text-fg-faint">Progetto collegato</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{selectedProject.code} · {selectedProject.name}</p>
                    <p className="text-xs text-fg-subtle">I dati progetto restano nella scheda progetto.</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${selectedProject.id}`)}>Apri</Button>
                </div>
              </div>
            )}
            {canEditSelectedChannel && (
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => { setChannelDetailsOpen(false); openEditChannel(); }}>
                  <Settings className="h-4 w-4" /> Modifica canale
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={membersOpen} onClose={() => setMembersOpen(false)} title="Membri conversazione" description={`${selectedConversationMembers.length} membri`} size="md">
        <div className="space-y-2">
          {selectedConversationMembers.length === 0 ? (
            <EmptyState title="Nessun membro" description="Questa conversazione non ha ancora membri assegnati." />
          ) : selectedConversationMembers.map((teamMember) => {
            const relation = workspace.conversationMembers.find((row) => row.conversationId === selectedConversation?.id && row.memberId === teamMember.id);
            return (
              <div key={teamMember.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2">
                <Avatar {...memberAvatarProps(teamMember)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{memberName(teamMember)}</p>
                  <p className="truncate text-xs text-fg-subtle">{teamMember.jobTitle || teamMember.email}</p>
                </div>
                <Badge tone={teamMember.status === 'active' ? 'success' : 'neutral'}>{teamMember.status}</Badge>
                <Badge tone="neutral">{relation?.role ?? 'member'}</Badge>
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifiche Studio" size="md">
        <div className="space-y-2">
          {studioNotifications.length === 0 ? (
            <EmptyState title="Nessuna notifica" description="Le menzioni e gli aggiornamenti importanti di Studio appariranno qui." />
          ) : studioNotifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => {
                setNotificationsOpen(false);
                setSelectedSpecial('mentions');
              }}
              className="flex w-full gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-left hover:bg-surface-2"
            >
              <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', notification.read ? 'bg-fg-faint' : 'bg-danger')} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg">{notification.title}</span>
                {notification.body && <span className="mt-0.5 block max-h-10 overflow-hidden text-xs text-fg-subtle">{notification.body}</span>}
                <span className="mt-1 block text-xs text-fg-faint">{formatRelative(notification.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={editChannelOpen} onClose={() => setEditChannelOpen(false)} title="Modifica canale" size="sm" footer={<><Button variant="ghost" onClick={() => setEditChannelOpen(false)}>Annulla</Button><Button onClick={() => updateChannelMutation.mutate()} loading={updateChannelMutation.isPending} disabled={!editChannelName.trim()}>Salva</Button></>}>
        <div className="space-y-4">
          <Field label="Nome canale" required><Input value={editChannelName} onChange={(event) => setEditChannelName(event.target.value)} /></Field>
          <Field label="Descrizione"><Textarea value={editChannelDescription} onChange={(event) => setEditChannelDescription(event.target.value)} /></Field>
          <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-2/50 p-3 text-sm">
            <input type="checkbox" checked={editChannelPrivate} onChange={(event) => setEditChannelPrivate(event.target.checked)} className="mt-1" />
            <span>
              <span className="block font-medium text-fg">Canale privato</span>
              <span className="block text-xs text-fg-subtle">Limita la visibilità ai membri della conversazione.</span>
            </span>
          </label>
        </div>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Modifica messaggio" size="md" footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Annulla</Button><Button onClick={() => editing && updateMutation.mutate({ message: editing, content: editing.content })} loading={updateMutation.isPending}>Salva</Button></>}>
        {editing && <Textarea value={editing.content} onChange={(event) => setEditing({ ...editing, content: event.target.value })} className="min-h-40" />}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        title="Elimina messaggio"
        message="Il messaggio verrà rimosso dalla conversazione. I riferimenti e il thread resteranno gestiti in modo sicuro."
        confirmLabel="Elimina"
        danger
      />
    </div>
  );
}

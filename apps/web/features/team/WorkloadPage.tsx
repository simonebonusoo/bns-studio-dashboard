import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Hash, Pause, Play, Send, Square } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useCreate, useList } from '@/hooks/useEntities';
import { useAuth } from '@/stores/auth';
import { useTimer } from '@/features/time-tracking/timerStore';
import { formatHours, formatRelative } from '@/lib/format';
import { todayISO } from '@/lib/id';
import { cn } from '@/lib/cn';
import type { Comment, Member, Project, TimeEntry } from '@/types';
import { toast } from 'sonner';

function timerLabel(ms: number) {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
}

function workloadFor(member: Member, entries: TimeEntry[]) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthEntries = entries.filter(
    (entry) => entry.memberId === member.id && !entry.running && entry.date.startsWith(currentMonth),
  );
  const loggedMinutes = monthEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const monthlyCapacityHours = member.weeklyHours * 4;
  const loggedHours = loggedMinutes / 60;
  const utilization = monthlyCapacityHours ? Math.round((loggedHours / monthlyCapacityHours) * 100) : 0;

  return {
    loggedMinutes,
    utilization,
    remainingHours: monthlyCapacityHours - loggedHours,
  };
}

export default function WorkloadPage() {
  const { data: members, isLoading: membersLoading } = useList<Member>('members');
  const { data: projects, isLoading: projectsLoading } = useList<Project>('projects');
  const { data: comments, isLoading: commentsLoading } = useList<Comment>('comments');
  const { data: entries, isLoading: entriesLoading } = useList<TimeEntry>('timeEntries');
  const createComment = useCreate<Comment>('comments');
  const createEntry = useCreate<TimeEntry>('timeEntries');
  const member = useAuth((state) => state.member);
  const timer = useTimer();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState('');
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => forceTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  const isLoading = membersLoading || projectsLoading || commentsLoading || entriesLoading;
  const activeProjects = useMemo(
    () =>
      (projects ?? []).filter((project) =>
        ['planned', 'active', 'waiting_client', 'review', 'paused'].includes(project.status),
      ),
    [projects],
  );
  const selectedProjectId = params.get('project') ?? activeProjects[0]?.id ?? null;
  const selectedProject = activeProjects.find((project) => project.id === selectedProjectId) ?? null;
  const projectComments = useMemo(
    () =>
      (comments ?? [])
        .filter((comment) => comment.entityType === 'project' && comment.entityId === selectedProjectId)
        .sort((left, right) => (left.createdAt < right.createdAt ? -1 : 1)),
    [comments, selectedProjectId],
  );
  const internalTeam = (members ?? []).filter((teamMember) => teamMember.role !== 'client');
  const commentAuthors = new Map(internalTeam.map((teamMember) => [teamMember.id, teamMember]));
  const workloadRows = internalTeam
    .map((teamMember) => ({
      member: teamMember,
      metrics: workloadFor(teamMember, entries ?? []),
    }))
    .sort((left, right) => right.metrics.utilization - left.metrics.utilization)
    .slice(0, 5);

  const selectProject = (projectId: string) => {
    const next = new URLSearchParams(params);
    next.set('project', projectId);
    setParams(next, { replace: true });
  };

  const publishUpdate = async () => {
    if (!member || !selectedProject || !draft.trim()) return;
    await createComment.mutateAsync({
      entityType: 'project',
      entityId: selectedProject.id,
      authorId: member.id,
      content: draft.trim(),
      visibility: 'internal',
      edited: false,
    });
    setDraft('');
    toast.success('Aggiornamento pubblicato');
  };

  const startTimer = () => {
    if (!member || !selectedProject) return;
    timer.start({
      memberId: member.id,
      projectId: selectedProject.id,
      description: draft.trim() || `Aggiornamento ${selectedProject.name}`,
    });
    toast.success('Timer avviato nel Hub');
  };

  const stopTimer = async () => {
    if (!member) return;
    const elapsedMs = timer.elapsedMs();
    const minutes = Math.max(1, Math.round(elapsedMs / 60000));
    await createEntry.mutateAsync({
      memberId: member.id,
      projectId: timer.projectId,
      taskId: timer.taskId,
      description: timer.description || 'Sessione di lavoro',
      date: todayISO(),
      startedAt: new Date(Date.now() - elapsedMs).toISOString(),
      durationMinutes: minutes,
      billable: true,
      hourlyRate: member.clientRate,
      internalCost: member.internalRate,
      approved: false,
      running: false,
    });
    timer.reset();
    toast.success(`Registrati ${minutes} minuti`);
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hub"
        description="Canali progetto, aggiornamenti interni e timer contestualizzato nello stesso spazio."
        actions={
          selectedProject ? (
            <Button variant="secondary" onClick={() => selectProject(selectedProject.id)}>
              <Hash className="h-4 w-4" /> #{selectedProject.code.toLowerCase()}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Canali progetto</p>
            <p className="text-xs text-fg-subtle">Ogni progetto diventa il suo contesto interno operativo.</p>
          </div>
          <div className="divide-y divide-border">
            {activeProjects.map((project) => {
              const count = (comments ?? []).filter(
                (comment) => comment.entityType === 'project' && comment.entityId === project.id,
              ).length;
              return (
                <button
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  className={cn(
                    'flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-2',
                    selectedProjectId === project.id && 'bg-surface-2',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">#{project.code.toLowerCase()}</p>
                    <p className="truncate text-xs text-fg-subtle">{project.name}</p>
                  </div>
                  <Badge tone="neutral">{count}</Badge>
                </button>
              );
            })}
            {activeProjects.length === 0 && (
              <div className="px-4 py-6 text-sm text-fg-subtle">Nessun progetto attivo disponibile nel Hub.</div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">
                  {selectedProject ? `#${selectedProject.code.toLowerCase()}` : 'Seleziona un progetto'}
                </p>
                <p className="text-xs text-fg-subtle">
                  {selectedProject ? selectedProject.name : 'Il canale mostrerà aggiornamenti e note interne del progetto.'}
                </p>
              </div>
              {selectedProject && (
                <Link to={`/projects/${selectedProject.id}`} className="text-sm text-info hover:underline">
                  Apri progetto
                </Link>
              )}
            </div>

            {!selectedProject ? (
              <EmptyState title="Nessun canale selezionato" description="Scegli un progetto dalla colonna sinistra per entrare nel suo contesto interno." />
            ) : (
              <div className="space-y-4 p-4">
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {projectComments.map((comment) => {
                    const author = comment.authorId ? commentAuthors.get(comment.authorId) : undefined;
                    return (
                      <div key={comment.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={author ? `${author.firstName} ${author.lastName}` : 'Sistema'}
                            color={author?.avatarColor}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {author ? `${author.firstName} ${author.lastName}` : 'Sistema'}
                            </p>
                            <p className="text-xs text-fg-subtle">{formatRelative(comment.createdAt)}</p>
                          </div>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-fg-subtle">{comment.content}</p>
                      </div>
                    );
                  })}
                  {projectComments.length === 0 && (
                    <EmptyState
                      title="Canale vuoto"
                      description="Usa questo spazio per note rapide, aggiornamenti operativi e passaggi di consegna interni."
                    />
                  )}
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="min-h-28 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-border-strong"
                    placeholder={selectedProject ? `Scrivi un aggiornamento per ${selectedProject.name}…` : 'Scrivi un aggiornamento…'}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-fg-subtle">
                      I messaggi restano interni e collegati al progetto.
                    </p>
                    <Button onClick={publishUpdate} loading={createComment.isPending} disabled={!selectedProject || !draft.trim()}>
                      <Send className="h-4 w-4" /> Pubblica
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm font-semibold">Timer integrato</p>
            <p className="mt-1 text-sm text-fg-subtle">
              {timer.projectId
                ? `Stai tracciando ${activeProjects.find((project) => project.id === timer.projectId)?.name ?? 'un progetto'}`
                : selectedProject
                  ? `Pronto su ${selectedProject.name}`
                  : 'Seleziona un progetto per avviare il timer.'}
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-surface-2 px-4 py-5 text-center">
              <p className="font-mono text-2xl font-semibold tabular-nums">{timerLabel(timer.elapsedMs())}</p>
              <p className="mt-2 text-xs text-fg-subtle">{timer.description || 'Sessione di lavoro interna'}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!timer.running && timer.accumulated === 0 && (
                <Button onClick={startTimer} disabled={!selectedProject}>
                  <Play className="h-4 w-4" /> Avvia
                </Button>
              )}
              {timer.running && (
                <Button variant="secondary" onClick={() => timer.pause()}>
                  <Pause className="h-4 w-4" /> Pausa
                </Button>
              )}
              {!timer.running && timer.accumulated > 0 && (
                <Button variant="secondary" onClick={() => timer.resume()}>
                  <Play className="h-4 w-4" /> Riprendi
                </Button>
              )}
              {(timer.running || timer.accumulated > 0) && (
                <Button variant="ghost" onClick={stopTimer} loading={createEntry.isPending}>
                  <Square className="h-4 w-4" /> Registra
                </Button>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Carico team</p>
              <p className="text-xs text-fg-subtle">La percentuale numerica non viene più bloccata a 100%.</p>
            </div>
            <div className="divide-y divide-border">
              {workloadRows.map(({ member: teamMember, metrics }) => {
                const width = Math.min(Math.max(metrics.utilization, 0), 140);
                return (
                  <div key={teamMember.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={`${teamMember.firstName} ${teamMember.lastName}`}
                          color={teamMember.avatarColor}
                          size="sm"
                        />
                        <div>
                          <p className="text-sm font-medium">{teamMember.firstName} {teamMember.lastName}</p>
                          <p className="text-xs text-fg-subtle">{formatHours(metrics.loggedMinutes)} nel mese</p>
                        </div>
                      </div>
                      <span className={cn('text-sm font-medium', metrics.utilization > 100 ? 'text-danger' : 'text-fg')}>
                        {metrics.utilization}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          metrics.utilization > 100 ? 'bg-danger' : metrics.utilization >= 60 ? 'bg-warning' : 'bg-accent',
                        )}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-fg-subtle">
                      {metrics.remainingHours >= 0 ? `${metrics.remainingHours.toFixed(1)}h residue` : `${Math.abs(metrics.remainingHours).toFixed(1)}h oltre capacita`}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

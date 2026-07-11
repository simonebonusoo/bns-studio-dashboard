import { useMemo, useState } from 'react';
import {
  Trash2, Copy, Plus, X, Check, MessageSquare, Paperclip, ListChecks,
} from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useDetail, useList, useUpdate, useCreate, useRemove } from '@/hooks/useEntities';
import { recalcProjectProgress } from '@/services/projectService';
import { useAuth } from '@/stores/auth';
import { uid } from '@/lib/id';
import { formatHours, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Task, Project, Member, Milestone, TimeEntry, Comment } from '@/types';
import { toast } from 'sonner';

const STATUS_OPTIONS: { value: Task['status']; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Da fare' },
  { value: 'in_progress', label: 'In corso' },
  { value: 'internal_review', label: 'Revisione interna' },
  { value: 'client_review', label: 'Revisione cliente' },
  { value: 'blocked', label: 'Bloccato' },
  { value: 'completed', label: 'Completato' },
];

export function TaskDetailDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { data: task } = useDetail<Task>('tasks', taskId ?? undefined);
  const { data: projects } = useList<Project>('projects');
  const { data: members } = useList<Member>('members');
  const { data: milestones } = useList<Milestone>('milestones');
  const { data: entries } = useList<TimeEntry>('timeEntries');
  const { data: allTasks } = useList<Task>('tasks');
  const { data: comments } = useList<Comment>('comments');
  const update = useUpdate<Task>('tasks');
  const createTask = useCreate<Task>('tasks');
  const removeTask = useRemove('tasks');
  const createComment = useCreate<Comment>('comments');
  const memberId = useAuth((s) => s.memberId);

  const [confirmDel, setConfirmDel] = useState(false);
  const [checkText, setCheckText] = useState('');
  const [subText, setSubText] = useState('');
  const [commentText, setCommentText] = useState('');

  const team = (members ?? []).filter((m) => m.role !== 'client');
  const loggedMin = useMemo(
    () => (entries ?? []).filter((e) => e.taskId === taskId && !e.running).reduce((s, e) => s + e.durationMinutes, 0),
    [entries, taskId],
  );
  const subtasks = (allTasks ?? []).filter((t) => t.parentTaskId === taskId);
  const taskComments = (comments ?? [])
    .filter((c) => c.entityType === 'task' && c.entityId === taskId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (!task) return null;

  const patch = async (p: Partial<Task>) => {
    await update.mutateAsync({ id: task.id, patch: p });
    if (task.projectId) await recalcProjectProgress(task.projectId);
  };

  const toggleAssignee = (id: string) => {
    const has = task.assigneeIds.includes(id);
    patch({ assigneeIds: has ? task.assigneeIds.filter((x) => x !== id) : [...task.assigneeIds, id] });
  };

  const checklist = task.checklist ?? [];
  const addCheck = () => {
    if (!checkText.trim()) return;
    patch({ checklist: [...checklist, { id: uid(), text: checkText.trim(), done: false }] });
    setCheckText('');
  };
  const toggleCheck = (id: string) =>
    patch({ checklist: checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) });
  const removeCheck = (id: string) => patch({ checklist: checklist.filter((c) => c.id !== id) });

  const addSubtask = async () => {
    if (!subText.trim()) return;
    await createTask.mutateAsync({
      projectId: task.projectId,
      parentTaskId: task.id,
      title: subText.trim(),
      status: 'todo',
      priority: 'medium',
      assigneeIds: [],
      clientVisible: false,
      order: Date.now(),
      tags: [],
    });
    setSubText('');
  };
  const toggleSubtask = (st: Task) =>
    update.mutate({ id: st.id, patch: { status: st.status === 'completed' ? 'todo' : 'completed' } });

  const addComment = async () => {
    if (!commentText.trim() || !memberId) return;
    await createComment.mutateAsync({
      entityType: 'task',
      entityId: task.id,
      authorId: memberId,
      content: commentText.trim(),
      visibility: 'internal',
      edited: false,
    });
    setCommentText('');
  };

  const duplicate = async () => {
    await createTask.mutateAsync({
      ...task,
      id: uid(),
      title: `${task.title} (copia)`,
      status: 'todo',
      completedAt: null,
      order: Date.now(),
    });
    toast.success('Task duplicato');
    onClose();
  };

  const del = async () => {
    await removeTask.mutateAsync(task.id);
    if (task.projectId) await recalcProjectProgress(task.projectId);
    toast.success('Task eliminato');
    onClose();
  };

  const memberName = (id: string) => {
    const m = team.find((x) => x.id === id);
    return m ? `${m.firstName} ${m.lastName}` : '—';
  };
  const doneChecks = checklist.filter((c) => c.done).length;

  return (
    <>
      <Drawer
        open={!!taskId}
        onClose={onClose}
        width="lg"
        title={
          <input
            defaultValue={task.title}
            onBlur={(e) => e.target.value !== task.title && patch({ title: e.target.value })}
            className="w-full bg-transparent text-base font-semibold outline-none focus:bg-surface-2 rounded px-1 -mx-1"
          />
        }
        subtitle={(projects ?? []).find((p) => p.id === task.projectId)?.name}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>
              <Trash2 className="h-4 w-4 text-danger" /> Elimina
            </Button>
            <Button variant="secondary" size="sm" onClick={duplicate}>
              <Copy className="h-4 w-4" /> Duplica
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Campi principali in griglia */}
          <div className="grid grid-cols-2 gap-3">
            <L label="Stato">
              <Select value={task.status} onChange={(e) => patch({ status: e.target.value as Task['status'], completedAt: e.target.value === 'completed' ? new Date().toISOString() : null })}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </L>
            <L label="Priorità">
              <Select value={task.priority} onChange={(e) => patch({ priority: e.target.value as Task['priority'] })}>
                <option value="low">Bassa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </Select>
            </L>
            <L label="Progetto">
              <Select value={task.projectId} onChange={(e) => patch({ projectId: e.target.value })}>
                {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </L>
            <L label="Milestone">
              <Select value={task.milestoneId ?? ''} onChange={(e) => patch({ milestoneId: e.target.value || null })}>
                <option value="">—</option>
                {(milestones ?? []).filter((m) => m.projectId === task.projectId).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </Select>
            </L>
            <L label="Inizio">
              <Input type="date" defaultValue={task.startDate?.slice(0, 10)} onChange={(e) => patch({ startDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </L>
            <L label="Scadenza">
              <Input type="date" defaultValue={task.dueDate?.slice(0, 10)} onChange={(e) => patch({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </L>
            <L label="Stima ore">
              <Input type="number" defaultValue={task.estimatedHours} onBlur={(e) => patch({ estimatedHours: Number(e.target.value) })} />
            </L>
            <L label="Ore registrate">
              <div className="flex h-9 items-center rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg-subtle">{formatHours(loggedMin)}</div>
            </L>
          </div>

          <L label="Descrizione">
            <Textarea defaultValue={task.description} onBlur={(e) => e.target.value !== (task.description ?? '') && patch({ description: e.target.value })} placeholder="Aggiungi una descrizione…" />
          </L>

          {/* Assegnatari */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-subtle">Assegnatari</p>
            <div className="flex flex-wrap gap-1.5">
              {team.map((m) => {
                const active = task.assigneeIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleAssignee(m.id)}
                    className={cn('flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors', active ? 'border-accent/40 bg-accent/10 text-fg' : 'border-border text-fg-subtle hover:bg-surface-2')}
                  >
                    <Avatar name={`${m.firstName} ${m.lastName}`} color={m.avatarColor} size="xs" />
                    {m.firstName}
                    {active && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checklist */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
              <ListChecks className="h-3.5 w-3.5" /> Checklist {checklist.length > 0 && <span>· {doneChecks}/{checklist.length}</span>}
            </p>
            <div className="space-y-1">
              {checklist.map((c) => (
                <div key={c.id} className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-surface-2">
                  <button onClick={() => toggleCheck(c.id)} className={cn('flex h-4 w-4 items-center justify-center rounded border', c.done ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
                    {c.done && <Check className="h-3 w-3" />}
                  </button>
                  <span className={cn('flex-1 text-sm', c.done && 'text-fg-faint line-through')}>{c.text}</span>
                  <button onClick={() => removeCheck(c.id)} className="opacity-0 group-hover:opacity-100"><X className="h-3.5 w-3.5 text-fg-faint" /></button>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2">
              <Input value={checkText} onChange={(e) => setCheckText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCheck()} placeholder="Aggiungi voce…" className="h-8" />
              <Button size="sm" variant="secondary" onClick={addCheck}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Sottotask */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-subtle">Sottotask</p>
            <div className="space-y-1">
              {subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2 rounded-md px-1 py-0.5">
                  <button onClick={() => toggleSubtask(st)} className={cn('flex h-4 w-4 items-center justify-center rounded border', st.status === 'completed' ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
                    {st.status === 'completed' && <Check className="h-3 w-3" />}
                  </button>
                  <span className={cn('flex-1 text-sm', st.status === 'completed' && 'text-fg-faint line-through')}>{st.title}</span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2">
              <Input value={subText} onChange={(e) => setSubText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubtask()} placeholder="Aggiungi sottotask…" className="h-8" />
              <Button size="sm" variant="secondary" onClick={addSubtask}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Visibilità cliente */}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={task.clientVisible} onChange={(e) => patch({ clientVisible: e.target.checked })} className="accent-accent" />
            Visibile al cliente nel portale
          </label>

          {/* Commenti */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-subtle"><MessageSquare className="h-3.5 w-3.5" /> Commenti ({taskComments.length})</p>
            <div className="space-y-2">
              {taskComments.map((c) => (
                <div key={c.id} className="rounded-lg bg-surface-2 p-2.5 text-sm">
                  <div className="mb-0.5 flex items-center gap-2 text-xs text-fg-subtle">
                    <span className="font-medium text-fg">{memberName(c.authorId)}</span>
                    <span>{formatRelative(c.createdAt)}</span>
                  </div>
                  {c.content}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addComment()} placeholder="Scrivi un commento…" />
              <Button size="sm" onClick={addComment}>Invia</Button>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-fg-faint"><Paperclip className="h-3.5 w-3.5" /> Allegati: gestibili dal File Manager collegando al task.</p>
        </div>
      </Drawer>

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del} title="Elimina task" message={`Eliminare "${task.title}"? L'azione è reversibile dai dati demo.`} confirmLabel="Elimina" danger />
    </>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-fg-subtle">{label}</span>
      {children}
    </label>
  );
}

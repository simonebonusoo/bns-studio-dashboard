import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, LayoutGrid, List, Pencil, Archive, Trash2, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { ProjectFormModal } from './ProjectFormModal';
import { useHardDelete, useList, useUpdate } from '@/hooks/useEntities';
import { formatCurrency, formatDate, daysUntil } from '@/lib/format';
import { getProjectDeleteSafety, hasBlockingDependencies } from '@/services/deleteSafety';
import { useAuth } from '@/stores/auth';
import type { Project, Milestone, TimeEntry, Invoice, Payment, Contract, FileItem, CalendarEvent, Transaction } from '@/types';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const { data: projects, isLoading } = useList<Project>('projects');
  const { data: milestones } = useList<Milestone>('milestones');
  const { data: timeEntries } = useList<TimeEntry>('timeEntries');
  const { data: invoices } = useList<Invoice>('invoices');
  const { data: payments } = useList<Payment>('payments');
  const { data: contracts } = useList<Contract>('contracts');
  const { data: files } = useList<FileItem>('files');
  const { data: events } = useList<CalendarEvent>('events');
  const { data: transactions } = useList<Transaction>('transactions');
  const navigate = useNavigate();
  const can = useAuth((state) => state.can);
  const update = useUpdate<Project>('projects');
  const hardDelete = useHardDelete('projects');
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<Project | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(
    () =>
      (projects ?? []).filter((p) => {
        const mq = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase());
        const ms = status === 'all' || p.status === status;
        return mq && ms;
      }),
    [projects, q, status],
  );

  const close = () => {
    setOpen(false);
    setEditing(null);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };
  const deleteSafety = useMemo(
    () =>
      deleteTarget
        ? getProjectDeleteSafety({
            project: deleteTarget,
            milestones: milestones ?? [],
            timeEntries: timeEntries ?? [],
            invoices: invoices ?? [],
            payments: payments ?? [],
            contracts: contracts ?? [],
            files: files ?? [],
            events: events ?? [],
            transactions: transactions ?? [],
          })
        : null,
    [contracts, deleteTarget, events, files, invoices, milestones, payments, timeEntries, transactions],
  );
  const blockedDelete = deleteSafety ? hasBlockingDependencies(deleteSafety) : false;

  const archiveProject = async () => {
    if (!archiveTarget) return;
    await update.mutateAsync({ id: archiveTarget.id, patch: { status: 'archived' } });
    toast.success('Progetto archiviato');
    setArchiveTarget(null);
  };

  const deleteProject = async () => {
    if (!deleteTarget || blockedDelete) return;
    await hardDelete.mutateAsync(deleteTarget.id);
    toast.success('Progetto eliminato definitivamente');
    setDeleteTarget(null);
  };

  const actionItems = (project: Project) => [
    { label: 'Apri dettaglio', icon: ExternalLink, onClick: () => navigate(`/projects/${project.id}`) },
    ...(can('projects.write')
      ? [
          {
            label: 'Modifica',
            icon: Pencil,
            onClick: () => {
              setEditing(project);
              setOpen(true);
            },
          },
        ]
      : []),
    ...(can('projects.archive')
      ? [
          {
            label: 'Archivia',
            icon: Archive,
            separatorBefore: true,
            onClick: () => setArchiveTarget(project),
          },
          {
            label: 'Elimina definitivamente',
            icon: Trash2,
            danger: true,
            onClick: () => setDeleteTarget(project),
          },
        ]
      : []),
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Progetti"
        description={`${filtered.length} progetti`}
        actions={can('projects.write') ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo progetto</Button> : undefined}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca progetti…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
          <option value="all">Tutti gli stati</option>
          <option value="active">Attivi</option>
          <option value="planned">Pianificati</option>
          <option value="review">In revisione</option>
          <option value="paused">In pausa</option>
          <option value="completed">Completati</option>
        </Select>
        <div className="flex rounded-lg border border-border">
          <button onClick={() => setView('grid')} className={`px-3 ${view === 'grid' ? 'text-fg' : 'text-fg-subtle'}`} aria-label="Griglia"><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setView('list')} className={`px-3 ${view === 'list' ? 'text-fg' : 'text-fg-subtle'}`} aria-label="Lista"><List className="h-4 w-4" /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nessun progetto" description="Crea il primo progetto per iniziare." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo progetto</Button>} />
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const d = daysUntil(p.dueDate);
            return (
              <Card key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="h-full cursor-pointer p-4 transition-shadow hover:shadow-pop">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-xs text-fg-subtle">{p.code}</span>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {can('projects.write') || can('projects.archive') ? (
                    <div onClick={(event) => event.stopPropagation()}>
                      <ActionMenu items={actionItems(p)} />
                    </div>
                  ) : null}
                </div>
                <h3 className="mt-2 font-semibold leading-snug">{p.name}</h3>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-fg-subtle">
                    <span>Avanzamento</span>
                    <span>{p.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-semibold">{formatCurrency(p.contractValue)}</span>
                  <span className={d !== null && d < 0 && p.status !== 'completed' ? 'text-danger' : 'text-fg-subtle'}>
                    {formatDate(p.dueDate)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((p) => (
            <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-surface-2">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-fg-subtle">{p.code} · {p.progress}%</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold">{formatCurrency(p.contractValue)}</span>
                <StatusBadge status={p.status} />
                {can('projects.write') || can('projects.archive') ? (
                  <div onClick={(event) => event.stopPropagation()}>
                    <ActionMenu items={actionItems(p)} />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}

      <ProjectFormModal open={open} onClose={close} project={editing ?? undefined} />
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={archiveProject}
        title={`Archiviare ${archiveTarget?.name ?? 'questo progetto'}?`}
        message="Il progetto resterà nello storico ma uscirà dai flussi operativi attivi."
        confirmLabel="Archivia progetto"
        danger
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={blockedDelete ? () => {} : deleteProject}
        title={blockedDelete ? 'Eliminazione non disponibile' : `Eliminare definitivamente ${deleteTarget?.name ?? 'questo progetto'}?`}
        message={
          blockedDelete && deleteSafety ? (
            <div className="space-y-2">
              <p>Non puoi eliminare definitivamente questo progetto perché è collegato a:</p>
              <ul className="list-disc space-y-1 pl-5">
                {deleteSafety.dependencies.map((item) => (
                  <li key={item.label}>
                    {item.count} {item.label}
                    {item.count > 1 ? 'i' : ''}
                  </li>
                ))}
              </ul>
              <p>Puoi archiviarlo oppure rimuovere prima i record collegati.</p>
            </div>
          ) : (
            'Questa azione non può essere annullata.'
          )
        }
        confirmLabel={blockedDelete ? 'Chiudi' : 'Elimina definitivamente'}
        danger={!blockedDelete}
        requireText={blockedDelete ? undefined : 'ELIMINA'}
      />
    </div>
  );
}

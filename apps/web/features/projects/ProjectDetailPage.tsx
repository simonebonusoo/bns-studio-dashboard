import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive, Trash2, FolderOpen, FileText, Receipt, MessagesSquare, PlayCircle, Globe, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDetail, useHardDelete, useList, useUpdate } from '@/hooks/useEntities';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ProjectFormModal } from './ProjectFormModal';
import { projectProfitability } from '@/lib/finance';
import { formatCurrency, formatDate, formatPercent, formatHours } from '@/lib/format';
import { getProjectDeleteSafety, hasBlockingDependencies } from '@/services/deleteSafety';
import { openExternalUrl } from '@/services/externalUrl';
import { useAuth } from '@/stores/auth';
import type { CalendarEvent, Client, Comment, Contract, FileItem, Invoice, Milestone, Payment, Project, TimeEntry, Transaction } from '@/types';
import { toast } from 'sonner';

type Tab = 'overview' | 'milestones' | 'activity';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useAuth((state) => state.can);
  const { data: project, isLoading } = useDetail<Project>('projects', id);
  const { data: milestones } = useList<Milestone>('milestones');
  const { data: entries } = useList<TimeEntry>('timeEntries');
  const { data: clients } = useList<Client>('clients');
  const { data: invoices } = useList<Invoice>('invoices');
  const { data: payments } = useList<Payment>('payments');
  const { data: contracts } = useList<Contract>('contracts');
  const { data: files } = useList<FileItem>('files');
  const { data: events } = useList<CalendarEvent>('events');
  const { data: transactions } = useList<Transaction>('transactions');
  const { data: comments } = useList<Comment>('comments');
  const update = useUpdate<Project>('projects');
  const hardDelete = useHardDelete('projects');
  const [tab, setTab] = useState<Tab>('overview');
  const [edit, setEdit] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const projectMilestones = useMemo(
    () => (milestones ?? []).filter((milestone) => milestone.projectId === id).sort((left, right) => left.order - right.order),
    [milestones, id],
  );
  const projectEntries = useMemo(
    () => (entries ?? []).filter((entry) => entry.projectId === id && !entry.running).sort((left, right) => (left.date < right.date ? 1 : -1)),
    [entries, id],
  );

  if (isLoading) return <LoadingState />;
  if (!project) return <ErrorState message="Progetto non trovato" />;

  const client = (clients ?? []).find((item) => item.id === project.clientId);
  const profitability = projectProfitability(project, entries ?? []);
  const showFinance = can('finances.read');
  const completedMilestones = projectMilestones.filter((milestone) => milestone.status === 'completed').length;
  const projectInvoices = (invoices ?? []).filter((invoice) => invoice.projectId === project.id);
  const projectContracts = (contracts ?? []).filter((contract) => contract.projectId === project.id);
  const projectFiles = (files ?? []).filter((file) => file.projectId === project.id);
  const projectUpdates = (comments ?? []).filter((comment) => comment.entityType === 'project' && comment.entityId === project.id);
  const projectWebsite = project.websiteUrl?.trim() || '';
  const projectWebsiteDomain = readableDomain(projectWebsite);
  const deleteSafety = getProjectDeleteSafety({
    project,
    milestones: milestones ?? [],
    timeEntries: entries ?? [],
    invoices: invoices ?? [],
    payments: payments ?? [],
    contracts: contracts ?? [],
    files: files ?? [],
    events: events ?? [],
    transactions: transactions ?? [],
  });
  const blockedDelete = hasBlockingDependencies(deleteSafety);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Panoramica' },
    { key: 'milestones', label: `Milestone (${projectMilestones.length})` },
    { key: 'activity', label: `Ore registrate (${projectEntries.length})` },
  ];

  const archiveProject = async () => {
    await update.mutateAsync({ id: project.id, patch: { status: 'archived' } });
    toast.success('Progetto archiviato');
    setArchiveOpen(false);
  };

  const deleteProject = async () => {
    if (blockedDelete) return;
    await hardDelete.mutateAsync(project.id);
    toast.success('Progetto eliminato definitivamente');
    navigate('/projects');
  };

  const invoiceAction = (() => {
    if (projectInvoices.length === 0) {
      const next = new URLSearchParams({ new: '1', projectId: project.id });
      if (project.clientId) next.set('clientId', project.clientId);
      return {
        label: 'Crea fattura',
        onClick: () => navigate(`/invoices?${next.toString()}`),
      };
    }
    if (projectInvoices.length === 1) {
      return {
        label: 'Visualizza fattura',
        onClick: () => navigate(`/invoices/${projectInvoices[0].id}`),
      };
    }
    return {
      label: 'Visualizza fatture',
      onClick: () => navigate(`/invoices?projectId=${project.id}`),
    };
  })();

  return (
    <div className="space-y-5">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Progetti
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-fg-subtle">
            <span>{project.code}</span>
            {client && (
              <>
                <span>·</span>
                <Link to={`/clients/${client.id}`} className="hover:text-fg">{client.displayName}</Link>
              </>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            <StatusBadge status={project.health} />
            <StatusBadge status={project.priority} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can('projects.write') && (
            <Button variant="secondary" onClick={() => setEdit(true)}>
              <Pencil className="h-4 w-4" /> Modifica
            </Button>
          )}
          {can('projects.archive') && (
            <Button variant="secondary" onClick={() => setArchiveOpen(true)}>
              <Archive className="h-4 w-4" /> Archivia
            </Button>
          )}
          {can('projects.archive') && (
            <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 text-danger" /> Elimina definitivamente
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Avanzamento" value={`${project.progress}%`} hint={`${completedMilestones}/${projectMilestones.length} milestone completate`} />
        <MetricCard label="Ore lavorate" value={`${profitability.loggedHours}h`} hint={`stima ${project.estimatedHours}h`} />
        {showFinance && <MetricCard label="Valore" value={formatCurrency(project.contractValue)} hint={`budget ${formatCurrency(project.budget)}`} />}
        <MetricCard label="Scadenza" value={formatDate(project.dueDate)} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key ? 'border-accent text-fg' : 'border-transparent text-fg-subtle hover:text-fg'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader title="Descrizione" />
              <p className="p-4 text-sm text-fg-subtle">{project.description || 'Nessuna descrizione.'}</p>
            </Card>

            <Card>
              <CardHeader title="Workspace progetto" subtitle="Accessi rapidi al contesto operativo collegato" />
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <WorkspaceAction
                  icon={FolderOpen}
                  title="Archivio progetto"
                  description={`${projectFiles.length} file collegati`}
                  label="Apri archivio"
                  onClick={() => navigate(`/files?projectId=${project.id}`)}
                />
                <WorkspaceAction
                  icon={MessagesSquare}
                  title="Attività interna"
                  description={`${projectUpdates.length} aggiornamenti nel canale progetto`}
                  label="Apri Hub"
                  onClick={() => navigate(`/hub?project=${project.id}`)}
                />
                <WorkspaceAction
                  icon={Receipt}
                  title="Fatture"
                  description={`${projectInvoices.length} collegate a questo progetto`}
                  label={invoiceAction.label}
                  onClick={invoiceAction.onClick}
                />
                <WorkspaceAction
                  icon={FileText}
                  title="Contratti"
                  description={`${projectContracts.length} collegati a questo progetto`}
                  label={projectContracts.length === 1 ? 'Apri contratto' : 'Apri contratti'}
                  onClick={() => navigate(`/contracts?projectId=${project.id}`)}
                />
                <WorkspaceAction
                  icon={PlayCircle}
                  title="Time tracking"
                  description="Apri il timer già contestualizzato sul progetto"
                  label="Apri nel Hub"
                  onClick={() => navigate(`/hub?project=${project.id}`)}
                />
              </div>
            </Card>
          </div>
          <div className="space-y-4">
            {showFinance && (
              <Card>
                <CardHeader title="Redditività" subtitle={profitability.hasEstimates ? undefined : 'Calcolo parziale: costi orari incompleti'} />
                <div className="space-y-2 p-4 text-sm">
                  <Row label="Valore contrattuale" value={formatCurrency(profitability.contractValue)} />
                  <Row label="Costo lavoro" value={formatCurrency(profitability.laborCost)} />
                  <Row label="Margine lordo" value={formatCurrency(profitability.grossMargin)} strong />
                  <Row label="Margine %" value={formatPercent(profitability.marginPct)} />
                  <Row label="Scostamento ore" value={`${profitability.hoursVariance}h`} />
                </div>
              </Card>
            )}
            <Card>
              <CardHeader title="Collegamenti" />
              <div className="space-y-2 p-4 text-sm">
                <Row label="File archivio" value={String(projectFiles.length)} />
                <Row label="Contratti" value={String(projectContracts.length)} />
                <Row label="Fatture" value={String(projectInvoices.length)} />
                <Row label="Aggiornamenti interni" value={String(projectUpdates.length)} />
              </div>
            </Card>
            <ProjectWebsiteCard
              url={projectWebsite}
              domain={projectWebsiteDomain}
              onOpen={() => void openExternalUrl(projectWebsite)}
              onAdd={() => setEdit(true)}
            />
          </div>
        </div>
      )}

      {tab === 'milestones' && (
        <Card className="divide-y divide-border">
          {projectMilestones.map((milestone) => (
            <div key={milestone.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{milestone.title}</p>
                <p className="text-xs text-fg-subtle">Scadenza {formatDate(milestone.dueDate)}</p>
              </div>
              <StatusBadge status={milestone.status} />
            </div>
          ))}
          {projectMilestones.length === 0 && <p className="px-4 py-6 text-center text-sm text-fg-subtle">Nessuna milestone</p>}
        </Card>
      )}

      {tab === 'activity' && (
        <Card className="divide-y divide-border">
          {projectEntries.slice(0, 12).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{entry.description || 'Sessione di lavoro'}</p>
                <p className="text-xs text-fg-subtle">{formatDate(entry.date)}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium">{formatHours(entry.durationMinutes)}</p>
                <p className="text-xs text-fg-subtle">{entry.billable ? 'Fatturabile' : 'Non fatturabile'}</p>
              </div>
            </div>
          ))}
          {projectEntries.length === 0 && <p className="px-4 py-6 text-center text-sm text-fg-subtle">Nessuna ora registrata</p>}
        </Card>
      )}

      <ProjectFormModal open={edit} onClose={() => setEdit(false)} project={project} />
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={archiveProject}
        title={`Archiviare "${project.name}"?`}
        message="Il progetto resterà nello storico ma verrà escluso dai flussi operativi attivi."
        confirmLabel="Archivia progetto"
        danger
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={blockedDelete ? () => {} : deleteProject}
        title={blockedDelete ? 'Eliminazione non disponibile' : `Eliminare definitivamente "${project.name}"?`}
        message={
          blockedDelete ? (
            <div className="space-y-2">
              <p>Questo progetto è ancora collegato a:</p>
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-fg-subtle">{label}</span>
      <span className={strong ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}

function readableDomain(url: string) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  }
}

function ProjectWebsiteCard({
  url,
  domain,
  onOpen,
  onAdd,
}: {
  url: string;
  domain: string;
  onOpen: () => void;
  onAdd: () => void;
}) {
  if (url) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group w-full rounded-card border border-border bg-surface text-left shadow-card transition-colors hover:border-border-strong hover:bg-surface-2"
        title={url}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Globe className="h-4 w-4 text-fg-subtle" />
            <h3 className="truncate text-sm font-semibold text-fg">Sito web</h3>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-fg-subtle transition-colors group-hover:text-fg">
            Apri sito <ExternalLink className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="min-w-0 px-5 py-4">
          <p className="truncate text-sm font-medium text-fg">{domain}</p>
          <p className="mt-1 truncate text-xs text-fg-subtle">{url}</p>
        </div>
      </button>
    );
  }

  return (
    <Card>
      <CardHeader title="Sito web" icon={<Globe className="h-4 w-4 text-fg-subtle" />} />
      <div className="space-y-3 p-4">
        <p className="text-sm text-fg-subtle">Nessun sito collegato</p>
        <Button variant="secondary" size="sm" onClick={onAdd}>
          Aggiungi sito
        </Button>
      </div>
    </Card>
  );
}

function WorkspaceAction({
  icon: Icon,
  title,
  description,
  label,
  onClick,
}: {
  icon: typeof FolderOpen;
  title: string;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-surface-2 p-2">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-fg">{title}</p>
          <p className="mt-1 text-sm text-fg-subtle">{description}</p>
          <p className="mt-2 text-xs font-medium text-fg">{label}</p>
        </div>
      </div>
    </button>
  );
}

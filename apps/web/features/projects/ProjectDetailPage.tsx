import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useDetail, useList } from '@/hooks/useEntities';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ProjectFormModal } from './ProjectFormModal';
import { projectProfitability } from '@/lib/finance';
import { formatCurrency, formatDate, formatPercent, formatHours } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import type { Client, Milestone, Project, TimeEntry } from '@/types';

type Tab = 'overview' | 'milestones' | 'activity';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const can = useAuth((state) => state.can);
  const { data: project, isLoading } = useDetail<Project>('projects', id);
  const { data: milestones } = useList<Milestone>('milestones');
  const { data: entries } = useList<TimeEntry>('timeEntries');
  const { data: clients } = useList<Client>('clients');
  const [tab, setTab] = useState<Tab>('overview');
  const [edit, setEdit] = useState(false);

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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Panoramica' },
    { key: 'milestones', label: `Milestone (${projectMilestones.length})` },
    { key: 'activity', label: `Ore registrate (${projectEntries.length})` },
  ];

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
        {can('projects.write') && (
          <Button variant="secondary" onClick={() => setEdit(true)}>
            <Pencil className="h-4 w-4" /> Modifica
          </Button>
        )}
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
          <Card className="lg:col-span-2">
            <CardHeader title="Descrizione" />
            <p className="p-4 text-sm text-fg-subtle">{project.description || 'Nessuna descrizione.'}</p>
          </Card>
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

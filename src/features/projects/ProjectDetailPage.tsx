import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { useDetail, useList } from '@/hooks/useEntities';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { TaskBoard } from '@/features/tasks/TaskBoard';
import { TaskFormModal } from '@/features/tasks/TaskFormModal';
import { ProjectFormModal } from './ProjectFormModal';
import { projectProfitability } from '@/lib/finance';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import type { Project, Task, Milestone, TimeEntry, Client } from '@/types';

type Tab = 'overview' | 'tasks' | 'milestones';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const can = useAuth((s) => s.can);
  const { data: project, isLoading } = useDetail<Project>('projects', id);
  const { data: tasks } = useList<Task>('tasks');
  const { data: milestones } = useList<Milestone>('milestones');
  const { data: entries } = useList<TimeEntry>('timeEntries');
  const { data: clients } = useList<Client>('clients');
  const [tab, setTab] = useState<Tab>('overview');
  const [taskOpen, setTaskOpen] = useState(false);
  const [edit, setEdit] = useState(false);

  const projectTasks = useMemo(() => (tasks ?? []).filter((t) => t.projectId === id), [tasks, id]);
  const projectMilestones = useMemo(
    () => (milestones ?? []).filter((m) => m.projectId === id).sort((a, b) => a.order - b.order),
    [milestones, id],
  );

  if (isLoading) return <LoadingState />;
  if (!project) return <ErrorState message="Progetto non trovato" />;

  const client = (clients ?? []).find((c) => c.id === project.clientId);
  const prof = projectProfitability(project, entries ?? []);
  const showFinance = can('finances.read');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Panoramica' },
    { key: 'tasks', label: `Task (${projectTasks.length})` },
    { key: 'milestones', label: `Milestone (${projectMilestones.length})` },
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
            {client && <><span>·</span><Link to={`/clients/${client.id}`} className="hover:text-fg">{client.displayName}</Link></>}
          </div>
          <h1 className="mt-1 text-2xl font-bold">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            <StatusBadge status={project.health} />
            <StatusBadge status={project.priority} />
          </div>
        </div>
        {can('projects.write') && (
          <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Modifica</Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Avanzamento" value={`${project.progress}%`} hint={`${projectTasks.filter((t) => t.status === 'completed').length}/${projectTasks.length} task`} />
        <MetricCard label="Ore lavorate" value={`${prof.loggedHours}h`} hint={`stima ${project.estimatedHours}h`} />
        {showFinance && <MetricCard label="Valore" value={formatCurrency(project.contractValue)} hint={`budget ${formatCurrency(project.budget)}`} />}
        {showFinance && <MetricCard label="Scadenza" value={formatDate(project.dueDate)} />}
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-accent text-fg' : 'border-transparent text-fg-subtle hover:text-fg'
            }`}
          >
            {t.label}
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
              <CardHeader title="Redditività" subtitle={prof.hasEstimates ? undefined : 'Calcolo parziale: costi orari incompleti'} />
              <div className="space-y-2 p-4 text-sm">
                <Row label="Valore contrattuale" value={formatCurrency(prof.contractValue)} />
                <Row label="Costo lavoro (ore)" value={formatCurrency(prof.laborCost)} />
                <Row label="Margine lordo" value={formatCurrency(prof.grossMargin)} strong />
                <Row label="Margine %" value={formatPercent(prof.marginPct)} />
                <Row label="Scostamento ore" value={`${prof.hoursVariance}h`} />
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setTaskOpen(true)}><Plus className="h-4 w-4" /> Nuovo task</Button>
          </div>
          {projectTasks.length ? <TaskBoard tasks={projectTasks} /> : <p className="py-8 text-center text-sm text-fg-subtle">Nessun task</p>}
        </div>
      )}

      {tab === 'milestones' && (
        <Card className="divide-y divide-border">
          {projectMilestones.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{m.title}</p>
                <p className="text-xs text-fg-subtle">Scadenza {formatDate(m.dueDate)}</p>
              </div>
              <StatusBadge status={m.status} />
            </div>
          ))}
          {projectMilestones.length === 0 && <p className="px-4 py-6 text-center text-sm text-fg-subtle">Nessuna milestone</p>}
        </Card>
      )}

      <TaskFormModal open={taskOpen} onClose={() => setTaskOpen(false)} defaultProjectId={project.id} />
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

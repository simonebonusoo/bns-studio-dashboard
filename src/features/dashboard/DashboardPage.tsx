import { Link, useNavigate } from 'react-router-dom';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/stores/auth';
import { useList } from '@/hooks/useEntities';
import { useTimer } from '@/features/time-tracking/timerStore';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatCurrency, formatDate, formatRelative, daysUntil } from '@/lib/format';
import {
  FolderPlus, UserPlus, Target, ListPlus, FileText, CreditCard, Play, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Project, Task, ActivityLog, Member, Invoice, Payment } from '@/types';
import { invoiceBalance } from '@/lib/finance';

export default function DashboardPage() {
  const { data, isLoading, isError } = useAnalytics();
  const navigate = useNavigate();
  const member = useAuth((s) => s.member);
  const timer = useTimer();
  const { data: projects } = useList<Project>('projects');
  const { data: tasks } = useList<Task>('tasks');
  const { data: logs } = useList<ActivityLog>('activityLogs');
  const { data: members } = useList<Member>('members');
  const { data: invoices } = useList<Invoice>('invoices');
  const { data: payments } = useList<Payment>('payments');

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState />;

  const { summary } = data;
  const openTasks = (tasks ?? []).filter((t) => !t.parentTaskId && t.status !== 'completed' && t.status !== 'cancelled');
  const activeProjects = (projects ?? []).filter((p) => p.status === 'active').sort((a, b) => (a.dueDate ?? '') < (b.dueDate ?? '') ? -1 : 1).slice(0, 5);
  const priorityTasks = openTasks
    .filter((t) => t.priority === 'high' || t.priority === 'urgent')
    .sort((a, b) => (a.dueDate ?? '9') < (b.dueDate ?? '9') ? -1 : 1)
    .slice(0, 5);
  const recentLogs = (logs ?? []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6);
  const memberName = (id?: string) => {
    const m = (members ?? []).find((x) => x.id === id);
    return m ? `${m.firstName} ${m.lastName}` : 'Sistema';
  };

  const dueInvoices = (invoices ?? [])
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft')
    .map((i) => ({ inv: i, bal: invoiceBalance(i, payments ?? []) }))
    .filter((x) => x.bal.balance > 0)
    .sort((a, b) => (a.inv.dueDate ?? '') < (b.inv.dueDate ?? '') ? -1 : 1)
    .slice(0, 4);

  const startTimer = () => {
    if (!member) return;
    if (timer.running || timer.accumulated > 0) { navigate('/time'); return; }
    timer.start({ memberId: member.id, description: 'Sessione di lavoro' });
    toast.success('Timer avviato');
  };

  const QUICK = [
    { label: 'Progetto', icon: FolderPlus, onClick: () => navigate('/projects?new=1') },
    { label: 'Cliente', icon: UserPlus, onClick: () => navigate('/clients?new=1') },
    { label: 'Lead', icon: Target, onClick: () => navigate('/pipeline?new=1') },
    { label: 'Task', icon: ListPlus, onClick: () => navigate('/tasks?new=1') },
    { label: 'Preventivo', icon: FileText, onClick: () => navigate('/estimates?new=1') },
    { label: 'Pagamento', icon: CreditCard, onClick: () => navigate('/payments?new=1') },
    { label: 'Avvia timer', icon: Play, onClick: startTimer },
    { label: 'Carica file', icon: Upload, onClick: () => navigate('/files?upload=1') },
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ciao, {member?.firstName ?? 'BNS'} 👋</h1>
        <p className="mt-1 text-sm text-fg-subtle">Ecco cosa richiede la tua attenzione oggi.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {QUICK.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="press flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-2 py-3.5 text-center text-2xs font-medium text-fg-subtle transition-colors hover:border-border-strong hover:text-fg"
          >
            <a.icon className="h-[18px] w-[18px] text-fg-faint" />
            {a.label}
          </button>
        ))}
      </div>

      {/* 5 metriche operative cliccabili */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Progetti attivi" value={summary.activeProjects} hint={`${summary.atRiskProjects} a rischio`} onClick={() => navigate('/projects')} />
        <MetricCard label="Task da completare" value={openTasks.length} hint={`${summary.overdueTasks} in ritardo`} onClick={() => navigate('/tasks')} />
        <MetricCard label="Pagamenti in attesa" value={formatCurrency(summary.pendingPayments)} hint={`${summary.overdueInvoicesCount} scadute`} onClick={() => navigate('/invoices')} />
        <MetricCard label="Preventivi aperti" value={formatCurrency(summary.openEstimatesValue)} onClick={() => navigate('/estimates')} />
        <MetricCard label="Ore registrate" value={`${summary.loggedHours}h`} onClick={() => navigate('/time')} />
      </div>

      {/* Blocchi operativi */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Progetti attivi" action={<Link to="/projects" className="text-sm text-info hover:underline">Tutti</Link>} />
          <ul className="divide-y divide-border">
            {activeProjects.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2">
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-fg-faint">{p.progress}% · {formatDate(p.dueDate)}</p>
                  </div>
                  <StatusBadge status={p.health} />
                </Link>
              </li>
            ))}
            {activeProjects.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-subtle">Nessun progetto attivo</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Task prioritari" action={<Link to="/tasks" className="text-sm text-info hover:underline">Tutti</Link>} />
          <ul className="divide-y divide-border">
            {priorityTasks.map((t) => {
              const d = daysUntil(t.dueDate);
              return (
                <li key={t.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-fg-faint">{(projects ?? []).find((p) => p.id === t.projectId)?.name}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${d !== null && d < 0 ? 'text-danger' : 'text-fg-subtle'}`}>
                    {d === null ? '—' : d < 0 ? `${Math.abs(d)}g fa` : d === 0 ? 'oggi' : `${d}g`}
                  </span>
                </li>
              );
            })}
            {priorityTasks.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-subtle">Nessun task prioritario</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Attività recenti" />
          <ul className="divide-y divide-border">
            {recentLogs.map((l) => (
              <li key={l.id} className="flex items-center gap-2.5 px-4 py-2.5">
                <Avatar name={memberName(l.actorId)} size="xs" color={(members ?? []).find((m) => m.id === l.actorId)?.avatarColor} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm"><span className="font-medium">{memberName(l.actorId)}</span> <span className="text-fg-subtle">{actionLabel(l.action)} {entityLabel(l.entityType)}</span></p>
                  <p className="text-xs text-fg-faint">{formatRelative(l.createdAt)}</p>
                </div>
              </li>
            ))}
            {recentLogs.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-subtle">Nessuna attività</li>}
          </ul>
        </Card>
      </div>

      {/* Pagamenti da ricevere */}
      {dueInvoices.length > 0 && (
        <Card>
          <CardHeader title="Pagamenti da ricevere" action={<Link to="/invoices" className="text-sm text-info hover:underline">Fatture</Link>} />
          <ul className="divide-y divide-border">
            {dueInvoices.map(({ inv, bal }) => {
              const d = daysUntil(inv.dueDate);
              return (
                <li key={inv.id}>
                  <Link to={`/invoices/${inv.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2">
                    <div>
                      <p className="text-sm font-medium">{inv.number}</p>
                      <p className="text-xs text-fg-faint">Scad. {formatDate(inv.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(bal.balance)}</p>
                      {d !== null && d < 0 && <p className="text-xs text-danger">{Math.abs(d)}g di ritardo</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function actionLabel(a: string): string {
  const map: Record<string, string> = { create: 'ha creato', update: 'ha aggiornato', status_change: 'ha cambiato stato di', assign: 'ha assegnato', file_upload: 'ha caricato in', payment: 'ha registrato un pagamento su', approve: 'ha approvato' };
  return map[a] ?? a;
}
function entityLabel(e: string): string {
  const map: Record<string, string> = { project: 'un progetto', task: 'un task', invoice: 'una fattura', client: 'un cliente', estimate: 'un preventivo', payment: 'un pagamento' };
  return map[e] ?? e;
}

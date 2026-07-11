import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarPlus,
  CreditCard,
  FileText,
  FolderPlus,
  Play,
  Receipt,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useList } from '@/hooks/useEntities';
import { useAuth } from '@/stores/auth';
import { useTimer } from '@/features/time-tracking/timerStore';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatCurrency, formatDate, formatRelative, daysUntil } from '@/lib/format';
import { invoiceBalance } from '@/lib/finance';
import type { ActivityLog, Contract, Estimate, Invoice, Member, Payment, Project } from '@/types';

export default function DashboardPage() {
  const { data, isLoading, isError } = useAnalytics();
  const navigate = useNavigate();
  const member = useAuth((state) => state.member);
  const timer = useTimer();
  const { data: projects } = useList<Project>('projects');
  const { data: logs } = useList<ActivityLog>('activityLogs');
  const { data: members } = useList<Member>('members');
  const { data: invoices } = useList<Invoice>('invoices');
  const { data: payments } = useList<Payment>('payments');
  const { data: estimates } = useList<Estimate>('estimates');
  const { data: contracts } = useList<Contract>('contracts');

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState />;

  const { summary } = data;
  const activeProjects = (projects ?? [])
    .filter((project) => ['active', 'review', 'planned'].includes(project.status))
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1))
    .slice(0, 5);
  const recentLogs = (logs ?? [])
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))
    .slice(0, 6);
  const openEstimates = (estimates ?? []).filter((estimate) =>
    ['draft', 'sent', 'viewed', 'internal_review'].includes(estimate.status),
  );

  const dueInvoices = (invoices ?? [])
    .filter((invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.status !== 'draft')
    .map((invoice) => ({ invoice, balance: invoiceBalance(invoice, payments ?? []) }))
    .filter(({ balance }) => balance.balance > 0)
    .sort((left, right) => (left.invoice.dueDate ?? '').localeCompare(right.invoice.dueDate ?? ''))
    .slice(0, 4);

  const overdueInvoices = dueInvoices.filter(({ invoice }) => invoice.status === 'overdue');

  const upcomingDeadlines = [
    ...(projects ?? [])
      .filter((project) => project.dueDate && !['completed', 'cancelled', 'archived'].includes(project.status))
      .map((project) => ({
        id: `project-${project.id}`,
        title: project.name,
        subtitle: 'Progetto',
        date: project.dueDate ?? '',
        to: `/projects/${project.id}`,
      })),
    ...openEstimates
      .filter((estimate) => estimate.expiryDate)
      .map((estimate) => ({
        id: `estimate-${estimate.id}`,
        title: estimate.number,
        subtitle: 'Scadenza preventivo',
        date: estimate.expiryDate ?? '',
        to: `/estimates/${estimate.id}`,
      })),
    ...(contracts ?? [])
      .filter((contract) => contract.endDate && ['active', 'awaiting_signature'].includes(contract.status))
      .map((contract) => ({
        id: `contract-${contract.id}`,
        title: contract.title,
        subtitle: 'Scadenza contratto',
        date: contract.endDate ?? '',
        to: '/contracts',
      })),
  ]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 6);

  const memberName = (id?: string) => {
    const matched = (members ?? []).find((item) => item.id === id);
    return matched ? `${matched.firstName} ${matched.lastName}` : 'Sistema';
  };

  const startTimer = () => {
    if (!member) return;
    if (timer.running || timer.accumulated > 0) {
      navigate('/time');
      return;
    }
    timer.start({ memberId: member.id, description: 'Sessione di lavoro' });
    toast.success('Timer avviato');
  };

  const quickActions = [
    { label: 'Nuovo cliente', icon: UserPlus, onClick: () => navigate('/clients?new=1') },
    { label: 'Nuovo progetto', icon: FolderPlus, onClick: () => navigate('/projects?new=1') },
    { label: 'Nuovo preventivo', icon: FileText, onClick: () => navigate('/estimates?new=1') },
    { label: 'Nuova fattura', icon: Receipt, onClick: () => navigate('/invoices') },
    { label: 'Registra pagamento', icon: CreditCard, onClick: () => navigate('/payments?new=1') },
    { label: 'Avvia timer', icon: Play, onClick: startTimer },
    { label: 'Carica file', icon: Upload, onClick: () => navigate('/files?upload=1') },
    { label: 'Nuovo evento', icon: CalendarPlus, onClick: () => navigate('/calendar?new=1') },
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ciao, {member?.firstName ?? 'BNS'}</h1>
        <p className="mt-1 text-sm text-fg-subtle">Una home operativa, pulita e centrata su quello che richiede attenzione oggi.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="press flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-2 py-3.5 text-center text-2xs font-medium text-fg-subtle transition-colors hover:border-border-strong hover:text-fg"
          >
            <action.icon className="h-[18px] w-[18px] text-fg-faint" />
            {action.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Progetti attivi" value={summary.activeProjects} hint={`${summary.atRiskProjects} a rischio`} onClick={() => navigate('/projects')} />
        <MetricCard label="Pagamenti in attesa" value={dueInvoices.length} hint={formatCurrency(summary.pendingPayments)} onClick={() => navigate('/payments')} />
        <MetricCard label="Preventivi aperti" value={openEstimates.length} hint={formatCurrency(summary.openEstimatesValue)} onClick={() => navigate('/estimates')} />
        <MetricCard label="Fatture scadute" value={overdueInvoices.length} hint={formatCurrency(summary.overdueInvoicesValue)} onClick={() => navigate('/invoices')} />
        <MetricCard label="Ore registrate" value={`${summary.loggedHours}h`} onClick={() => navigate('/time')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Progetti attivi" action={<Link to="/projects" className="text-sm text-info hover:underline">Tutti</Link>} />
          <ul className="divide-y divide-border">
            {activeProjects.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2">
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-fg-faint">{project.progress}% · {formatDate(project.dueDate)}</p>
                  </div>
                  <StatusBadge status={project.health} />
                </Link>
              </li>
            ))}
            {activeProjects.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-subtle">Nessun progetto attivo</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Prossime scadenze" />
          <ul className="divide-y divide-border">
            {upcomingDeadlines.map((item) => {
              const days = daysUntil(item.date);
              return (
                <li key={item.id}>
                  <Link to={item.to} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2">
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-fg-faint">{item.subtitle} · {formatDate(item.date)}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium ${days !== null && days < 0 ? 'text-danger' : 'text-fg-subtle'}`}>
                      {days === null ? '—' : days < 0 ? `${Math.abs(days)}g fa` : days === 0 ? 'oggi' : `${days}g`}
                    </span>
                  </Link>
                </li>
              );
            })}
            {upcomingDeadlines.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-subtle">Nessuna scadenza imminente</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Attività recenti" />
          <ul className="divide-y divide-border">
            {recentLogs.map((log) => (
              <li key={log.id} className="flex items-center gap-2.5 px-4 py-2.5">
                <Avatar
                  name={memberName(log.actorId)}
                  size="xs"
                  color={(members ?? []).find((item) => item.id === log.actorId)?.avatarColor}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-medium">{memberName(log.actorId)}</span>{' '}
                    <span className="text-fg-subtle">{actionLabel(log.action)} {entityLabel(log.entityType)}</span>
                  </p>
                  <p className="text-xs text-fg-faint">{formatRelative(log.createdAt)}</p>
                </div>
              </li>
            ))}
            {recentLogs.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-subtle">Nessuna attività</li>}
          </ul>
        </Card>
      </div>

      {dueInvoices.length > 0 && (
        <Card>
          <CardHeader title="Pagamenti da ricevere" action={<Link to="/invoices" className="text-sm text-info hover:underline">Fatture</Link>} />
          <ul className="divide-y divide-border">
            {dueInvoices.map(({ invoice, balance }) => {
              const days = daysUntil(invoice.dueDate);
              return (
                <li key={invoice.id}>
                  <Link to={`/invoices/${invoice.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2">
                    <div>
                      <p className="text-sm font-medium">{invoice.number}</p>
                      <p className="text-xs text-fg-faint">Scad. {formatDate(invoice.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(balance.balance)}</p>
                      {days !== null && days < 0 && <p className="text-xs text-danger">{Math.abs(days)}g di ritardo</p>}
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

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    create: 'ha creato',
    update: 'ha aggiornato',
    status_change: 'ha cambiato stato di',
    assign: 'ha assegnato',
    file_upload: 'ha caricato in',
    payment: 'ha registrato un pagamento su',
    approve: 'ha approvato',
  };
  return map[action] ?? action;
}

function entityLabel(entity: string): string {
  const map: Record<string, string> = {
    project: 'un progetto',
    invoice: 'una fattura',
    client: 'un cliente',
    estimate: 'un preventivo',
    payment: 'un pagamento',
    contract: 'un contratto',
    file: 'un file',
  };
  return map[entity] ?? entity;
}

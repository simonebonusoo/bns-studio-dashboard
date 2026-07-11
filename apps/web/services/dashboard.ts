import { documentTotals, invoiceBalance, round2 } from '@/lib/finance';
import { repositories } from '@/services/repository';
import type {
  ActivityLog,
  Contract,
  Estimate,
  Invoice,
  Member,
  Payment,
  Project,
  ProjectStatus,
  TimeEntry,
} from '@/types';

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ['planned', 'active', 'waiting_client', 'review'];
const CLOSED_PROJECT_STATUSES: ProjectStatus[] = ['completed', 'cancelled', 'archived'];
const OPEN_ESTIMATE_STATUSES = ['draft', 'sent', 'viewed'] as const;
const OPEN_INVOICE_STATUSES = ['issued', 'sent', 'viewed', 'partially_paid', 'overdue'] as const;

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function isProjectActive(project: Project) {
  return ACTIVE_PROJECT_STATUSES.includes(project.status);
}

function isProjectClosed(project: Project) {
  return CLOSED_PROJECT_STATUSES.includes(project.status);
}

function isProjectAtRisk(project: Project) {
  if (project.health === 'at_risk' || project.health === 'blocked') return true;
  if (!project.dueDate || isProjectClosed(project)) return false;
  return new Date(project.dueDate).getTime() < startOfToday().getTime();
}

function isEstimateOpen(estimate: Estimate) {
  return OPEN_ESTIMATE_STATUSES.includes(estimate.status as (typeof OPEN_ESTIMATE_STATUSES)[number]);
}

function hasOpenInvoiceStatus(invoice: Invoice) {
  return OPEN_INVOICE_STATUSES.includes(invoice.status as (typeof OPEN_INVOICE_STATUSES)[number]);
}

function estimateTotal(estimate: Estimate) {
  return documentTotals(estimate.items, { globalDiscountPct: estimate.globalDiscountPct }).total;
}

function activityMessage(log: ActivityLog) {
  const actionMap: Record<string, string> = {
    create: 'ha creato',
    update: 'ha aggiornato',
    delete: 'ha eliminato',
    status_change: 'ha cambiato stato di',
    file_upload: 'ha caricato',
    payment: 'ha registrato un pagamento su',
    approve: 'ha approvato',
  };
  const entityMap: Record<string, string> = {
    client: 'un cliente',
    project: 'un progetto',
    service: 'un servizio',
    estimate: 'un preventivo',
    invoice: 'una fattura',
    payment: 'un pagamento',
    contract: 'un contratto',
    file: 'un file',
    event: 'un evento',
    member: 'un membro',
    time_entry: 'un timesheet',
    transaction: 'un movimento',
    markdown_import: 'un import markdown',
  };
  return `${actionMap[log.action] ?? log.action} ${entityMap[log.entityType] ?? 'un elemento'}`.trim();
}

async function loadDashboardData() {
  const [projects, payments, estimates, invoices, contracts, timeEntries, activityLogs, members] = await Promise.all([
    repositories.projects.list() as Promise<Project[]>,
    repositories.payments.list() as Promise<Payment[]>,
    repositories.estimates.list() as Promise<Estimate[]>,
    repositories.invoices.list() as Promise<Invoice[]>,
    repositories.contracts.list() as Promise<Contract[]>,
    repositories.timeEntries.list() as Promise<TimeEntry[]>,
    repositories.activityLogs.list() as Promise<ActivityLog[]>,
    repositories.members.list() as Promise<Member[]>,
  ]);

  return { projects, payments, estimates, invoices, contracts, timeEntries, activityLogs, members };
}

export interface DashboardMetricSummary {
  activeProjects: number;
  atRiskProjects: number;
  pendingPaymentsCount: number;
  pendingPaymentsValue: number;
  openEstimatesCount: number;
  openEstimatesValue: number;
  overdueInvoicesCount: number;
  overdueInvoicesValue: number;
  loggedHours: number;
}

export interface DashboardProjectItem {
  id: string;
  name: string;
  progress: number;
  dueDate?: string | null;
  health: Project['health'];
}

export interface DashboardDeadlineItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  to: string;
}

export interface DashboardActivityItem {
  id: string;
  actorName: string;
  actorColor?: string;
  message: string;
  createdAt: string;
}

export interface DashboardReceivableItem {
  id: string;
  number: string;
  dueDate?: string | null;
  balance: number;
}

export interface DashboardData {
  summary: DashboardMetricSummary;
  activeProjects: DashboardProjectItem[];
  upcomingDeadlines: DashboardDeadlineItem[];
  recentActivity: DashboardActivityItem[];
  receivables: DashboardReceivableItem[];
}

export async function getDashboard(): Promise<DashboardData> {
  const data = await loadDashboardData();
  const memberById = new Map(data.members.map((member) => [member.id, member]));

  const activeProjects = data.projects
    .filter(isProjectActive)
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));

  const pendingPayments = data.payments.filter((payment) => payment.status === 'pending');
  const openEstimates = data.estimates.filter(isEstimateOpen);

  const receivables = data.invoices
    .filter((invoice) => hasOpenInvoiceStatus(invoice))
    .map((invoice) => ({
      invoice,
      balance: invoiceBalance(invoice, data.payments),
    }))
    .filter(({ balance }) => balance.balance > 0)
    .sort((left, right) => (left.invoice.dueDate ?? '9999-12-31').localeCompare(right.invoice.dueDate ?? '9999-12-31'));

  const overdueReceivables = receivables.filter(({ invoice }) => {
    if (invoice.status === 'overdue') return true;
    if (!invoice.dueDate) return false;
    return new Date(invoice.dueDate).getTime() < startOfToday().getTime();
  });

  const upcomingDeadlines = [
    ...data.projects
      .filter((project) => project.dueDate && !isProjectClosed(project))
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
    ...data.contracts
      .filter((contract) => contract.endDate && ['active', 'awaiting_signature'].includes(contract.status))
      .map((contract) => ({
        id: `contract-${contract.id}`,
        title: contract.title,
        subtitle: 'Scadenza contratto',
        date: contract.endDate ?? '',
        to: '/contracts',
      })),
  ]
    .filter((item) => item.date)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 6);

  const recentActivity = data.activityLogs
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))
    .slice(0, 6)
    .map((log) => {
      const actor = log.actorId ? memberById.get(log.actorId) : undefined;
      return {
        id: log.id,
        actorName: actor ? `${actor.firstName} ${actor.lastName}` : 'Sistema',
        actorColor: actor?.avatarColor,
        message: activityMessage(log),
        createdAt: log.createdAt,
      };
    });

  return {
    summary: {
      activeProjects: activeProjects.length,
      atRiskProjects: data.projects.filter(isProjectAtRisk).length,
      pendingPaymentsCount: pendingPayments.length,
      pendingPaymentsValue: round2(pendingPayments.reduce((sum, payment) => sum + payment.amount, 0)),
      openEstimatesCount: openEstimates.length,
      openEstimatesValue: round2(openEstimates.reduce((sum, estimate) => sum + estimateTotal(estimate), 0)),
      overdueInvoicesCount: overdueReceivables.length,
      overdueInvoicesValue: round2(overdueReceivables.reduce((sum, { balance }) => sum + balance.balance, 0)),
      loggedHours: round2(data.timeEntries.filter((entry) => !entry.running).reduce((sum, entry) => sum + entry.durationMinutes, 0) / 60),
    },
    activeProjects: activeProjects.slice(0, 5).map((project) => ({
      id: project.id,
      name: project.name,
      progress: project.progress,
      dueDate: project.dueDate,
      health: project.health,
    })),
    upcomingDeadlines,
    recentActivity,
    receivables: receivables.slice(0, 4).map(({ invoice, balance }) => ({
      id: invoice.id,
      number: invoice.number,
      dueDate: invoice.dueDate,
      balance: balance.balance,
    })),
  };
}

import { documentTotals, invoiceBalance, round2 } from '@/lib/finance';
import { repositories } from '@/services/repository';
import type { Payment, Project } from '@/types';

async function loadAll() {
  const [projects, invoices, payments, transactions, services, timeEntries, members, estimates] =
    await Promise.all([
      repositories.projects.list(),
      repositories.invoices.list(),
      repositories.payments.list(),
      repositories.transactions.list(),
      repositories.services.list(),
      repositories.timeEntries.list(),
      repositories.members.list(),
      repositories.estimates.list(),
    ]);

  return {
    projects,
    invoices,
    payments,
    transactions,
    services,
    timeEntries,
    members,
    estimates,
  };
}

const monthKey = (value: string) => value.slice(0, 7);

export interface DashboardSummary {
  income: number;
  expenses: number;
  profit: number;
  pendingPayments: number;
  overdueInvoicesValue: number;
  overdueInvoicesCount: number;
  openEstimatesValue: number;
  activeProjects: number;
  atRiskProjects: number;
  loggedHours: number;
  averageUtilization: number;
}

export interface SeriesPoint {
  label: string;
  [key: string]: string | number;
}

export interface Analytics {
  summary: DashboardSummary;
  monthly: SeriesPoint[];
  projectsByStatus: { name: string; value: number; color: string }[];
  revenueByService: { name: string; value: number; color: string }[];
  hoursByProject: { name: string; value: number }[];
  estimatedVsActual: SeriesPoint[];
  teamCapacity: SeriesPoint[];
}

const STATUS_COLORS: Record<string, string> = {
  active: '#b0d62e',
  review: '#9b5de5',
  waiting_client: '#e07b39',
  planned: '#3b76d6',
  completed: '#22a05a',
  paused: '#f24e6b',
  draft: '#a1a1aa',
};

export async function getAnalytics(): Promise<Analytics> {
  const data = await loadAll();

  const completedPayments = data.payments.filter((payment: Payment) => payment.status === 'completed');
  const income = round2(completedPayments.reduce((sum, payment) => sum + payment.amount, 0));
  const expenses = round2(
    data.transactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );

  let pendingPayments = 0;
  let overdueValue = 0;
  let overdueCount = 0;
  for (const invoice of data.invoices) {
    if (invoice.status === 'cancelled' || invoice.status === 'draft') continue;
    const balance = invoiceBalance(invoice, data.payments);
    pendingPayments += balance.balance;
    if (invoice.status === 'overdue') {
      overdueValue += balance.balance;
      overdueCount += 1;
    }
  }

  const openEstimatesValue = round2(
    data.estimates
      .filter((estimate) => ['draft', 'sent', 'viewed', 'internal_review'].includes(estimate.status))
      .reduce((sum, estimate) => sum + documentTotals(estimate.items, { globalDiscountPct: estimate.globalDiscountPct }).total, 0),
  );

  const activeProjects = data.projects.filter((project) => project.status === 'active').length;
  const atRiskProjects = data.projects.filter((project) => project.health === 'at_risk' || project.health === 'blocked').length;
  const loggedHours = round2(
    data.timeEntries.filter((entry) => !entry.running).reduce((sum, entry) => sum + entry.durationMinutes, 0) / 60,
  );

  const memberMinutes = new Map<string, number>();
  data.timeEntries.forEach((entry) => {
    if (entry.running) return;
    memberMinutes.set(entry.memberId, (memberMinutes.get(entry.memberId) ?? 0) + entry.durationMinutes);
  });

  const teamCapacity: SeriesPoint[] = data.members
    .filter((member) => member.role !== 'client')
    .map((member) => ({
      label: member.firstName,
      capacita: round2(member.weeklyHours * 4),
      registrate: round2((memberMinutes.get(member.id) ?? 0) / 60),
    }));

  const averageUtilization = teamCapacity.length
    ? round2(teamCapacity.reduce((sum, item) => sum + (Number(item.capacita) ? (Number(item.registrate) / Number(item.capacita)) * 100 : 0), 0) / teamCapacity.length)
    : 0;

  const months: string[] = [];
  const base = new Date();
  base.setDate(1);
  for (let index = 5; index >= 0; index -= 1) {
    const month = new Date(base.getFullYear(), base.getMonth() - index, 1);
    months.push(month.toISOString().slice(0, 7));
  }

  const monthly: SeriesPoint[] = months.map((month) => {
    const monthIncome = completedPayments
      .filter((payment) => monthKey(payment.date) === month)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const monthExpenses = data.transactions
      .filter((transaction) => transaction.type === 'expense' && monthKey(transaction.date) === month)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const label = new Date(`${month}-01`).toLocaleDateString('it-IT', { month: 'short' });
    return {
      label,
      ricavi: round2(monthIncome),
      costi: round2(monthExpenses),
      utile: round2(monthIncome - monthExpenses),
    };
  });

  const statusCount = new Map<string, number>();
  data.projects.forEach((project) => {
    statusCount.set(project.status, (statusCount.get(project.status) ?? 0) + 1);
  });

  const projectsByStatus = [...statusCount.entries()].map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name] ?? '#a1a1aa',
  }));

  const revenueByServiceMap = new Map<string, { value: number; color: string; name: string }>();
  data.projects.forEach((project: Project) => {
    const service = data.services.find((item) => item.id === project.serviceId);
    if (!service) return;
    const current = revenueByServiceMap.get(service.id) ?? {
      value: 0,
      color: service.color,
      name: service.name,
    };
    current.value += project.contractValue;
    revenueByServiceMap.set(service.id, current);
  });

  const revenueByService = [...revenueByServiceMap.values()].sort((left, right) => right.value - left.value);

  const hoursByProjectMap = new Map<string, number>();
  data.timeEntries.forEach((entry) => {
    if (!entry.projectId || entry.running) return;
    hoursByProjectMap.set(entry.projectId, (hoursByProjectMap.get(entry.projectId) ?? 0) + entry.durationMinutes);
  });

  const hoursByProject = [...hoursByProjectMap.entries()]
    .map(([projectId, minutes]) => ({
      name: data.projects.find((project) => project.id === projectId)?.name.slice(0, 28) ?? projectId,
      value: round2(minutes / 60),
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);

  const estimatedVsActual = data.projects
    .filter((project) => project.status === 'active')
    .map((project) => ({
      label: project.name.slice(0, 18),
      stimate: round2(project.estimatedHours),
      effettive: round2((hoursByProjectMap.get(project.id) ?? 0) / 60),
    }))
    .slice(0, 6);

  return {
    summary: {
      income,
      expenses,
      profit: round2(income - expenses),
      pendingPayments: round2(pendingPayments),
      overdueInvoicesValue: round2(overdueValue),
      overdueInvoicesCount: overdueCount,
      openEstimatesValue,
      activeProjects,
      atRiskProjects,
      loggedHours,
      averageUtilization,
    },
    monthly,
    projectsByStatus,
    revenueByService,
    hoursByProject,
    estimatedVsActual,
    teamCapacity,
  };
}

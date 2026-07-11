import { db } from '@/data/db';
import { ORGANIZATION_ID } from '@/data/seed';
import { documentTotals, invoiceBalance, round2 } from '@/lib/finance';
import { STAGE_LABELS } from '@/types/enums';
import type { Payment, Project } from '@/types';

const inOrg = <T extends { organizationId: string; deletedAt?: string | null }>(rows: T[]) =>
  rows.filter((r) => r.organizationId === ORGANIZATION_ID && !r.deletedAt);

async function loadAll() {
  const [projects, invoices, payments, transactions, clients, opportunities, services, timeEntries, tasks, members] =
    await Promise.all([
      db.projects.toArray(),
      db.invoices.toArray(),
      db.payments.toArray(),
      db.transactions.toArray(),
      db.clients.toArray(),
      db.opportunities.toArray(),
      db.services.toArray(),
      db.timeEntries.toArray(),
      db.tasks.toArray(),
      db.members.toArray(),
    ]);
  return {
    projects: inOrg(projects),
    invoices: inOrg(invoices),
    payments: inOrg(payments),
    transactions: inOrg(transactions),
    clients: inOrg(clients),
    opportunities: inOrg(opportunities),
    services: inOrg(services),
    timeEntries: inOrg(timeEntries),
    tasks: inOrg(tasks),
    members: inOrg(members),
  };
}

const monthKey = (d: string) => d.slice(0, 7); // YYYY-MM

export interface DashboardSummary {
  income: number; // incassato (pagamenti completati)
  expenses: number;
  profit: number;
  pendingPayments: number; // saldo residuo fatture
  overdueInvoicesValue: number;
  overdueInvoicesCount: number;
  openEstimatesValue: number;
  pipelineValue: number;
  weightedPipeline: number;
  activeProjects: number;
  atRiskProjects: number;
  overdueTasks: number;
  loggedHours: number;
}

export interface SeriesPoint {
  label: string;
  [k: string]: string | number;
}

export interface Analytics {
  summary: DashboardSummary;
  monthly: SeriesPoint[]; // ricavi/costi/utile per mese
  cashFlow: SeriesPoint[]; // saldo cumulato per mese
  projectsByStatus: { name: string; value: number; color: string }[];
  revenueByService: { name: string; value: number; color: string }[];
  expensesByCategory: { name: string; value: number }[];
  pipelineByStage: { name: string; value: number }[];
  hoursByProject: { name: string; value: number }[];
  estimatedVsActual: SeriesPoint[]; // ore stimate vs effettive per progetto attivo
  teamCapacity: SeriesPoint[]; // capacità vs ore registrate per membro
  topClients: { name: string; value: number }[];
  conversionRate: number;
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
  const d = await loadAll();

  const completedPayments = d.payments.filter((p: Payment) => p.status === 'completed');
  const income = round2(completedPayments.reduce((s, p) => s + p.amount, 0));
  const expenses = round2(
    d.transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  );

  // saldo residuo fatture non completamente pagate
  let pendingPayments = 0;
  let overdueValue = 0;
  let overdueCount = 0;
  for (const inv of d.invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft') continue;
    const bal = invoiceBalance(inv, d.payments);
    pendingPayments += bal.balance;
    if (inv.status === 'overdue') {
      overdueValue += bal.balance;
      overdueCount += 1;
    }
  }

  const openEstimates = await db.estimates.toArray();
  const openEstimatesValue = inOrg(openEstimates)
    .filter((e) => ['sent', 'viewed', 'draft', 'internal_review'].includes(e.status))
    .reduce((s, e) => s + documentTotals(e.items, { globalDiscountPct: e.globalDiscountPct }).total, 0);

  const openOpps = d.opportunities.filter((o) => !['won', 'lost'].includes(o.stage));
  const pipelineValue = round2(openOpps.reduce((s, o) => s + o.value, 0));
  const weightedPipeline = round2(openOpps.reduce((s, o) => s + (o.value * o.probability) / 100, 0));

  const activeProjects = d.projects.filter((p) => p.status === 'active').length;
  const atRiskProjects = d.projects.filter((p) => p.health === 'at_risk' || p.health === 'blocked').length;

  const nowTs = Date.now();
  const overdueTasks = d.tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate).getTime() < nowTs && t.status !== 'completed' && t.status !== 'cancelled',
  ).length;

  const loggedHours = round2(
    d.timeEntries.filter((e) => !e.running).reduce((s, e) => s + e.durationMinutes, 0) / 60,
  );

  // ─── Serie mensile (ultimi 6 mesi) ───
  const months: string[] = [];
  const base = new Date();
  base.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(base.getFullYear(), base.getMonth() - i, 1);
    months.push(m.toISOString().slice(0, 7));
  }
  const monthly: SeriesPoint[] = months.map((mk) => {
    const inc = completedPayments.filter((p) => monthKey(p.date) === mk).reduce((s, p) => s + p.amount, 0);
    const exp = d.transactions
      .filter((t) => t.type === 'expense' && monthKey(t.date) === mk)
      .reduce((s, t) => s + t.amount, 0);
    const label = new Date(mk + '-01').toLocaleDateString('it-IT', { month: 'short' });
    return { label, ricavi: round2(inc), costi: round2(exp), utile: round2(inc - exp) };
  });

  // ─── Progetti per stato ───
  const statusCount = new Map<string, number>();
  d.projects.forEach((p) => statusCount.set(p.status, (statusCount.get(p.status) ?? 0) + 1));
  const projectsByStatus = [...statusCount.entries()].map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name] ?? '#a1a1aa',
  }));

  // ─── Ricavi per servizio (dai progetti fatturati) ───
  const svcMap = new Map<string, { value: number; color: string; name: string }>();
  d.projects.forEach((p: Project) => {
    const svc = d.services.find((s) => s.id === p.serviceId);
    if (!svc) return;
    const cur = svcMap.get(svc.id) ?? { value: 0, color: svc.color, name: svc.name };
    cur.value += p.contractValue;
    svcMap.set(svc.id, cur);
  });
  const revenueByService = [...svcMap.values()].sort((a, b) => b.value - a.value);

  // ─── Pipeline per fase ───
  const stageMap = new Map<string, number>();
  openOpps.forEach((o) => stageMap.set(o.stage, (stageMap.get(o.stage) ?? 0) + o.value));
  const pipelineByStage = [...stageMap.entries()].map(([stage, value]) => ({
    name: STAGE_LABELS[stage as keyof typeof STAGE_LABELS] ?? stage,
    value: round2(value),
  }));

  // ─── Ore per progetto ───
  const hoursMap = new Map<string, number>();
  d.timeEntries.forEach((e) => {
    if (!e.projectId || e.running) return;
    hoursMap.set(e.projectId, (hoursMap.get(e.projectId) ?? 0) + e.durationMinutes);
  });
  const hoursByProject = [...hoursMap.entries()]
    .map(([pid, mins]) => ({
      name: d.projects.find((p) => p.id === pid)?.name.slice(0, 22) ?? pid,
      value: round2(mins / 60),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ─── Top clienti per incassato ───
  const clientMap = new Map<string, number>();
  completedPayments.forEach((p) => {
    if (!p.clientId) return;
    clientMap.set(p.clientId, (clientMap.get(p.clientId) ?? 0) + p.amount);
  });
  const topClients = [...clientMap.entries()]
    .map(([cid, value]) => ({
      name: d.clients.find((c) => c.id === cid)?.displayName ?? cid,
      value: round2(value),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const wonCount = d.opportunities.filter((o) => o.stage === 'won').length;
  const closedCount = d.opportunities.filter((o) => o.stage === 'won' || o.stage === 'lost').length;
  const conversionRate = closedCount > 0 ? round2((wonCount / closedCount) * 100) : 0;

  // ─── Cash flow cumulato (mese per mese) ───
  let running = 0;
  const cashFlow: SeriesPoint[] = monthly.map((m) => {
    running += (m.utile as number) ?? 0;
    return { label: m.label, saldo: round2(running) };
  });

  // ─── Uscite per categoria ───
  const expenseMap = new Map<string, number>();
  d.transactions.filter((t) => t.type === 'expense').forEach((t) => {
    expenseMap.set(t.category, (expenseMap.get(t.category) ?? 0) + t.amount);
  });
  const expensesByCategory = [...expenseMap.entries()]
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value);

  // ─── Ore stimate vs effettive (progetti attivi) ───
  const estimatedVsActual: SeriesPoint[] = d.projects
    .filter((p) => p.status === 'active')
    .map((p) => {
      const actual = (hoursMap.get(p.id) ?? 0) / 60;
      return { label: p.name.slice(0, 16), stimate: round2(p.estimatedHours), effettive: round2(actual) };
    })
    .slice(0, 6);

  // ─── Capacità team (mese ~4 settimane) vs ore registrate ───
  const memberMinutes = new Map<string, number>();
  d.timeEntries.forEach((e) => {
    if (e.running) return;
    memberMinutes.set(e.memberId, (memberMinutes.get(e.memberId) ?? 0) + e.durationMinutes);
  });
  const teamCapacity: SeriesPoint[] = d.members
    .filter((m) => m.role !== 'client')
    .map((m) => ({
      label: m.firstName,
      capacita: round2(m.weeklyHours * 4),
      registrate: round2((memberMinutes.get(m.id) ?? 0) / 60),
    }));

  return {
    summary: {
      income,
      expenses,
      profit: round2(income - expenses),
      pendingPayments: round2(pendingPayments),
      overdueInvoicesValue: round2(overdueValue),
      overdueInvoicesCount: overdueCount,
      openEstimatesValue: round2(openEstimatesValue),
      pipelineValue,
      weightedPipeline,
      activeProjects,
      atRiskProjects,
      overdueTasks,
      loggedHours,
    },
    monthly,
    cashFlow,
    projectsByStatus,
    revenueByService,
    expensesByCategory,
    pipelineByStage,
    hoursByProject,
    estimatedVsActual,
    teamCapacity,
    topClients,
    conversionRate,
  };
}

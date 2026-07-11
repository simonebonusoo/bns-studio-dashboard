import type {
  CalendarEvent,
  Client,
  Contract,
  Estimate,
  FileItem,
  Invoice,
  Milestone,
  Payment,
  Project,
  Service,
  TimeEntry,
  Transaction,
} from '@/types';

export interface DeleteDependency {
  label: string;
  count: number;
}

export interface DeleteSafetyResult {
  dependencies: DeleteDependency[];
  warning?: string;
}

interface ClientDeleteInput {
  client: Client;
  projects: Project[];
  estimates: Estimate[];
  invoices: Invoice[];
  payments: Payment[];
  contracts: Contract[];
  files: FileItem[];
  events: CalendarEvent[];
  transactions: Transaction[];
}

interface ProjectDeleteInput {
  project: Project;
  milestones: Milestone[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  payments: Payment[];
  contracts: Contract[];
  files: FileItem[];
  events: CalendarEvent[];
  transactions: Transaction[];
}

interface ServiceDeleteInput {
  service: Service;
  projects: Project[];
  estimates: Estimate[];
  invoices: Invoice[];
}

export function hasBlockingDependencies(result: DeleteSafetyResult) {
  return result.dependencies.length > 0;
}

function dependency(label: string, count: number): DeleteDependency | null {
  if (count <= 0) return null;
  return { label, count };
}

export function getClientDeleteSafety(input: ClientDeleteInput): DeleteSafetyResult {
  const { client, projects, estimates, invoices, payments, contracts, files, events, transactions } = input;

  return {
    dependencies: [
      dependency('progetto', projects.filter((item) => item.clientId === client.id).length),
      dependency('preventivo', estimates.filter((item) => item.clientId === client.id).length),
      dependency('fattura', invoices.filter((item) => item.clientId === client.id).length),
      dependency('pagamento', payments.filter((item) => item.clientId === client.id).length),
      dependency('contratto', contracts.filter((item) => item.clientId === client.id).length),
      dependency('file', files.filter((item) => item.clientId === client.id).length),
      dependency('evento', events.filter((item) => item.clientId === client.id).length),
      dependency('movimento', transactions.filter((item) => item.clientId === client.id).length),
    ].filter(Boolean) as DeleteDependency[],
  };
}

export function getProjectDeleteSafety(input: ProjectDeleteInput): DeleteSafetyResult {
  const { project, milestones, timeEntries, invoices, payments, contracts, files, events, transactions } = input;

  return {
    dependencies: [
      dependency('milestone', milestones.filter((item) => item.projectId === project.id).length),
      dependency('time entry', timeEntries.filter((item) => item.projectId === project.id).length),
      dependency('fattura', invoices.filter((item) => item.projectId === project.id).length),
      dependency('pagamento', payments.filter((item) => item.projectId === project.id).length),
      dependency('contratto', contracts.filter((item) => item.projectId === project.id).length),
      dependency('file', files.filter((item) => item.projectId === project.id).length),
      dependency('evento', events.filter((item) => item.projectId === project.id).length),
      dependency('movimento', transactions.filter((item) => item.projectId === project.id).length),
    ].filter(Boolean) as DeleteDependency[],
  };
}

export function getServiceDeleteSafety(input: ServiceDeleteInput): DeleteSafetyResult {
  const { service, projects, estimates, invoices } = input;
  const estimateLines = estimates.filter((item) => item.items.some((line) => line.serviceId === service.id)).length;
  const invoiceLines = invoices.filter((item) => item.items.some((line) => line.serviceId === service.id)).length;

  return {
    dependencies: [
      dependency('progetto', projects.filter((item) => item.serviceId === service.id).length),
      dependency('preventivo', estimateLines),
      dependency('fattura', invoiceLines),
    ].filter(Boolean) as DeleteDependency[],
  };
}

export function getEstimateDeleteSafety(estimate: Estimate, contracts: Contract[], invoices: Invoice[]): DeleteSafetyResult {
  return {
    dependencies: [
      dependency('contratto', contracts.filter((item) => item.estimateId === estimate.id).length),
      dependency('fattura', invoices.filter((item) => item.estimateId === estimate.id).length),
    ].filter(Boolean) as DeleteDependency[],
  };
}

export function getInvoiceDeleteSafety(invoice: Invoice, payments: Payment[]): DeleteSafetyResult {
  const linkedPayments = payments.filter((item) => item.invoiceId === invoice.id);

  return {
    dependencies: [dependency('pagamento', linkedPayments.length)].filter(Boolean) as DeleteDependency[],
    warning:
      linkedPayments.length > 0
        ? undefined
        : invoice.status === 'paid' || invoice.status === 'partially_paid'
          ? 'La rimozione della fattura inciderà sulla reportistica finanziaria e sugli analytics.'
          : undefined,
  };
}

export function getPaymentDeleteSafety(payment: Payment, invoice?: Invoice | null): DeleteSafetyResult {
  return {
    dependencies: [],
    warning:
      payment.status === 'completed'
        ? `Stai eliminando un pagamento completato di €${payment.amount.toFixed(2)}${invoice ? '. Il saldo della fattura collegata verrà ricalcolato.' : '.'}`
        : undefined,
  };
}

export function getTransactionDeleteSafety(transaction: Transaction): DeleteSafetyResult {
  return {
    dependencies: [],
    warning:
      transaction.type === 'income'
        ? 'Stai eliminando un movimento di entrata già registrato. Dashboard e analytics verranno aggiornati.'
        : undefined,
  };
}

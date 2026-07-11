import type { CalendarEvent, Client, Contract, Estimate, Invoice, Payment, Project, Service, Transaction } from '@/types';
import { repositories } from '@/services/repository';
import { normalizeIdentity } from './utils';
import type { ImportCandidate, ImportContextData, ImportEntityType } from './types';

export async function loadImportContext(): Promise<ImportContextData> {
  const [clients, services, projects, estimates, contracts, invoices, payments, transactions, events] = await Promise.all([
    repositories.clients.list() as Promise<Client[]>,
    repositories.services.list() as Promise<Service[]>,
    repositories.projects.list() as Promise<Project[]>,
    repositories.estimates.list() as Promise<Estimate[]>,
    repositories.contracts.list() as Promise<Contract[]>,
    repositories.invoices.list() as Promise<Invoice[]>,
    repositories.payments.list() as Promise<Payment[]>,
    repositories.transactions.list() as Promise<Transaction[]>,
    repositories.events.list() as Promise<CalendarEvent[]>,
  ]);

  return { clients, services, projects, estimates, contracts, invoices, payments, transactions, events };
}

function comparableSnapshot(entityType: ImportEntityType, value: Record<string, unknown>) {
  const keysByType: Record<ImportEntityType, string[]> = {
    client: ['displayName', 'email', 'phone', 'vat', 'city', 'sector', 'status'],
    service: ['name', 'category', 'basePrice', 'priceUnit', 'vatRate', 'active'],
    project: ['code', 'name', 'clientId', 'serviceId', 'status', 'contractValue', 'estimatedHours', 'dueDate'],
    estimate: ['number', 'clientId', 'status', 'currency', 'issueDate', 'expiryDate'],
    contract: ['number', 'title', 'clientId', 'projectId', 'status', 'value'],
    invoice: ['number', 'clientId', 'projectId', 'status', 'currency', 'issueDate', 'dueDate'],
    payment: ['clientId', 'invoiceId', 'amount', 'date', 'reference', 'status'],
    transaction: ['type', 'category', 'description', 'amount', 'date', 'clientId', 'projectId'],
    event: ['title', 'type', 'start', 'projectId', 'clientId'],
  };
  return Object.fromEntries(keysByType[entityType].map((key) => [key, value[key] ?? null]));
}

function isIdentical(entityType: ImportEntityType, left: Record<string, unknown>, right: Record<string, unknown>) {
  return JSON.stringify(comparableSnapshot(entityType, left)) === JSON.stringify(comparableSnapshot(entityType, right));
}

function matchClient(candidate: ImportCandidate, context: ImportContextData) {
  const fields = candidate.normalizedFields;
  if (typeof fields.vat === 'string' && fields.vat) {
    const matches = context.clients.filter((client) => client.vat === fields.vat);
    if (matches.length > 0) return matches;
  }
  if (typeof fields.email === 'string' && fields.email) {
    const matches = context.clients.filter((client) => client.email === fields.email);
    if (matches.length > 0) return matches;
  }
  const name = normalizeIdentity(String(fields.displayName ?? ''));
  return context.clients.filter((client) => normalizeIdentity(client.displayName) === name);
}

function matchService(candidate: ImportCandidate, context: ImportContextData) {
  const name = normalizeIdentity(String(candidate.normalizedFields.name ?? ''));
  return context.services.filter((service) => normalizeIdentity(service.name) === name);
}

function matchProject(candidate: ImportCandidate, context: ImportContextData) {
  const code = String(candidate.normalizedFields.code ?? '');
  if (code) {
    const matches = context.projects.filter((project) => project.code === code);
    if (matches.length > 0) return matches;
  }
  const name = normalizeIdentity(String(candidate.normalizedFields.name ?? ''));
  const clientId = String(candidate.normalizedFields.clientId ?? '');
  return context.projects.filter((project) => normalizeIdentity(project.name) === name && (!clientId || project.clientId === clientId));
}

function matchByNumber<T extends { id: string; number: string }>(candidate: ImportCandidate, values: T[]) {
  const number = String(candidate.normalizedFields.number ?? '');
  return number ? values.filter((value) => value.number === number) : [];
}

function matchPayment(candidate: ImportCandidate, context: ImportContextData) {
  const amount = Number(candidate.normalizedFields.amount ?? 0);
  const date = String(candidate.normalizedFields.date ?? '');
  const reference = normalizeIdentity(String(candidate.normalizedFields.reference ?? ''));
  const clientId = String(candidate.normalizedFields.clientId ?? '');
  const invoiceId = String(candidate.normalizedFields.invoiceId ?? '');
  return context.payments.filter((payment) => {
    return payment.amount === amount
      && payment.date === date
      && normalizeIdentity(payment.reference ?? '') === reference
      && (!clientId || payment.clientId === clientId)
      && (!invoiceId || payment.invoiceId === invoiceId);
  });
}

function matchTransaction(candidate: ImportCandidate, context: ImportContextData) {
  const amount = Number(candidate.normalizedFields.amount ?? 0);
  const date = String(candidate.normalizedFields.date ?? '');
  const type = String(candidate.normalizedFields.type ?? '');
  const description = normalizeIdentity(String(candidate.normalizedFields.description ?? ''));
  return context.transactions.filter((transaction) => (
    transaction.amount === amount
    && transaction.date === date
    && transaction.type === type
    && normalizeIdentity(transaction.description) === description
  ));
}

function matchEvent(candidate: ImportCandidate, context: ImportContextData) {
  const title = normalizeIdentity(String(candidate.normalizedFields.title ?? ''));
  const start = String(candidate.normalizedFields.start ?? '');
  return context.events.filter((event) => normalizeIdentity(event.title) === title && event.start === start);
}

export function detectDuplicates(candidates: ImportCandidate[], context: ImportContextData) {
  candidates.forEach((candidate) => {
    if (candidate.duplicateStatus === 'invalid') return;

    const matches = (() => {
      switch (candidate.entityType) {
        case 'client':
          return matchClient(candidate, context);
        case 'service':
          return matchService(candidate, context);
        case 'project':
          return matchProject(candidate, context);
        case 'estimate':
          return matchByNumber(candidate, context.estimates);
        case 'contract':
          return matchByNumber(candidate, context.contracts);
        case 'invoice':
          return matchByNumber(candidate, context.invoices);
        case 'payment':
          return matchPayment(candidate, context);
        case 'transaction':
          return matchTransaction(candidate, context);
        case 'event':
          return matchEvent(candidate, context);
      }
    })();

    if (matches.length === 0) {
      candidate.duplicateStatus = 'new';
      candidate.action = 'create';
      return;
    }

    if (matches.length > 1) {
      candidate.duplicateStatus = 'ambiguous_match';
      candidate.action = 'skip';
      return;
    }

    const [match] = matches;
    candidate.existingMatchId = match.id;
    candidate.selectedExistingId = match.id;
    candidate.existingSnapshot = comparableSnapshot(candidate.entityType, match as unknown as Record<string, unknown>);

    if (isIdentical(candidate.entityType, candidate.normalizedFields, match as unknown as Record<string, unknown>)) {
      candidate.duplicateStatus = 'existing_identical';
      candidate.action = 'skip';
      return;
    }

    candidate.duplicateStatus = 'existing_different';
    candidate.action = 'skip';
  });

  candidates.forEach((candidate) => {
    candidate.relationshipHints = candidate.relationshipHints.map((hint) => {
      const resolvedExistingId = (() => {
        switch (hint.targetType) {
          case 'client':
            return context.clients.find((client) => normalizeIdentity(client.displayName) === hint.normalizedValue)?.id;
          case 'service':
            return context.services.find((service) => normalizeIdentity(service.name) === hint.normalizedValue)?.id;
          case 'project':
            return context.projects.find((project) => normalizeIdentity(project.name) === hint.normalizedValue || project.code === hint.value)?.id;
          case 'estimate':
            return context.estimates.find((estimate) => estimate.number === hint.value)?.id;
          case 'invoice':
            return context.invoices.find((invoice) => invoice.number === hint.value)?.id;
        }
      })();
      return resolvedExistingId ? { ...hint, resolvedId: resolvedExistingId } : hint;
    });
  });

  return candidates;
}

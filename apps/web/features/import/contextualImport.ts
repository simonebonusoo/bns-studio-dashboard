import { uid } from '@/lib/id';
import { normalizeIdentity } from '@/services/markdownImport/utils';
import type {
  DocumentLineItem,
  PaymentInstallment,
} from '@/types';
import type { ImportCandidate, ImportContextData, ImportEntityType, ImportRelationshipHint } from '@/services/markdownImport';

export type ContextualEntityType = Extract<ImportEntityType, 'client' | 'project' | 'estimate' | 'contract' | 'invoice' | 'payment'>;

export interface ResolvedImport {
  entityType: ContextualEntityType;
  candidate: ImportCandidate;
  defaults: Record<string, unknown>;
  relationshipSummaries: RelationshipSummary[];
}

export interface RelationshipSummary {
  field: string;
  label: string;
  value: string;
  status: 'matched' | 'missing' | 'ambiguous';
  options: Array<{ id: string; label: string }>;
}

const RELATION_LABELS: Record<string, string> = {
  clientId: 'Cliente',
  projectId: 'Progetto',
  serviceId: 'Servizio',
  estimateId: 'Preventivo',
  invoiceId: 'Fattura',
};

function text(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function findOptions(hint: ImportRelationshipHint, context: ImportContextData) {
  const needle = hint.normalizedValue;
  const score = (label: string) => {
    const normalized = normalizeIdentity(label);
    if (normalized === needle) return 3;
    if (normalized.includes(needle) || needle.includes(normalized)) return 2;
    return 0;
  };
  const options = (() => {
    switch (hint.targetType) {
      case 'client':
        return context.clients.map((item) => ({ id: item.id, label: item.displayName, score: score(item.displayName) }));
      case 'service':
        return context.services.map((item) => ({ id: item.id, label: item.name, score: score(item.name) }));
      case 'project':
        return context.projects.map((item) => ({ id: item.id, label: item.name, score: Math.max(score(item.name), item.code === hint.value ? 3 : 0) }));
      case 'estimate':
        return context.estimates.map((item) => ({ id: item.id, label: item.number, score: item.number === hint.value ? 3 : score(item.number) }));
      case 'invoice':
        return context.invoices.map((item) => ({ id: item.id, label: item.number, score: item.number === hint.value ? 3 : score(item.number) }));
      default:
        return [];
    }
  })();
  return options
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ id, label }) => ({ id, label }));
}

function allOptions(hint: ImportRelationshipHint, context: ImportContextData) {
  switch (hint.targetType) {
    case 'client':
      return context.clients.map((item) => ({ id: item.id, label: item.displayName }));
    case 'service':
      return context.services.map((item) => ({ id: item.id, label: item.name }));
    case 'project':
      return context.projects.map((item) => ({ id: item.id, label: item.name }));
    case 'estimate':
      return context.estimates.map((item) => ({ id: item.id, label: item.number }));
    case 'invoice':
      return context.invoices.map((item) => ({ id: item.id, label: item.number }));
    default:
      return [];
  }
}

export function summarizeRelationships(candidate: ImportCandidate, context: ImportContextData): RelationshipSummary[] {
  return candidate.relationshipHints.map((hint) => {
    const matches = findOptions(hint, context);
    const options = matches.length > 0 ? matches : allOptions(hint, context);
    const selected = hint.resolvedId ?? (matches.length === 1 ? matches[0].id : undefined);
    return {
      field: hint.field,
      label: RELATION_LABELS[hint.field] ?? hint.field,
      value: hint.value,
      options,
      status: selected ? 'matched' : matches.length > 1 ? 'ambiguous' : 'missing',
    };
  });
}

export function applyRelationshipSelection(candidate: ImportCandidate, selections: Record<string, string>) {
  return {
    ...candidate,
    relationshipHints: candidate.relationshipHints.map((hint) => ({
      ...hint,
      resolvedId: selections[hint.field] || hint.resolvedId,
    })),
  };
}

function relatedFields(candidate: ImportCandidate) {
  return Object.fromEntries(candidate.relationshipHints.map((hint) => [hint.field, hint.resolvedId]).filter(([, value]) => value));
}

function items(fields: Record<string, unknown>): DocumentLineItem[] {
  return Array.isArray(fields.items) && fields.items.length > 0
    ? fields.items as DocumentLineItem[]
    : [{ id: uid(), description: 'Voce importata da Markdown', quantity: 1, unit: 'fixed', unitPrice: 0, discountPct: 0, vatRate: 22 }];
}

export function buildContextualDefaults(
  entityType: ContextualEntityType,
  candidate: ImportCandidate,
  context: ImportContextData,
): ResolvedImport {
  const fields = { ...candidate.normalizedFields, ...relatedFields(candidate) };
  const relationshipSummaries = summarizeRelationships(candidate, context);
  const defaults = (() => {
    switch (entityType) {
      case 'client':
        return {
          type: text(fields.type) || 'company',
          displayName: text(fields.displayName),
          companyName: text(fields.companyName),
          email: text(fields.email),
          phone: text(fields.phone),
          website: text(fields.website),
          vat: text(fields.vat),
          city: text(fields.city),
          sector: text(fields.sector),
          source: text(fields.source),
          status: text(fields.status) || 'lead',
          priority: text(fields.priority) || 'medium',
          notes: text(fields.notes),
        };
      case 'project':
        return {
          name: text(fields.name),
          description: text(fields.description),
          websiteUrl: fields.websiteUrl ?? '',
          clientId: text(fields.clientId),
          serviceId: text(fields.serviceId),
          status: text(fields.status) || 'planned',
          priority: text(fields.priority) || 'medium',
          contractValue: Number(fields.contractValue ?? 0),
          budget: Number(fields.budget ?? 0),
          estimatedHours: Number(fields.estimatedHours ?? 0),
          startDate: text(fields.startDate),
          dueDate: text(fields.dueDate),
        };
      case 'estimate':
        return {
          clientId: text(fields.clientId),
          status: text(fields.status) || 'draft',
          issueDate: text(fields.issueDate),
          expiryDate: text(fields.expiryDate),
          depositPct: String(fields.depositPct ?? 0),
          notes: text(fields.notes ?? fields.terms),
          items: items(fields),
        };
      case 'contract':
        return {
          title: text(fields.title),
          clientId: text(fields.clientId),
          projectId: text(fields.projectId),
          estimateId: text(fields.estimateId),
          type: text(fields.type) || 'single_project',
          status: text(fields.status) || 'draft',
          value: String(fields.value ?? ''),
          startDate: text(fields.startDate),
          endDate: text(fields.endDate),
          recurrence: text(fields.recurrence) || 'one_time',
          billingFrequency: text(fields.billingFrequency) || text(fields.recurrence) || 'one_time',
          renewalType: text(fields.renewalType) || 'none',
          paymentTerms: text(fields.paymentTerms) || '30 giorni',
          terms: text(fields.terms ?? fields.notes),
        };
      case 'invoice':
        return {
          clientId: text(fields.clientId),
          projectId: text(fields.projectId),
          status: text(fields.status) || 'draft',
          issueDate: text(fields.issueDate),
          dueDate: text(fields.dueDate),
          paymentMethod: text(fields.paymentMethod) || 'bank_transfer',
          notes: text(fields.notes),
          items: items(fields),
        };
      case 'payment':
        return {
          clientId: text(fields.clientId),
          invoiceId: text(fields.invoiceId),
          amount: String(fields.amount ?? ''),
          date: text(fields.date),
          method: text(fields.method) || 'bank_transfer',
          reference: text(fields.reference),
          status: text(fields.status) || 'pending',
          notes: text(fields.notes),
          installments: Array.isArray(fields.installments) ? fields.installments as PaymentInstallment[] : undefined,
        };
    }
  })();
  return { entityType, candidate, defaults, relationshipSummaries };
}

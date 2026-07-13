import { todayISO } from '@/lib/id';
import { normalizeWebsiteUrl } from '@/lib/url';
import { nextContractNumber, nextEstimateNumber, nextInvoiceNumber, nextProjectCode } from '@/services/documentNumbers';
import { repositories } from '@/services/repository';
import type {
  CalendarEvent,
  Client,
  Contract,
  Estimate,
  Invoice,
  MarkdownImport,
  Payment,
  Project,
  Service,
  Transaction,
} from '@/types';
import { ENTITY_ORDER } from './constants';
import { detectDuplicates, loadImportContext } from './duplicateDetector';
import { normalizeIdentity } from './utils';
import type { ImportCandidate, ImportContextData, ImportExecutionSummary } from './types';

function emptyStats() {
  return { created: 0, updated: 0, skipped: 0, failed: 0 };
}

function buildResultPath(entityType: ImportCandidate['entityType'], id: string) {
  switch (entityType) {
    case 'client':
      return `/clients/${id}`;
    case 'project':
      return `/projects/${id}`;
    case 'estimate':
      return `/estimates/${id}`;
    case 'invoice':
      return `/invoices/${id}`;
    case 'service':
      return '/services';
    case 'contract':
      return '/contracts';
    case 'payment':
      return '/payments';
    case 'transaction':
      return '/finance';
    case 'event':
      return '/calendar';
  }
}

function indexByBusinessIdentity(context: ImportContextData) {
  const map = new Map<string, string>();
  context.clients.forEach((client) => map.set(`client:${normalizeIdentity(client.displayName)}`, client.id));
  context.services.forEach((service) => map.set(`service:${normalizeIdentity(service.name)}`, service.id));
  context.projects.forEach((project) => {
    map.set(`project:${normalizeIdentity(project.name)}`, project.id);
    map.set(`project:${project.code}`, project.id);
  });
  context.estimates.forEach((estimate) => map.set(`estimate:${estimate.number}`, estimate.id));
  context.invoices.forEach((invoice) => map.set(`invoice:${invoice.number}`, invoice.id));
  return map;
}

function applyResolvedRelationships(
  candidate: ImportCandidate,
  createdIdByTemporaryId: Map<string, string>,
  createdIdByBusinessIdentity: Map<string, string>,
) {
  const patch = { ...candidate.normalizedFields } as Record<string, unknown>;
  candidate.relationshipHints.forEach((hint) => {
    const batchId = hint.matchedCandidateId ? createdIdByTemporaryId.get(hint.matchedCandidateId) : undefined;
    const identityId = createdIdByBusinessIdentity.get(`${hint.targetType}:${hint.normalizedValue}`);
    patch[hint.field] = batchId ?? hint.resolvedId ?? identityId ?? patch[hint.field];
  });
  return patch;
}

function createClientPayload(fields: Record<string, unknown>): Omit<Client, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> {
  return {
    type: (fields.type as Client['type']) ?? 'company',
    displayName: String(fields.displayName ?? ''),
    email: (fields.email as string | undefined) || undefined,
    phone: (fields.phone as string | undefined) || undefined,
    website: (fields.website as string | undefined) || undefined,
    vat: (fields.vat as string | undefined) || undefined,
    city: (fields.city as string | undefined) || undefined,
    sector: (fields.sector as string | undefined) || undefined,
    source: (fields.source as string | undefined) || undefined,
    status: (fields.status as Client['status']) ?? 'active',
    priority: (fields.priority as Client['priority']) ?? 'medium',
    notes: (fields.notes as string | undefined) || undefined,
    tags: Array.isArray(fields.tags) ? fields.tags as string[] : [],
  };
}

function createServicePayload(fields: Record<string, unknown>): Omit<Service, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> {
  return {
    name: String(fields.name ?? ''),
    description: (fields.description as string | undefined) || undefined,
    category: String(fields.category ?? 'Generale'),
    basePrice: Number(fields.basePrice ?? 0),
    priceUnit: (fields.priceUnit as Service['priceUnit']) ?? 'fixed',
    vatRate: Number(fields.vatRate ?? 22),
    estimatedHours: Number(fields.estimatedHours ?? 0),
    internalCost: Number(fields.internalCost ?? 0),
    targetMargin: Number(fields.targetMargin ?? 0),
    active: Boolean(fields.active ?? true),
    color: String(fields.color ?? '#b0d62e'),
  };
}

async function createProjectPayload(fields: Record<string, unknown>): Promise<Omit<Project, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>> {
  return {
    code: String(fields.code || await nextProjectCode()),
    name: String(fields.name ?? ''),
    description: (fields.description as string | undefined) || undefined,
    websiteUrl: normalizeWebsiteUrl(fields.websiteUrl ?? fields.website),
    clientId: (fields.clientId as string | undefined) || undefined,
    companyId: undefined,
    managerId: undefined,
    memberIds: Array.isArray(fields.memberIds) ? fields.memberIds as string[] : [],
    serviceId: (fields.serviceId as string | undefined) || undefined,
    status: (fields.status as Project['status']) ?? 'planned',
    priority: (fields.priority as Project['priority']) ?? 'medium',
    health: (fields.health as Project['health']) ?? 'on_track',
    startDate: (fields.startDate as string | undefined) || todayISO(),
    dueDate: (fields.dueDate as string | undefined) || undefined,
    completedAt: undefined,
    contractValue: Number(fields.contractValue ?? 0),
    budget: Number(fields.budget ?? 0),
    estimatedHours: Number(fields.estimatedHours ?? 0),
    targetMargin: Number(fields.targetMargin ?? 0),
    progress: Number(fields.progress ?? 0),
    color: String(fields.color ?? '#b0d62e'),
    tags: Array.isArray(fields.tags) ? fields.tags as string[] : [],
  };
}

async function createEstimatePayload(fields: Record<string, unknown>): Promise<Omit<Estimate, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>> {
  return {
    number: String(fields.number || await nextEstimateNumber()),
    version: Number(fields.version ?? 1),
    clientId: (fields.clientId as string | undefined) || undefined,
    opportunityId: undefined,
    status: (fields.status as Estimate['status']) ?? 'draft',
    currency: String(fields.currency ?? 'EUR'),
    issueDate: String(fields.issueDate ?? todayISO()),
    expiryDate: (fields.expiryDate as string | undefined) || undefined,
    items: Array.isArray(fields.items) ? fields.items as Estimate['items'] : [],
    globalDiscountPct: Number(fields.globalDiscountPct ?? 0),
    depositPct: Number(fields.depositPct ?? 0),
    notes: (fields.notes as string | undefined) || undefined,
    terms: (fields.terms as string | undefined) || undefined,
    acceptedAt: undefined,
    rejectedReason: undefined,
  };
}

async function createContractPayload(fields: Record<string, unknown>): Promise<Omit<Contract, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>> {
  return {
    number: String(fields.number || await nextContractNumber()),
    title: String(fields.title ?? 'Contratto importato'),
    clientId: (fields.clientId as string | undefined) || undefined,
    projectId: (fields.projectId as string | undefined) || undefined,
    estimateId: (fields.estimateId as string | undefined) || undefined,
    type: (fields.type as Contract['type']) ?? 'single_project',
    status: (fields.status as Contract['status']) ?? 'draft',
    value: Number(fields.value ?? 0),
    startDate: (fields.startDate as string | undefined) || undefined,
    endDate: (fields.endDate as string | undefined) || undefined,
    paymentTerms: (fields.paymentTerms as string | undefined) || undefined,
    includedRevisions: undefined,
    terms: (fields.terms as string | undefined) || undefined,
    signedByClient: Boolean(fields.signedByClient),
    signedByStudio: Boolean(fields.signedByStudio),
    pdfName: undefined,
    pdfUrl: undefined,
    notes: (fields.notes as string | undefined) || undefined,
  };
}

async function createInvoicePayload(fields: Record<string, unknown>): Promise<Omit<Invoice, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>> {
  return {
    number: String(fields.number || await nextInvoiceNumber()),
    clientId: (fields.clientId as string | undefined) || undefined,
    projectId: (fields.projectId as string | undefined) || undefined,
    estimateId: (fields.estimateId as string | undefined) || undefined,
    status: (fields.status as Invoice['status']) ?? 'draft',
    currency: String(fields.currency ?? 'EUR'),
    issueDate: String(fields.issueDate ?? todayISO()),
    dueDate: (fields.dueDate as string | undefined) || undefined,
    items: Array.isArray(fields.items) ? fields.items as Invoice['items'] : [],
    globalDiscountPct: Number(fields.globalDiscountPct ?? 0),
    withholdingPct: Number(fields.withholdingPct ?? 0),
    notes: (fields.notes as string | undefined) || undefined,
    paymentMethod: (fields.paymentMethod as Invoice['paymentMethod']) ?? 'bank_transfer',
  };
}

function createPaymentPayload(fields: Record<string, unknown>): Omit<Payment, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> {
  return {
    clientId: (fields.clientId as string | undefined) || undefined,
    invoiceId: (fields.invoiceId as string | undefined) || undefined,
    projectId: (fields.projectId as string | undefined) || undefined,
    amount: Number(fields.amount ?? 0),
    currency: String(fields.currency ?? 'EUR'),
    date: String(fields.date ?? todayISO()),
    method: (fields.method as Payment['method']) ?? 'bank_transfer',
    reference: (fields.reference as string | undefined) || undefined,
    status: (fields.status as Payment['status']) ?? 'pending',
    notes: (fields.notes as string | undefined) || undefined,
  };
}

function createTransactionPayload(fields: Record<string, unknown>): Omit<Transaction, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> {
  return {
    type: (fields.type as Transaction['type']) ?? 'expense',
    category: String(fields.category ?? 'Generale'),
    description: String(fields.description ?? 'Movimento importato'),
    amount: Number(fields.amount ?? 0),
    currency: String(fields.currency ?? 'EUR'),
    date: String(fields.date ?? todayISO()),
    clientId: (fields.clientId as string | undefined) || undefined,
    projectId: (fields.projectId as string | undefined) || undefined,
    vendor: (fields.vendor as string | undefined) || undefined,
    method: (fields.method as Transaction['method']) ?? undefined,
    notes: (fields.notes as string | undefined) || undefined,
  };
}

function createEventPayload(fields: Record<string, unknown>): Omit<CalendarEvent, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> {
  return {
    title: String(fields.title ?? 'Evento importato'),
    type: (fields.type as CalendarEvent['type']) ?? 'custom',
    start: String(fields.start ?? new Date().toISOString()),
    end: String(fields.end ?? new Date().toISOString()),
    allDay: Boolean(fields.allDay),
    clientId: (fields.clientId as string | undefined) || undefined,
    projectId: (fields.projectId as string | undefined) || undefined,
    attendeeIds: Array.isArray(fields.attendeeIds) ? fields.attendeeIds as string[] : [],
    location: (fields.location as string | undefined) || undefined,
    meetingLink: (fields.meetingLink as string | undefined) || undefined,
    description: (fields.description as string | undefined) || undefined,
    reminderMinutes: Number(fields.reminderMinutes ?? 30),
    visibility: (fields.visibility as CalendarEvent['visibility']) ?? 'team',
  };
}

async function createCandidateRecord(candidate: ImportCandidate, fields: Record<string, unknown>) {
  switch (candidate.entityType) {
    case 'client':
      return repositories.clients.create(createClientPayload(fields));
    case 'service':
      return repositories.services.create(createServicePayload(fields));
    case 'project':
      return repositories.projects.create(await createProjectPayload(fields));
    case 'estimate':
      return repositories.estimates.create(await createEstimatePayload(fields));
    case 'contract':
      return repositories.contracts.create(await createContractPayload(fields));
    case 'invoice':
      return repositories.invoices.create(await createInvoicePayload(fields));
    case 'payment':
      return repositories.payments.create(createPaymentPayload(fields));
    case 'transaction':
      return repositories.transactions.create(createTransactionPayload(fields));
    case 'event':
      return repositories.events.create(createEventPayload(fields));
  }
}

async function updateCandidateRecord(candidate: ImportCandidate, fields: Record<string, unknown>) {
  const selectedId = candidate.selectedExistingId ?? candidate.existingMatchId;
  if (!selectedId) throw new Error('Record esistente non selezionato.');

  switch (candidate.entityType) {
    case 'client':
      return repositories.clients.update(selectedId, createClientPayload(fields) as Partial<Client>);
    case 'service':
      return repositories.services.update(selectedId, createServicePayload(fields) as Partial<Service>);
    case 'project':
      return repositories.projects.update(selectedId, await createProjectPayload(fields) as Partial<Project>);
    case 'estimate':
      return repositories.estimates.update(selectedId, await createEstimatePayload(fields) as Partial<Estimate>);
    case 'contract':
      return repositories.contracts.update(selectedId, await createContractPayload(fields) as Partial<Contract>);
    case 'invoice':
      return repositories.invoices.update(selectedId, await createInvoicePayload(fields) as Partial<Invoice>);
    case 'payment':
      return repositories.payments.update(selectedId, createPaymentPayload(fields) as Partial<Payment>);
    case 'transaction':
      return repositories.transactions.update(selectedId, createTransactionPayload(fields) as Partial<Transaction>);
    case 'event':
      return repositories.events.update(selectedId, createEventPayload(fields) as Partial<CalendarEvent>);
  }
}

export async function executeMarkdownImport(
  candidates: ImportCandidate[],
  fileNames: string[],
): Promise<{ candidates: ImportCandidate[]; summary: ImportExecutionSummary }> {
  const context = await loadImportContext();
  detectDuplicates(candidates, context);

  const createdIdByTemporaryId = new Map<string, string>();
  const createdIdByBusinessIdentity = indexByBusinessIdentity(context);
  const byEntity = Object.fromEntries(ENTITY_ORDER.map((entityType) => [entityType, emptyStats()])) as ImportExecutionSummary['byEntity'];

  for (const entityType of ENTITY_ORDER) {
    const group = candidates.filter((candidate) => candidate.entityType === entityType);
    for (const candidate of group) {
      if (candidate.action === 'skip' || candidate.duplicateStatus === 'invalid') {
        candidate.importState = candidate.duplicateStatus === 'invalid' ? 'failed' : 'skipped';
        byEntity[entityType][candidate.importState === 'failed' ? 'failed' : 'skipped'] += 1;
        if (candidate.duplicateStatus === 'invalid' && !candidate.errorMessage) {
          candidate.errorMessage = 'Candidate non valida: correggi i campi richiesti.';
        }
        continue;
      }

      candidate.importState = 'importing';

      try {
        const fields = applyResolvedRelationships(candidate, createdIdByTemporaryId, createdIdByBusinessIdentity);
        const result = candidate.action === 'update'
          ? await updateCandidateRecord(candidate, fields)
          : await createCandidateRecord(candidate, fields);

        candidate.importState = 'success';
        candidate.resultId = result.id;
        candidate.resultPath = buildResultPath(candidate.entityType, result.id);

        const identity = String(fields.displayName ?? fields.name ?? fields.number ?? fields.title ?? '');
        if (identity) {
          createdIdByTemporaryId.set(candidate.temporaryId, result.id);
          createdIdByBusinessIdentity.set(`${candidate.entityType}:${normalizeIdentity(identity)}`, result.id);
        }
        byEntity[entityType][candidate.action === 'update' ? 'updated' : 'created'] += 1;
      } catch (error) {
        candidate.importState = 'failed';
        candidate.errorMessage = error instanceof Error ? error.message : 'Importazione non riuscita';
        byEntity[entityType].failed += 1;
      }
    }
  }

  const summary: ImportExecutionSummary = {
    analyzed: candidates.length,
    created: Object.values(byEntity).reduce((sum, item) => sum + item.created, 0),
    updated: Object.values(byEntity).reduce((sum, item) => sum + item.updated, 0),
    skipped: Object.values(byEntity).reduce((sum, item) => sum + item.skipped, 0),
    failed: Object.values(byEntity).reduce((sum, item) => sum + item.failed, 0),
    byEntity,
  };

  const historyStatus: MarkdownImport['status'] = summary.failed > 0
    ? (summary.created + summary.updated > 0 ? 'completed_with_errors' : 'failed')
    : 'completed';

  summary.history = await repositories.markdownImports.create({
    createdBy: undefined,
    fileNames,
    filesCount: fileNames.length,
    candidateCount: summary.analyzed,
    createdCount: summary.created,
    updatedCount: summary.updated,
    skippedCount: summary.skipped,
    failedCount: summary.failed,
    status: historyStatus,
    summary: {
      byEntity,
      resultIds: candidates.filter((candidate) => candidate.resultId).map((candidate) => ({
        entityType: candidate.entityType,
        id: candidate.resultId,
      })),
    },
  });

  return { candidates, summary };
}

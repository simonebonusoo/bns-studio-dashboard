import type { CalendarEventType, PaymentMethod, PriceUnit } from '@/types';
import { todayISO, uid } from '@/lib/id';
import { ENTITY_KEYWORDS } from './constants';
import {
  ensureArray,
  normalizeIdentity,
  normalizeLabel,
  normalizePaymentMethod,
  normalizePriceUnit,
  normalizePriority,
  normalizeStatusValue,
  parseBooleanValue,
  parseItalianDate,
  parseItalianNumber,
  sanitizeText,
  toPlainObject,
  toTemporaryId,
} from './utils';
import type {
  ImportAnalysisResult,
  ImportCandidate,
  ImportEntityType,
  ImportRelationshipHint,
  ImportWarning,
  ParsedMarkdownFile,
  ParsedMarkdownSection,
} from './types';

function scoreEntityType(section: ParsedMarkdownSection, frontmatterType?: string) {
  const scores = new Map<ImportEntityType, number>();
  (Object.keys(ENTITY_KEYWORDS) as ImportEntityType[]).forEach((entityType) => {
    scores.set(entityType, 0);
  });

  const heading = normalizeLabel(section.heading);
  const headingIdentity = normalizeIdentity(section.heading);
  const fieldKeys = Object.keys(section.fields);
  const paragraphs = section.paragraphs.map(normalizeLabel);
  const allSignals = [heading, ...fieldKeys, ...paragraphs];

  (Object.entries(ENTITY_KEYWORDS) as Array<[ImportEntityType, string[]]>).forEach(([entityType, keywords]) => {
    const base = scores.get(entityType) ?? 0;
    const matches = keywords.reduce((count, keyword) => count + Number(allSignals.some((signal) => signal.includes(keyword))), 0);
    const exactHeading = keywords.some((keyword) => headingIdentity === normalizeIdentity(keyword)) ? 0.45 : 0;
    const exactFields = keywords.reduce(
      (count, keyword) => count + Number(fieldKeys.some((fieldKey) => normalizeIdentity(fieldKey) === normalizeIdentity(keyword))),
      0,
    );
    scores.set(entityType, base + exactHeading + matches * 0.18 + exactFields * 0.22);
  });

  if (frontmatterType) {
    const normalized = normalizeIdentity(frontmatterType) as ImportEntityType;
    if (scores.has(normalized)) {
      scores.set(normalized, (scores.get(normalized) ?? 0) + 0.55);
    }
  }

  const sorted = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  const [bestType, bestScore] = sorted[0] ?? [];
  const secondScore = sorted[1]?.[1] ?? 0;
  return {
    entityType: bestType,
    confidence: Math.min(1, Math.max(0, (bestScore ?? 0) + (fieldKeys.length >= 2 ? 0.1 : 0))),
    ambiguous: (bestScore ?? 0) - secondScore < 0.12,
  };
}

function looksLikePaymentTable(section: ParsedMarkdownSection) {
  return section.tables.some((table) => {
    const headers = table.headers.map((header) => normalizeIdentity(header));
    return headers.includes('importo') && (headers.includes('rata') || headers.includes('stato') || headers.includes('amount'));
  });
}

function collectRawFields(section: ParsedMarkdownSection, document: ParsedMarkdownFile) {
  return toPlainObject({
    ...Object.fromEntries(Object.entries(document.frontmatter).map(([key, value]) => [normalizeLabel(key), value])),
    ...(section.heading ? { title: section.heading } : {}),
    ...section.fields,
    ...(section.paragraphs[0] ? { note: section.paragraphs.join('\n') } : {}),
  });
}

function getField(rawFields: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = rawFields[normalizeLabel(alias)];
    if (value !== undefined && sanitizeText(value) !== '') return value;
  }
  return undefined;
}

function relationHint(field: string, targetType: ImportRelationshipHint['targetType'], value: unknown): ImportRelationshipHint | null {
  const text = sanitizeText(value);
  if (!text) return null;
  return {
    field,
    targetType,
    value: text,
    normalizedValue: normalizeIdentity(text),
  };
}

function resolveStatusWarning(
  kind: 'client' | 'project' | 'estimate' | 'contract' | 'invoice' | 'payment' | 'event',
  value: unknown,
  warnings: ImportWarning[],
) {
  const raw = sanitizeText(value);
  if (!raw) return undefined;
  const normalized = normalizeStatusValue(kind, raw);
  if (!normalized) {
    warnings.push({
      code: 'unknown_status',
      field: 'status',
      message: `Stato non riconosciuto: ${raw}`,
      level: 'warning',
    });
  }
  return normalized;
}

function normalizeClient(rawFields: Record<string, unknown>, warnings: ImportWarning[]) {
  const displayName = sanitizeText(getField(rawFields, ['name', 'nome', 'cliente', 'nome cliente', 'ragione sociale', 'azienda', 'title']));
  const status = resolveStatusWarning('client', getField(rawFields, ['status', 'stato']), warnings) ?? 'active';
  const priority = normalizePriority(getField(rawFields, ['priority', 'priorita'])) ?? 'medium';
  return {
    normalizedFields: {
      type: 'company',
      displayName,
      email: sanitizeText(getField(rawFields, ['email', 'e-mail'])) || undefined,
      phone: sanitizeText(getField(rawFields, ['telefono', 'phone', 'tel'])) || undefined,
      website: sanitizeText(getField(rawFields, ['website', 'sito', 'url'])) || undefined,
      vat: sanitizeText(getField(rawFields, ['p iva', 'partita iva', 'vat'])) || undefined,
      city: sanitizeText(getField(rawFields, ['citta', 'city', 'location'])) || undefined,
      sector: sanitizeText(getField(rawFields, ['settore', 'industry'])) || undefined,
      source: sanitizeText(getField(rawFields, ['source', 'fonte'])) || undefined,
      status,
      priority,
      notes: sanitizeText(getField(rawFields, ['notes', 'note'])) || undefined,
      tags: ensureArray(getField(rawFields, ['tags', 'etichette'])),
    },
    relationshipHints: [],
    warnings,
  };
}

function normalizeService(rawFields: Record<string, unknown>, warnings: ImportWarning[]) {
  const active = parseBooleanValue(getField(rawFields, ['active', 'attivo', 'stato'])) ?? true;
  return {
    normalizedFields: {
      name: sanitizeText(getField(rawFields, ['name', 'nome', 'servizio', 'service', 'title'])),
      description: sanitizeText(getField(rawFields, ['description', 'descrizione', 'note'])) || undefined,
      category: sanitizeText(getField(rawFields, ['category', 'categoria'])) || 'Generale',
      basePrice: parseItalianNumber(getField(rawFields, ['prezzo base', 'base price', 'prezzo', 'importo', 'totale'])) ?? 0,
      priceUnit: (normalizePriceUnit(getField(rawFields, ['unita', 'unit', 'price unit'])) ?? 'fixed') as PriceUnit,
      vatRate: parseItalianNumber(getField(rawFields, ['iva', 'vat', 'vat rate'])) ?? 22,
      estimatedHours: parseItalianNumber(getField(rawFields, ['ore stimate', 'estimated hours', 'ore'])) ?? 0,
      internalCost: parseItalianNumber(getField(rawFields, ['costo interno', 'internal cost'])) ?? 0,
      targetMargin: parseItalianNumber(getField(rawFields, ['margine target', 'target margin'])) ?? 0,
      active,
      color: '#b0d62e',
    },
    relationshipHints: [],
    warnings,
  };
}

function normalizeProject(rawFields: Record<string, unknown>, warnings: ImportWarning[]) {
  const relationshipHints = [
    relationHint('clientId', 'client', getField(rawFields, ['cliente', 'client'])),
    relationHint('serviceId', 'service', getField(rawFields, ['servizio', 'service'])),
  ].filter(Boolean) as ImportRelationshipHint[];

  return {
    normalizedFields: {
      code: sanitizeText(getField(rawFields, ['code', 'codice'])) || undefined,
      name: sanitizeText(getField(rawFields, ['nome progetto', 'progetto', 'project name', 'name', 'title'])),
      description: sanitizeText(getField(rawFields, ['description', 'descrizione', 'note'])) || undefined,
      websiteUrl: sanitizeText(getField(rawFields, ['website', 'sito', 'url', 'sito web'])) || undefined,
      status: resolveStatusWarning('project', getField(rawFields, ['status', 'stato']), warnings) ?? 'planned',
      priority: normalizePriority(getField(rawFields, ['priority', 'priorita'])) ?? 'medium',
      contractValue: parseItalianNumber(getField(rawFields, ['valore', 'valore contrattuale', 'contract value', 'budget progetto'])) ?? 0,
      budget: parseItalianNumber(getField(rawFields, ['budget costi', 'costi', 'cost budget', 'budget'])) ?? 0,
      estimatedHours: parseItalianNumber(getField(rawFields, ['ore', 'ore stimate', 'estimated hours'])) ?? 0,
      dueDate: parseItalianDate(getField(rawFields, ['scadenza', 'deadline', 'due date'])) ?? undefined,
      health: 'on_track',
      progress: parseItalianNumber(getField(rawFields, ['progress', 'avanzamento'])) ?? 0,
      color: '#b0d62e',
      tags: ensureArray(getField(rawFields, ['tags'])),
    },
    relationshipHints,
    warnings,
  };
}

function buildDocumentItems(rawFields: Record<string, unknown>, warnings: ImportWarning[]) {
  const total = parseItalianNumber(getField(rawFields, ['totale', 'total', 'importo', 'valore']));
  if (total === undefined) {
    warnings.push({ code: 'missing_total', message: 'Totale non riconosciuto: verrà creata una riga da 0.', level: 'warning' });
  }
  return [
    {
      id: uid(),
      serviceId: undefined,
      description: sanitizeText(getField(rawFields, ['descrizione', 'description', 'servizio', 'service'])) || 'Import markdown',
      quantity: parseItalianNumber(getField(rawFields, ['quantita', 'quantity'])) ?? 1,
      unit: (normalizePriceUnit(getField(rawFields, ['unita', 'unit'])) ?? 'fixed') as PriceUnit,
      unitPrice: total ?? 0,
      discountPct: parseItalianNumber(getField(rawFields, ['sconto', 'discount'])) ?? 0,
      vatRate: parseItalianNumber(getField(rawFields, ['iva', 'vat'])) ?? 22,
    },
  ];
}

function normalizeEstimate(rawFields: Record<string, unknown>, warnings: ImportWarning[]) {
  const relationshipHints = [
    relationHint('clientId', 'client', getField(rawFields, ['cliente', 'client'])),
  ].filter(Boolean) as ImportRelationshipHint[];

  return {
    normalizedFields: {
      number: sanitizeText(getField(rawFields, ['numero', 'number', 'numero preventivo'])) || undefined,
      version: parseItalianNumber(getField(rawFields, ['versione', 'version'])) ?? 1,
      status: resolveStatusWarning('estimate', getField(rawFields, ['status', 'stato']), warnings) ?? 'draft',
      currency: sanitizeText(getField(rawFields, ['currency', 'valuta'])) || 'EUR',
      issueDate: parseItalianDate(getField(rawFields, ['issue date', 'data emissione', 'data'])) ?? todayISO(),
      expiryDate: parseItalianDate(getField(rawFields, ['expiry date', 'validita', 'data scadenza'])) ?? undefined,
      items: buildDocumentItems(rawFields, warnings),
      globalDiscountPct: parseItalianNumber(getField(rawFields, ['sconto globale', 'global discount'])) ?? 0,
      depositPct: parseItalianNumber(getField(rawFields, ['acconto', 'deposito'])) ?? 0,
      notes: sanitizeText(getField(rawFields, ['notes', 'note'])) || undefined,
      terms: sanitizeText(getField(rawFields, ['terms', 'termini'])) || undefined,
    },
    relationshipHints,
    warnings,
  };
}

function normalizeContract(rawFields: Record<string, unknown>, warnings: ImportWarning[]) {
  const relationshipHints = [
    relationHint('clientId', 'client', getField(rawFields, ['cliente', 'client'])),
    relationHint('projectId', 'project', getField(rawFields, ['progetto', 'project'])),
    relationHint('estimateId', 'estimate', getField(rawFields, ['preventivo', 'estimate'])),
  ].filter(Boolean) as ImportRelationshipHint[];

  return {
    normalizedFields: {
      number: sanitizeText(getField(rawFields, ['numero contratto', 'numero', 'number'])) || undefined,
      title: sanitizeText(getField(rawFields, ['titolo', 'title', 'contratto', 'name'])) || 'Contratto importato',
      type: sanitizeText(getField(rawFields, ['tipo', 'type'])) || 'single_project',
      status: resolveStatusWarning('contract', getField(rawFields, ['status', 'stato']), warnings) ?? 'draft',
      value: parseItalianNumber(getField(rawFields, ['valore', 'value', 'totale'])) ?? 0,
      startDate: parseItalianDate(getField(rawFields, ['data inizio', 'start date'])) ?? undefined,
      endDate: parseItalianDate(getField(rawFields, ['data fine', 'end date', 'scadenza'])) ?? undefined,
      paymentTerms: sanitizeText(getField(rawFields, ['payment terms', 'termini pagamento'])) || undefined,
      terms: sanitizeText(getField(rawFields, ['terms', 'termini', 'note'])) || undefined,
      signedByClient: parseBooleanValue(getField(rawFields, ['firmato cliente', 'signed by client'])) ?? false,
      signedByStudio: parseBooleanValue(getField(rawFields, ['firmato studio', 'signed by studio'])) ?? false,
      notes: sanitizeText(getField(rawFields, ['notes', 'note'])) || undefined,
    },
    relationshipHints,
    warnings,
  };
}

function normalizeInvoice(rawFields: Record<string, unknown>, warnings: ImportWarning[]) {
  const relationshipHints = [
    relationHint('clientId', 'client', getField(rawFields, ['cliente', 'client'])),
    relationHint('projectId', 'project', getField(rawFields, ['progetto', 'project'])),
    relationHint('estimateId', 'estimate', getField(rawFields, ['preventivo', 'estimate'])),
  ].filter(Boolean) as ImportRelationshipHint[];

  return {
    normalizedFields: {
      number: sanitizeText(getField(rawFields, ['numero fattura', 'numero', 'number'])) || undefined,
      status: resolveStatusWarning('invoice', getField(rawFields, ['status', 'stato']), warnings) ?? 'draft',
      currency: sanitizeText(getField(rawFields, ['currency', 'valuta'])) || 'EUR',
      issueDate: parseItalianDate(getField(rawFields, ['issue date', 'data emissione', 'data'])) ?? todayISO(),
      dueDate: parseItalianDate(getField(rawFields, ['due date', 'data scadenza', 'scadenza'])) ?? undefined,
      items: buildDocumentItems(rawFields, warnings),
      globalDiscountPct: parseItalianNumber(getField(rawFields, ['sconto globale', 'global discount'])) ?? 0,
      withholdingPct: parseItalianNumber(getField(rawFields, ['ritenuta', 'withholding'])) ?? 0,
      paymentMethod: (normalizePaymentMethod(getField(rawFields, ['metodo', 'payment method'])) ?? 'bank_transfer') as PaymentMethod,
      notes: sanitizeText(getField(rawFields, ['notes', 'note'])) || undefined,
    },
    relationshipHints,
    warnings,
  };
}

function normalizePayment(rawFields: Record<string, unknown>, warnings: ImportWarning[]) {
  const relationshipHints = [
    relationHint('clientId', 'client', getField(rawFields, ['cliente', 'client'])),
    relationHint('projectId', 'project', getField(rawFields, ['progetto', 'project'])),
    relationHint('invoiceId', 'invoice', getField(rawFields, ['fattura', 'invoice'])),
  ].filter(Boolean) as ImportRelationshipHint[];

  const reference = sanitizeText(getField(rawFields, ['reference', 'referenza', 'rata']));

  return {
    normalizedFields: {
      amount: parseItalianNumber(getField(rawFields, ['importo', 'amount', 'totale'])) ?? 0,
      currency: sanitizeText(getField(rawFields, ['currency', 'valuta'])) || 'EUR',
      date: parseItalianDate(getField(rawFields, ['data', 'date'])) ?? todayISO(),
      method: (normalizePaymentMethod(getField(rawFields, ['metodo', 'payment method'])) ?? 'bank_transfer') as PaymentMethod,
      reference: reference || undefined,
      status: resolveStatusWarning('payment', getField(rawFields, ['status', 'stato', 'pagato']), warnings) ?? 'pending',
      notes: sanitizeText(getField(rawFields, ['notes', 'note'])) || undefined,
    },
    relationshipHints,
    warnings,
  };
}

function normalizeTransaction(rawFields: Record<string, unknown>, warnings: ImportWarning[]) {
  const relationshipHints = [
    relationHint('clientId', 'client', getField(rawFields, ['cliente', 'client'])),
    relationHint('projectId', 'project', getField(rawFields, ['progetto', 'project'])),
  ].filter(Boolean) as ImportRelationshipHint[];

  return {
    normalizedFields: {
      type: normalizeIdentity(sanitizeText(getField(rawFields, ['tipo', 'type']))) === 'entrata' ? 'income' : 'expense',
      category: sanitizeText(getField(rawFields, ['categoria', 'category'])) || 'Generale',
      description: sanitizeText(getField(rawFields, ['descrizione', 'description', 'title'])) || 'Movimento importato',
      amount: parseItalianNumber(getField(rawFields, ['importo', 'amount', 'totale'])) ?? 0,
      currency: sanitizeText(getField(rawFields, ['currency', 'valuta'])) || 'EUR',
      date: parseItalianDate(getField(rawFields, ['data', 'date'])) ?? todayISO(),
      vendor: sanitizeText(getField(rawFields, ['fornitore', 'vendor'])) || undefined,
      method: normalizePaymentMethod(getField(rawFields, ['metodo', 'payment method'])) as PaymentMethod | undefined,
      notes: sanitizeText(getField(rawFields, ['notes', 'note'])) || undefined,
    },
    relationshipHints,
    warnings,
  };
}

function normalizeEvent(rawFields: Record<string, unknown>, warnings: ImportWarning[]) {
  const relationshipHints = [
    relationHint('clientId', 'client', getField(rawFields, ['cliente', 'client'])),
    relationHint('projectId', 'project', getField(rawFields, ['progetto', 'project'])),
  ].filter(Boolean) as ImportRelationshipHint[];

  const start = parseItalianDate(getField(rawFields, ['inizio', 'start', 'data', 'datetime']), true)
    ?? parseItalianDate(getField(rawFields, ['data', 'date']), false)
    ?? new Date().toISOString();

  const end = parseItalianDate(getField(rawFields, ['fine', 'end']), true)
    ?? (start.includes('T') ? new Date(new Date(start).getTime() + 60 * 60_000).toISOString() : `${start}T10:00:00.000Z`);

  return {
    normalizedFields: {
      title: sanitizeText(getField(rawFields, ['titolo', 'title', 'evento', 'meeting'])) || 'Evento importato',
      type: (resolveStatusWarning('event', getField(rawFields, ['tipo', 'type']), warnings) ?? 'custom') as CalendarEventType,
      start,
      end,
      allDay: !String(start).includes('T'),
      location: sanitizeText(getField(rawFields, ['luogo', 'location'])) || undefined,
      meetingLink: sanitizeText(getField(rawFields, ['link', 'meeting link'])) || undefined,
      description: sanitizeText(getField(rawFields, ['descrizione', 'description', 'note'])) || undefined,
      reminderMinutes: parseItalianNumber(getField(rawFields, ['reminder', 'promemoria'])) ?? 30,
      visibility: 'team',
      attendeeIds: [],
    },
    relationshipHints,
    warnings,
  };
}

function normalizeCandidate(entityType: ImportEntityType, rawFields: Record<string, unknown>) {
  const warnings: ImportWarning[] = [];
  switch (entityType) {
    case 'client':
      return normalizeClient(rawFields, warnings);
    case 'service':
      return normalizeService(rawFields, warnings);
    case 'project':
      return normalizeProject(rawFields, warnings);
    case 'estimate':
      return normalizeEstimate(rawFields, warnings);
    case 'contract':
      return normalizeContract(rawFields, warnings);
    case 'invoice':
      return normalizeInvoice(rawFields, warnings);
    case 'payment':
      return normalizePayment(rawFields, warnings);
    case 'transaction':
      return normalizeTransaction(rawFields, warnings);
    case 'event':
      return normalizeEvent(rawFields, warnings);
  }
}

function validateCandidate(candidate: ImportCandidate) {
  const warnings = [...candidate.warnings];
  const fields = candidate.normalizedFields;
  const requiredByType: Partial<Record<ImportEntityType, string[]>> = {
    client: ['displayName'],
    service: ['name'],
    project: ['name'],
    estimate: ['number', 'issueDate'],
    contract: ['title'],
    invoice: ['number', 'issueDate'],
    payment: ['amount', 'date'],
    transaction: ['description', 'amount', 'date'],
    event: ['title', 'start', 'end'],
  };

  for (const field of requiredByType[candidate.entityType] ?? []) {
    const value = fields[field];
    if (value === undefined || value === '' || value === null) {
      warnings.push({ code: 'required_field', message: `Campo obbligatorio mancante: ${field}`, field, level: 'error' });
    }
  }

  return warnings;
}

function buildPaymentCandidatesFromTable(section: ParsedMarkdownSection, document: ParsedMarkdownFile, confidence: number) {
  const paymentCandidates: ImportCandidate[] = [];
  section.tables.forEach((table) => {
    const normalizedHeaders = table.headers.map((header) => normalizeLabel(header));
    if (!normalizedHeaders.includes('importo') && !normalizedHeaders.includes('amount')) return;
    table.rows.forEach((row) => {
      const rawFields = collectRawFields(
        {
          ...section,
          fields: Object.fromEntries(
            Object.entries(row).map(([key, value]) => [normalizeLabel(key), value]),
          ),
        },
        document,
      );
      const normalized = normalizeCandidate('payment', rawFields);
      const candidate: ImportCandidate = {
        temporaryId: toTemporaryId(),
        entityType: 'payment',
        sourceFile: document.fileName,
        sourceSection: section.heading,
        confidence,
        rawFields,
        normalizedFields: normalized.normalizedFields,
        relationshipHints: normalized.relationshipHints,
        warnings: [],
        duplicateStatus: 'new',
        action: 'create',
        importState: 'pending',
      };
      candidate.warnings = validateCandidate({ ...candidate, warnings: normalized.warnings });
      candidate.duplicateStatus = candidate.warnings.some((warning) => warning.level === 'error') ? 'invalid' : 'new';
      paymentCandidates.push(candidate);
    });
  });
  return paymentCandidates;
}

function candidateFromSection(document: ParsedMarkdownFile, section: ParsedMarkdownSection, frontmatterType?: string) {
  if ((section.heading && normalizeIdentity(section.heading).includes('pagament')) || looksLikePaymentTable(section)) {
    const paymentRows = buildPaymentCandidatesFromTable(section, document, 0.92);
    if (paymentRows.length > 0) return paymentRows;
  }

  const { entityType, confidence, ambiguous } = scoreEntityType(section, frontmatterType);
  if (!entityType || confidence < 0.32) return [];

  if (entityType === 'payment') {
    const paymentRows = buildPaymentCandidatesFromTable(section, document, confidence);
    if (paymentRows.length > 0) return paymentRows;
  }

  const rawFields = collectRawFields(section, document);
  const normalized = normalizeCandidate(entityType, rawFields);
  const candidate: ImportCandidate = {
    temporaryId: toTemporaryId(),
    entityType,
    sourceFile: document.fileName,
    sourceSection: section.heading || document.title,
    confidence: ambiguous ? Math.max(0.45, confidence - 0.18) : confidence,
    rawFields,
    normalizedFields: normalized.normalizedFields,
    relationshipHints: normalized.relationshipHints,
    warnings: [],
    duplicateStatus: 'new',
    action: 'create',
    importState: 'pending',
  };
  const warnings = [...normalized.warnings];
  if (ambiguous) {
    warnings.push({ code: 'ambiguous_type', message: 'Tipo entità da verificare manualmente.', level: 'warning' });
  }
  candidate.warnings = validateCandidate({ ...candidate, warnings });
  candidate.duplicateStatus = candidate.warnings.some((warning) => warning.level === 'error') ? 'invalid' : 'new';
  return [candidate];
}

function attachBatchRelationHints(candidates: ImportCandidate[]) {
  const identityMap = new Map<string, string[]>();
  candidates.forEach((candidate) => {
    const businessIdentity = String(
      candidate.normalizedFields.displayName
        ?? candidate.normalizedFields.name
        ?? candidate.normalizedFields.number
        ?? candidate.normalizedFields.title
        ?? '',
    );
    const key = `${candidate.entityType}:${normalizeIdentity(businessIdentity)}`;
    if (!key.endsWith(':')) {
      identityMap.set(key, [...(identityMap.get(key) ?? []), candidate.temporaryId]);
    }
  });

  candidates.forEach((candidate) => {
    candidate.relationshipHints = candidate.relationshipHints.map((hint) => {
      const ids = identityMap.get(`${hint.targetType}:${hint.normalizedValue}`) ?? [];
      if (ids.length === 1) {
        return { ...hint, matchedCandidateId: ids[0] };
      }
      if (ids.length > 1) {
        return { ...hint, ambiguousIds: ids };
      }
      return hint;
    });
  });
}

export function analyzeParsedMarkdown(files: ParsedMarkdownFile[]): ImportAnalysisResult {
  const candidates = files.flatMap((document) => {
    const frontmatterType = sanitizeText(document.frontmatter.bns_type ?? document.frontmatter.type);
    const directDocumentCandidate = frontmatterType
      ? candidateFromSection(document, document.rootSection, frontmatterType)
      : [];
    const sectionCandidates = document.sections.flatMap((section) => candidateFromSection(document, section));
    return [...directDocumentCandidate, ...sectionCandidates];
  });

  attachBatchRelationHints(candidates);

  return {
    candidates,
    fileCount: files.length,
    candidateCount: candidates.length,
  };
}

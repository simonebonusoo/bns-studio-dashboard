import type { ImportCandidate, ImportEntityType } from './types';

type Option = { value: string; label: string };

export const CANONICAL_BNS_ENTITY_TYPES = ['client', 'project', 'estimate', 'contract', 'invoice', 'payment', 'bundle'] as const;

export const BNS_ENTITY_LABELS: Record<(typeof CANONICAL_BNS_ENTITY_TYPES)[number], string> = {
  client: 'Cliente',
  project: 'Progetto',
  estimate: 'Preventivo',
  contract: 'Contratto',
  invoice: 'Fattura',
  payment: 'Pagamento',
  bundle: 'Documento completo',
};

export const FIELD_LABELS: Record<string, string> = {
  type: 'Tipo',
  displayName: 'Nome',
  companyName: 'Ragione sociale',
  firstName: 'Nome',
  lastName: 'Cognome',
  name: 'Nome progetto',
  title: 'Titolo',
  number: 'Numero',
  email: 'Email',
  phone: 'Telefono',
  website: 'Sito web',
  websiteUrl: 'Sito web',
  vat: 'Partita IVA',
  city: 'Citta',
  sector: 'Settore',
  source: 'Fonte',
  status: 'Stato',
  priority: 'Priorita',
  notes: 'Note',
  tags: 'Tag',
  description: 'Descrizione',
  clientId: 'Cliente',
  projectId: 'Progetto',
  serviceId: 'Servizio',
  estimateId: 'Preventivo',
  invoiceId: 'Fattura',
  code: 'Codice',
  contractValue: 'Valore',
  budget: 'Budget',
  estimatedHours: 'Ore stimate',
  startDate: 'Data inizio',
  dueDate: 'Scadenza',
  endDate: 'Data fine',
  issueDate: 'Data emissione',
  expiryDate: 'Valido fino al',
  currency: 'Valuta',
  items: 'Voci',
  globalDiscountPct: 'Sconto globale',
  depositPct: 'Acconto',
  withholdingPct: 'Ritenuta',
  paymentMethod: 'Metodo pagamento',
  method: 'Metodo',
  amount: 'Importo',
  date: 'Data',
  reference: 'Riferimento',
  installments: 'Piano rate',
  paymentType: 'Tipo pagamento',
  recurrence: 'Ricorrenza',
  billingFrequency: 'Frequenza fatturazione',
  renewalType: 'Rinnovo',
  value: 'Importo',
  paymentTerms: 'Termini pagamento',
  terms: 'Condizioni e clausole',
  signedByClient: 'Firmato dal cliente',
  signedByStudio: 'Firmato dallo studio',
  category: 'Categoria',
  basePrice: 'Prezzo base',
  priceUnit: 'Unita prezzo',
  vatRate: 'IVA',
  active: 'Attivo',
};

const HIDDEN_FIELDS = new Set([
  'id',
  'organizationId',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'createdBy',
  'sourceId',
  'sourceType',
  'automatic',
  'health',
  'progress',
  'color',
  'memberIds',
  'managerId',
  'companyId',
  'opportunityId',
  'acceptedAt',
  'rejectedReason',
  'pdfName',
  'pdfUrl',
]);

export const FIELD_ORDER: Partial<Record<ImportEntityType, string[]>> = {
  client: ['displayName', 'companyName', 'email', 'phone', 'website', 'vat', 'city', 'sector', 'source', 'status', 'priority', 'notes', 'tags'],
  project: ['name', 'clientId', 'serviceId', 'status', 'priority', 'contractValue', 'budget', 'startDate', 'dueDate', 'websiteUrl', 'description', 'notes', 'tags'],
  estimate: ['title', 'number', 'clientId', 'projectId', 'status', 'expiryDate', 'items', 'globalDiscountPct', 'depositPct', 'terms', 'notes'],
  contract: ['title', 'clientId', 'projectId', 'type', 'status', 'startDate', 'endDate', 'recurrence', 'billingFrequency', 'value', 'renewalType', 'paymentTerms', 'terms', 'notes'],
  invoice: ['number', 'clientId', 'projectId', 'estimateId', 'issueDate', 'dueDate', 'status', 'paymentMethod', 'items', 'globalDiscountPct', 'withholdingPct', 'notes'],
  payment: ['clientId', 'invoiceId', 'amount', 'date', 'method', 'status', 'paymentType', 'installments', 'reference', 'notes'],
};

export const STATUS_OPTIONS: Partial<Record<ImportEntityType, Option[]>> = {
  client: [
    { value: 'lead', label: 'Lead' },
    { value: 'prospect', label: 'Prospect' },
    { value: 'active', label: 'Attivo' },
    { value: 'inactive', label: 'Inattivo' },
    { value: 'past_client', label: 'Ex cliente' },
    { value: 'partner', label: 'Partner' },
    { value: 'archived', label: 'Archiviato' },
  ],
  project: [
    { value: 'lead', label: 'Lead' },
    { value: 'draft', label: 'Bozza' },
    { value: 'planned', label: 'Pianificato' },
    { value: 'active', label: 'Attivo' },
    { value: 'waiting_client', label: 'In attesa cliente' },
    { value: 'review', label: 'In revisione' },
    { value: 'paused', label: 'In pausa' },
    { value: 'completed', label: 'Completato' },
    { value: 'cancelled', label: 'Annullato' },
    { value: 'archived', label: 'Archiviato' },
  ],
  estimate: [
    { value: 'draft', label: 'Bozza' },
    { value: 'internal_review', label: 'Revisione interna' },
    { value: 'sent', label: 'Inviato' },
    { value: 'viewed', label: 'Visualizzato' },
    { value: 'accepted', label: 'Accettato' },
    { value: 'rejected', label: 'Rifiutato' },
    { value: 'expired', label: 'Scaduto' },
    { value: 'cancelled', label: 'Annullato' },
    { value: 'superseded', label: 'Sostituito' },
  ],
  contract: [
    { value: 'draft', label: 'Bozza' },
    { value: 'sent', label: 'Inviato' },
    { value: 'awaiting_signature', label: 'In attesa firma' },
    { value: 'active', label: 'Attivo' },
    { value: 'expired', label: 'Scaduto' },
    { value: 'terminated', label: 'Terminato' },
    { value: 'cancelled', label: 'Annullato' },
    { value: 'archived', label: 'Archiviato' },
  ],
  invoice: [
    { value: 'draft', label: 'Bozza' },
    { value: 'issued', label: 'Emessa' },
    { value: 'sent', label: 'Inviata' },
    { value: 'viewed', label: 'Vista' },
    { value: 'partially_paid', label: 'Parzialmente pagata' },
    { value: 'paid', label: 'Pagata' },
    { value: 'overdue', label: 'Scaduta' },
    { value: 'cancelled', label: 'Annullata' },
    { value: 'credited', label: 'Stornata' },
  ],
  payment: [
    { value: 'pending', label: 'In attesa' },
    { value: 'completed', label: 'Pagato' },
    { value: 'failed', label: 'Fallito' },
    { value: 'refunded', label: 'Rimborsato' },
    { value: 'partially_refunded', label: 'Parzialmente rimborsato' },
    { value: 'cancelled', label: 'Annullato' },
  ],
};

export const PRIORITY_OPTIONS: Option[] = [
  { value: 'low', label: 'Bassa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export const PAYMENT_METHOD_OPTIONS: Option[] = [
  { value: 'bank_transfer', label: 'Bonifico' },
  { value: 'card', label: 'Carta' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'cash', label: 'Contanti' },
  { value: 'cheque', label: 'Assegno' },
  { value: 'other', label: 'Altro' },
];

export const CONTRACT_TYPE_OPTIONS: Option[] = [
  { value: 'single_project', label: 'Progetto singolo' },
  { value: 'maintenance', label: 'Manutenzione' },
  { value: 'collaboration', label: 'Collaborazione' },
  { value: 'consulting', label: 'Consulenza' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'software', label: 'Software' },
  { value: 'license', label: 'Licenza' },
  { value: 'custom', label: 'Personalizzato' },
];

export const RECURRENCE_OPTIONS: Option[] = [
  { value: 'one_time', label: 'Una tantum' },
  { value: 'monthly', label: 'Mensile' },
  { value: 'quarterly', label: 'Trimestrale' },
  { value: 'semiannual', label: 'Semestrale' },
  { value: 'annual', label: 'Annuale' },
  { value: 'custom', label: 'Personalizzato' },
];

export const RENEWAL_OPTIONS: Option[] = [
  { value: 'none', label: 'Nessun rinnovo' },
  { value: 'manual', label: 'Manuale' },
  { value: 'automatic', label: 'Automatico' },
];

export const INSTALLMENT_STATUS_OPTIONS: Option[] = [
  { value: 'scheduled', label: 'Prevista' },
  { value: 'due_soon', label: 'In scadenza' },
  { value: 'paid', label: 'Pagata' },
  { value: 'overdue', label: 'Scaduta' },
  { value: 'cancelled', label: 'Annullata' },
];

export function fieldLabel(fieldKey: string) {
  return FIELD_LABELS[fieldKey] ?? fieldKey;
}

export function shouldShowField(fieldKey: string, value: unknown) {
  if (HIDDEN_FIELDS.has(fieldKey)) return false;
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0 || ['items', 'installments', 'tags'].includes(fieldKey);
  return true;
}

export function orderedFieldEntries(entityType: ImportEntityType, fields: Record<string, unknown>) {
  const order = FIELD_ORDER[entityType] ?? [];
  const keys = [...new Set([...order, ...Object.keys(fields)])];
  return keys
    .filter((key) => shouldShowField(key, fields[key]))
    .map((key) => [key, fields[key]] as const);
}

export function formatConfidenceLabel(confidence: number) {
  if (confidence >= 0.82) return 'Riconoscimento sicuro';
  if (confidence >= 0.55) return 'Da controllare';
  return 'Tipo incerto';
}

export function formatDuplicateLabel(status: ImportCandidate['duplicateStatus'], entityType?: ImportEntityType) {
  const entity = entityType ? (BNS_ENTITY_LABELS[entityType as keyof typeof BNS_ENTITY_LABELS]?.toLowerCase() ?? 'record') : 'record';
  return {
    new: `Crea nuovo ${entity}`,
    existing_identical: 'Gia presente',
    existing_different: 'Record esistente trovato',
    ambiguous_match: 'Corrispondenza ambigua',
    invalid: 'Da correggere',
  }[status];
}

export function formatEnumLabel(fieldKey: string, value: unknown, entityType?: ImportEntityType) {
  const text = String(value ?? '');
  if (!text) return '';
  const options = getFieldOptions(entityType, fieldKey);
  return options?.find((option) => option.value === text)?.label ?? text;
}

export function getFieldOptions(entityType: ImportEntityType | undefined, fieldKey: string): Option[] | undefined {
  if (fieldKey === 'status' && entityType) return STATUS_OPTIONS[entityType];
  if (fieldKey === 'priority') return PRIORITY_OPTIONS;
  if (fieldKey === 'method' || fieldKey === 'paymentMethod') return PAYMENT_METHOD_OPTIONS;
  if (fieldKey === 'type' && entityType === 'contract') return CONTRACT_TYPE_OPTIONS;
  if (fieldKey === 'recurrence' || fieldKey === 'billingFrequency') return RECURRENCE_OPTIONS;
  if (fieldKey === 'renewalType') return RENEWAL_OPTIONS;
  if (fieldKey === 'paymentType') return [
    { value: 'single', label: 'Unico' },
    { value: 'installments', label: 'Rateizzato' },
  ];
  return undefined;
}

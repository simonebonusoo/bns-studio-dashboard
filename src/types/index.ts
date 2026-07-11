import type {
  Role,
  ClientType,
  ClientStatus,
  Priority,
  ProjectStatus,
  ProjectHealth,
  TaskStatus,
  MilestoneStatus,
  OpportunityStage,
  EstimateStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  TransactionType,
  PriceUnit,
  CalendarEventType,
  NotificationType,
} from './enums';

export * from './enums';

/** Campi comuni a (quasi) tutte le entità. */
export interface BaseEntity {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  createdBy?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  currency: string;
  locale: string;
  timezone: string;
  vat?: string;
  createdAt: string;
}

export interface Member extends BaseEntity {
  firstName: string;
  lastName: string;
  email: string;
  avatarColor: string;
  role: Role;
  jobTitle: string;
  skills: string[];
  weeklyHours: number; // capacità settimanale
  internalRate: number; // costo interno €/h
  clientRate: number; // tariffa cliente €/h
  collaborationType:
    | 'founder'
    | 'employee'
    | 'freelance'
    | 'occasional'
    | 'intern'
    | 'consultant'
    | 'partner';
  status: 'invited' | 'active' | 'unavailable' | 'suspended' | 'inactive';
  joinedAt: string;
}

export interface Company extends BaseEntity {
  name: string;
  sector?: string;
  size?: string;
  website?: string;
  vat?: string;
  city?: string;
  country?: string;
  notes?: string;
}

export interface Client extends BaseEntity {
  type: ClientType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  displayName: string;
  email?: string;
  phone?: string;
  website?: string;
  vat?: string;
  taxCode?: string;
  address?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  sector?: string;
  source?: string;
  status: ClientStatus;
  priority: Priority;
  ownerId?: string; // membro responsabile
  tags: string[];
  notes?: string;
  lastContactAt?: string | null;
  nextContactAt?: string | null;
}

export interface Opportunity extends BaseEntity {
  title: string;
  clientId?: string;
  companyId?: string;
  contactName?: string;
  stage: OpportunityStage;
  value: number; // valore stimato
  probability: number; // %
  serviceId?: string;
  source?: string;
  ownerId?: string;
  priority: Priority;
  expectedCloseDate?: string | null;
  nextFollowUpAt?: string | null;
  lostReason?: string;
  notes?: string;
  tags: string[];
  /** ordine all'interno della colonna della pipeline */
  order: number;
}

export interface Service extends BaseEntity {
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  priceUnit: PriceUnit;
  vatRate: number;
  estimatedHours?: number;
  internalCost?: number;
  targetMargin?: number; // %
  active: boolean;
  color: string;
}

export interface Project extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  clientId?: string;
  companyId?: string;
  managerId?: string;
  memberIds: string[];
  serviceId?: string;
  status: ProjectStatus;
  priority: Priority;
  health: ProjectHealth;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  contractValue: number; // valore contrattuale
  budget: number; // budget di costo
  estimatedHours: number;
  targetMargin?: number;
  progress: number; // 0-100 (derivato dai task)
  color: string;
  tags: string[];
}

export interface Milestone extends BaseEntity {
  projectId: string;
  title: string;
  description?: string;
  status: MilestoneStatus;
  dueDate?: string | null;
  completedAt?: string | null;
  clientVisible: boolean;
  order: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task extends BaseEntity {
  projectId: string;
  milestoneId?: string | null;
  parentTaskId?: string | null;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assigneeIds: string[];
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number;
  checklist?: ChecklistItem[];
  clientVisible: boolean;
  completedAt?: string | null;
  order: number;
  tags: string[];
}

export interface TimeEntry extends BaseEntity {
  memberId: string;
  projectId?: string | null;
  taskId?: string | null;
  clientId?: string | null;
  description: string;
  date: string; // YYYY-MM-DD
  startedAt: string; // ISO
  durationMinutes: number;
  billable: boolean;
  hourlyRate?: number; // tariffa applicata
  internalCost?: number;
  approved: boolean;
  running: boolean; // timer attivo
}

export interface DocumentLineItem {
  id: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unit: PriceUnit;
  unitPrice: number;
  discountPct: number; // sconto riga %
  vatRate: number;
}

export interface Estimate extends BaseEntity {
  number: string;
  version: number;
  clientId?: string;
  opportunityId?: string;
  status: EstimateStatus;
  currency: string;
  issueDate: string;
  expiryDate?: string | null;
  items: DocumentLineItem[];
  globalDiscountPct: number;
  depositPct?: number; // acconto richiesto %
  notes?: string;
  terms?: string;
  acceptedAt?: string | null;
  rejectedReason?: string;
}

export interface Invoice extends BaseEntity {
  number: string;
  clientId?: string;
  projectId?: string;
  estimateId?: string;
  status: InvoiceStatus;
  currency: string;
  issueDate: string;
  dueDate?: string | null;
  items: DocumentLineItem[];
  globalDiscountPct: number;
  withholdingPct?: number; // ritenuta d'acconto %
  notes?: string;
  paymentMethod?: PaymentMethod;
}

export interface Payment extends BaseEntity {
  clientId?: string;
  invoiceId?: string;
  projectId?: string;
  amount: number;
  currency: string;
  date: string;
  method: PaymentMethod;
  reference?: string;
  status: PaymentStatus;
  notes?: string;
}

export interface Transaction extends BaseEntity {
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  clientId?: string | null;
  projectId?: string | null;
  vendor?: string;
  method?: PaymentMethod;
  notes?: string;
}

export interface Contract extends BaseEntity {
  number: string;
  title: string;
  clientId?: string;
  projectId?: string;
  estimateId?: string;
  type:
    | 'single_project'
    | 'maintenance'
    | 'collaboration'
    | 'consulting'
    | 'retainer'
    | 'software'
    | 'license'
    | 'custom';
  status:
    | 'draft'
    | 'sent'
    | 'awaiting_signature'
    | 'active'
    | 'expired'
    | 'terminated'
    | 'cancelled'
    | 'archived';
  value: number;
  startDate?: string | null;
  endDate?: string | null;
  paymentTerms?: string;
  includedRevisions?: number;
  terms?: string;
  signedByClient: boolean;
  signedByStudio: boolean;
  /** In demo il PDF firmato è salvato come data-URI in IndexedDB. */
  pdfName?: string;
  pdfUrl?: string;
  notes?: string;
}

export interface FileItem extends BaseEntity {
  name: string;
  mime: string;
  size: number; // bytes
  projectId?: string | null;
  clientId?: string | null;
  taskId?: string | null;
  folder?: string;
  clientVisible: boolean;
  uploadedBy?: string;
  /** In demo: URL esterno o data-uri. In produzione: path Storage. */
  url?: string;
  tags: string[];
}

export interface CalendarEvent extends BaseEntity {
  title: string;
  type: CalendarEventType;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  clientId?: string | null;
  projectId?: string | null;
  attendeeIds?: string[];
  location?: string;
  meetingLink?: string;
  description?: string;
  reminderMinutes?: number;
  visibility?: 'internal' | 'team' | 'client';
}

export interface Comment extends BaseEntity {
  entityType: 'project' | 'task' | 'file' | 'deliverable' | 'revision';
  entityId: string;
  authorId: string;
  content: string;
  visibility: 'internal' | 'team' | 'client';
  edited: boolean;
}

export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
}

export interface ActivityLog extends BaseEntity {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface DocItem extends BaseEntity {
  title: string;
  type: string;
  content: string; // HTML/markdown semplice
  projectId?: string | null;
  clientId?: string | null;
  tags: string[];
  authorId?: string;
}

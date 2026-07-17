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
  InstallmentStatus,
  DocumentCategory,
  DocumentSourceType,
  RecurrenceFrequency,
  ContractRecurrence,
  RenewalType,
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
  email?: string | null;
  currency: string;
  locale: string;
  timezone: string;
  vat?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Member extends BaseEntity {
  firstName: string;
  lastName: string;
  email: string;
  displayName?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
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
  websiteUrl?: string | null;
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

export interface PaymentInstallment extends BaseEntity {
  paymentId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidAt?: string | null;
  status: InstallmentStatus;
  notes?: string | null;
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
  sourceType?: 'manual' | 'payment' | 'payment_installment';
  sourceId?: string | null;
  sourceLabel?: string | null;
  automatic?: boolean;
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
  recurrence?: ContractRecurrence;
  billingFrequency?: ContractRecurrence;
  renewalType?: RenewalType;
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
  entityType?: DocumentSourceType | null;
  entityId?: string | null;
  documentCategory?: DocumentCategory;
  /** Cartella testuale legacy (retrocompatibilità). Non più usata dall'Archivio a cartelle. */
  folder?: string;
  /** Cartella custom/sistema di appartenenza. NULL = radice progetto virtuale o "non organizzati". */
  folderId?: string | null;
  clientVisible: boolean;
  uploadedBy?: string;
  /** In demo: URL esterno o data-uri. In produzione: path Storage. */
  url?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

/** Tipo di cartella nell'Archivio. Le cartelle-progetto sono virtuali e non hanno un record. */
export type FolderType = 'custom' | 'system';
export type FolderVisibility = 'internal' | 'client';

/** Cartella personalizzata/di sistema dell'Archivio (record reale, vedi archive_folders). */
export interface ArchiveFolder extends BaseEntity {
  parentFolderId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  name: string;
  description?: string | null;
  folderType: FolderType;
  icon?: string | null;
  color?: string | null;
  defaultVisibility?: FolderVisibility | null;
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
  recurrence?: RecurrenceFrequency;
  recurrenceUntil?: string | null;
  invitedEmails?: string[];
  notes?: string;
}

export interface Comment extends BaseEntity {
  entityType: 'project' | 'task' | 'file' | 'deliverable' | 'revision';
  entityId: string;
  authorId: string;
  content: string;
  visibility: 'internal' | 'team' | 'client';
  edited: boolean;
}

export type StudioConversationType = 'channel' | 'project' | 'dm' | 'group_dm';
export type StudioEntityType =
  | 'client'
  | 'project'
  | 'task'
  | 'estimate'
  | 'contract'
  | 'invoice'
  | 'payment'
  | 'file';

export interface StudioConversation extends BaseEntity {
  type: StudioConversationType;
  name: string;
  slug: string;
  description?: string | null;
  projectId?: string | null;
  isPrivate: boolean;
  createdBy?: string;
  archivedAt?: string | null;
}

export interface StudioConversationMember extends BaseEntity {
  conversationId: string;
  memberId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface StudioEntityReference {
  id: string;
  type: StudioEntityType;
  entityId: string;
  label: string;
  href: string;
}

export interface StudioMessageMetadata {
  mentions?: string[];
  mentionEveryone?: boolean;
  references?: StudioEntityReference[];
  legacyCommentId?: string;
}

export interface StudioMessage extends BaseEntity {
  conversationId: string;
  authorId: string;
  parentMessageId?: string | null;
  content: string;
  metadata: StudioMessageMetadata;
  edited: boolean;
  deletedAt?: string | null;
}

export interface StudioMessageReaction extends BaseEntity {
  messageId: string;
  memberId: string;
  emoji: string;
}

export interface StudioMessageSave extends BaseEntity {
  messageId: string;
  memberId: string;
}

export interface StudioConversationRead extends BaseEntity {
  conversationId: string;
  memberId: string;
  lastReadAt: string;
}

export interface StudioMessageAttachment extends BaseEntity {
  messageId: string;
  fileId: string;
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

export interface MarkdownImport extends BaseEntity {
  createdBy?: string;
  fileNames: string[];
  filesCount: number;
  candidateCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  status: 'pending' | 'completed' | 'completed_with_errors' | 'failed';
  summary: Record<string, unknown>;
}

export interface DocItem extends BaseEntity {
  title: string;
  type: string;
  content: string; // HTML/markdown semplice
  projectId?: string | null;
  clientId?: string | null;
  sourceEntityType?: DocumentSourceType | null;
  sourceEntityId?: string | null;
  representation?: 'markdown' | 'pdf' | 'html';
  version?: number;
  fileId?: string | null;
  metadata?: Record<string, unknown>;
  tags: string[];
  authorId?: string;
}

// ─────────────── Integrazione GitHub (§3-4) ───────────────

export interface GithubConnection extends BaseEntity {
  installationId?: number | null;
  accountLogin?: string | null;
  accountType?: string | null;
  accountAvatarUrl?: string | null;
  status: 'connecting' | 'connected' | 'error' | 'revoked';
  errorMessage?: string | null;
  connectedBy?: string | null;
  connectedAt?: string | null;
}

export interface ProjectRepository extends BaseEntity {
  projectId: string;
  repoId: number;
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch?: string | null;
  htmlUrl?: string | null;
  openIssues?: number | null;
  openPullRequests?: number | null;
  lastPushedAt?: string | null;
  linkedBy?: string | null;
}

/** Repo restituito da list_repos (non persistito): shape dell'API GitHub. */
export interface GithubRepo {
  repoId: number;
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch?: string;
  htmlUrl?: string;
  openIssues?: number;
  lastPushedAt?: string;
}

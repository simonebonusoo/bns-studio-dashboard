import Dexie, { type Table } from 'dexie';
import type {
  Organization,
  Member,
  Company,
  Client,
  Opportunity,
  Service,
  Project,
  Milestone,
  Task,
  TimeEntry,
  Estimate,
  Invoice,
  Payment,
  PaymentInstallment,
  Transaction,
  Contract,
  FileItem,
  CalendarEvent,
  Comment,
  Notification,
  ActivityLog,
  MarkdownImport,
  DocItem,
} from '@/types';

/** Utente demo persistito localmente (solo demo — nessuna password reale in produzione). */
export interface DemoUser {
  id: string;
  email: string;
  password: string;
  memberId: string;
  organizationId: string;
}

/**
 * Database locale (IndexedDB via Dexie) usato in MODALITÀ DEMO.
 * In produzione lo stesso service layer punta a Supabase (vedi src/services).
 */
export class BnsDatabase extends Dexie {
  users!: Table<DemoUser, string>;
  organizations!: Table<Organization, string>;
  members!: Table<Member, string>;
  companies!: Table<Company, string>;
  clients!: Table<Client, string>;
  opportunities!: Table<Opportunity, string>;
  services!: Table<Service, string>;
  projects!: Table<Project, string>;
  milestones!: Table<Milestone, string>;
  tasks!: Table<Task, string>;
  timeEntries!: Table<TimeEntry, string>;
  estimates!: Table<Estimate, string>;
  invoices!: Table<Invoice, string>;
  payments!: Table<Payment, string>;
  paymentInstallments!: Table<PaymentInstallment, string>;
  transactions!: Table<Transaction, string>;
  contracts!: Table<Contract, string>;
  files!: Table<FileItem, string>;
  events!: Table<CalendarEvent, string>;
  comments!: Table<Comment, string>;
  notifications!: Table<Notification, string>;
  activityLogs!: Table<ActivityLog, string>;
  markdownImports!: Table<MarkdownImport, string>;
  documents!: Table<DocItem, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('bns-studio-os');
    this.version(4).stores({
      users: 'id, email, memberId, organizationId',
      organizations: 'id, slug',
      members: 'id, organizationId, email, role, status',
      companies: 'id, organizationId, name',
      clients: 'id, organizationId, status, ownerId, displayName',
      opportunities: 'id, organizationId, stage, clientId, ownerId, order',
      services: 'id, organizationId, category, active',
      projects: 'id, organizationId, status, clientId, managerId, code',
      milestones: 'id, organizationId, projectId, status, order',
      tasks: 'id, organizationId, projectId, status, milestoneId, order',
      timeEntries: 'id, organizationId, memberId, projectId, taskId, date, running',
      estimates: 'id, organizationId, clientId, opportunityId, status, number',
      invoices: 'id, organizationId, clientId, projectId, status, number',
      payments: 'id, organizationId, invoiceId, clientId, status, date',
      paymentInstallments: 'id, organizationId, paymentId, status, dueDate, installmentNumber',
      transactions: 'id, organizationId, type, category, date, projectId',
      contracts: 'id, organizationId, clientId, projectId, status, number',
      files: 'id, organizationId, projectId, clientId, taskId',
      events: 'id, organizationId, type, projectId, clientId, start',
      comments: 'id, organizationId, entityType, entityId, authorId',
      notifications: 'id, organizationId, userId, read, type',
      activityLogs: 'id, organizationId, actorId, entityType, entityId',
      markdownImports: 'id, organizationId, status, createdBy, createdAt',
      documents: 'id, organizationId, projectId, clientId',
      meta: 'key',
    });
  }
}

export const db = new BnsDatabase();

export const SEED_FLAG = 'seeded_v1';

/** Enum e union di dominio condivisi. */

export type Role =
  | 'owner'
  | 'admin'
  | 'project_manager'
  | 'designer'
  | 'developer'
  | 'collaborator'
  | 'accountant'
  | 'client';

export const ROLES: Role[] = [
  'owner',
  'admin',
  'project_manager',
  'designer',
  'developer',
  'collaborator',
  'accountant',
  'client',
];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Proprietario',
  admin: 'Amministratore',
  project_manager: 'Project Manager',
  designer: 'Designer',
  developer: 'Developer',
  collaborator: 'Collaboratore',
  accountant: 'Contabile',
  client: 'Cliente',
};

export type ClientType = 'person' | 'company';
export type ClientStatus =
  | 'lead'
  | 'prospect'
  | 'active'
  | 'inactive'
  | 'past_client'
  | 'partner'
  | 'archived';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type ProjectStatus =
  | 'lead'
  | 'draft'
  | 'planned'
  | 'active'
  | 'waiting_client'
  | 'review'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type ProjectHealth = 'on_track' | 'attention' | 'at_risk' | 'blocked';

export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'internal_review'
  | 'client_review'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export const TASK_COLUMNS: TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'internal_review',
  'client_review',
  'blocked',
  'completed',
];

export type MilestoneStatus =
  | 'planned'
  | 'active'
  | 'awaiting_approval'
  | 'approved'
  | 'completed'
  | 'delayed'
  | 'cancelled';

export type OpportunityStage =
  | 'new'
  | 'to_qualify'
  | 'contacted'
  | 'call_scheduled'
  | 'brief_received'
  | 'estimate_todo'
  | 'estimate_sent'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'paused';

export const PIPELINE_STAGES: OpportunityStage[] = [
  'new',
  'to_qualify',
  'contacted',
  'call_scheduled',
  'brief_received',
  'estimate_todo',
  'estimate_sent',
  'negotiation',
  'won',
  'lost',
];

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  new: 'Nuovo contatto',
  to_qualify: 'Da qualificare',
  contacted: 'Contatto avviato',
  call_scheduled: 'Call programmata',
  brief_received: 'Brief ricevuto',
  estimate_todo: 'Preventivo da preparare',
  estimate_sent: 'Preventivo inviato',
  negotiation: 'Negoziazione',
  won: 'Vinto',
  lost: 'Perso',
  paused: 'In pausa',
};

/** Probabilità di default per fase (%). Configurabile in futuro. */
export const STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  new: 10,
  to_qualify: 20,
  contacted: 30,
  call_scheduled: 40,
  brief_received: 55,
  estimate_todo: 60,
  estimate_sent: 70,
  negotiation: 85,
  won: 100,
  lost: 0,
  paused: 25,
};

export type EstimateStatus =
  | 'draft'
  | 'internal_review'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'superseded';

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'credited';

export type PaymentMethod =
  | 'bank_transfer'
  | 'card'
  | 'paypal'
  | 'stripe'
  | 'cash'
  | 'cheque'
  | 'other';

export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled';

export type InstallmentStatus = 'scheduled' | 'due_soon' | 'paid' | 'overdue' | 'cancelled';
export type DocumentCategory = 'Contratti' | 'Preventivi' | 'Fatture' | 'Documenti' | 'Asset' | 'Altro';
export type DocumentSourceType = 'contract' | 'estimate' | 'invoice' | 'project' | 'studio_message' | 'generic';
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ContractRecurrence = 'one_time' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';
export type RenewalType = 'none' | 'manual' | 'automatic';

export type TransactionType = 'income' | 'expense';

export type PriceUnit = 'fixed' | 'hourly' | 'daily' | 'monthly' | 'quantity' | 'custom';

export type CalendarEventType =
  | 'task'
  | 'milestone'
  | 'project_deadline'
  | 'deadline'
  | 'work'
  | 'administration'
  | 'personal'
  | 'lead_followup'
  | 'client_call'
  | 'meeting'
  | 'estimate_due'
  | 'invoice_due'
  | 'payment_due'
  | 'time_off'
  | 'custom';

export type NotificationType =
  | 'task_assigned'
  | 'task_due'
  | 'task_overdue'
  | 'mention'
  | 'comment'
  | 'file_shared'
  | 'revision_requested'
  | 'deliverable_approved'
  | 'changes_requested'
  | 'estimate_accepted'
  | 'estimate_rejected'
  | 'invoice_due'
  | 'invoice_overdue'
  | 'payment_recorded'
  | 'project_at_risk'
  | 'milestone_soon'
  | 'lead_followup';

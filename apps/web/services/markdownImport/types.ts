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

export type ImportEntityType =
  | 'client'
  | 'service'
  | 'project'
  | 'estimate'
  | 'contract'
  | 'invoice'
  | 'payment'
  | 'transaction'
  | 'event';

export type DuplicateStatus =
  | 'new'
  | 'existing_identical'
  | 'existing_different'
  | 'ambiguous_match'
  | 'invalid';

export type ImportAction = 'create' | 'update' | 'skip';

export type ImportState = 'pending' | 'importing' | 'success' | 'failed' | 'skipped';

export interface ParsedMarkdownTable {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ParsedMarkdownSection {
  id: string;
  heading: string;
  level: number;
  lines: string[];
  fields: Record<string, string>;
  tables: ParsedMarkdownTable[];
  checklist: string[];
  paragraphs: string[];
  wikiLinks: string[];
  links: string[];
}

export interface ParsedMarkdownFile {
  fileName: string;
  title: string;
  frontmatter: Record<string, unknown>;
  sections: ParsedMarkdownSection[];
  rootSection: ParsedMarkdownSection;
}

export interface ImportWarning {
  code: string;
  message: string;
  field?: string;
  level: 'info' | 'warning' | 'error';
}

export interface ImportRelationshipHint {
  field: string;
  targetType: Exclude<ImportEntityType, 'event' | 'transaction' | 'payment'> | 'invoice' | 'project' | 'client' | 'service' | 'estimate';
  value: string;
  normalizedValue: string;
  resolvedId?: string;
  matchedCandidateId?: string;
  ambiguousIds?: string[];
}

export interface ImportCandidate {
  temporaryId: string;
  entityType: ImportEntityType;
  sourceFile: string;
  sourceSection?: string;
  confidence: number;
  rawFields: Record<string, unknown>;
  normalizedFields: Record<string, unknown>;
  relationshipHints: ImportRelationshipHint[];
  warnings: ImportWarning[];
  duplicateStatus: DuplicateStatus;
  action: ImportAction;
  importState: ImportState;
  existingMatchId?: string;
  selectedExistingId?: string;
  existingSnapshot?: Record<string, unknown>;
  resultId?: string;
  resultPath?: string;
  errorMessage?: string;
}

export interface ImportAnalysisResult {
  candidates: ImportCandidate[];
  fileCount: number;
  candidateCount: number;
}

export interface ImportContextData {
  clients: Client[];
  services: Service[];
  projects: Project[];
  estimates: Estimate[];
  contracts: Contract[];
  invoices: Invoice[];
  payments: Payment[];
  transactions: Transaction[];
  events: CalendarEvent[];
}

export interface ImportExecutionSummary {
  analyzed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  byEntity: Record<ImportEntityType, { created: number; updated: number; skipped: number; failed: number }>;
  history?: MarkdownImport;
}

import type { DocumentCategory, DocumentSourceType } from '@/types';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = ['Contratti', 'Preventivi', 'Fatture', 'Documenti', 'Asset', 'Altro'];

export const SOURCE_TYPES: { value: DocumentSourceType; label: string }[] = [
  { value: 'generic', label: 'Generico' },
  { value: 'project', label: 'Progetto' },
  { value: 'contract', label: 'Contratto' },
  { value: 'estimate', label: 'Preventivo' },
  { value: 'invoice', label: 'Fattura' },
];

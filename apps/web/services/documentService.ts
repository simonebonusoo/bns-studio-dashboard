import { jsPDF } from 'jspdf';
import { brandConfig } from '@/config/brandConfig';
import { documentTotals } from '@/lib/finance';
import { formatCurrency } from '@/lib/format';
import { repositories } from '@/services/repository';
import { saveBlobFile, saveTextFile } from '@/services/downloadService';
import { shareDocument } from '@/services/shareService';
import type { Client, Contract, DocItem, DocumentLineItem, Estimate, Invoice, Project } from '@/types';

function yamlValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function frontmatter(values: Record<string, unknown>) {
  return `---\n${Object.entries(values).map(([key, value]) => `${key}: ${yamlValue(value)}`).join('\n')}\n---`;
}

function linesMarkdown(items: DocumentLineItem[]) {
  if (items.length === 0) return '_Nessuna voce._';
  return [
    '| Voce | Quantita | Prezzo | IVA |',
    '| --- | ---: | ---: | ---: |',
    ...items.map((item) => `| ${item.description} | ${item.quantity} | ${formatCurrency(item.unitPrice)} | ${item.vatRate}% |`),
  ].join('\n');
}

export function estimateMarkdown(estimate: Estimate, client?: Client | null) {
  const totals = documentTotals(estimate.items, {
    globalDiscountPct: estimate.globalDiscountPct,
    depositPct: estimate.depositPct,
  });
  return [
    frontmatter({
      bns_markdown_version: 1,
      entity_type: 'estimate',
      document_title: `Preventivo ${estimate.number}`,
      document_type: 'estimate',
      document_id: estimate.id,
      organization_id: estimate.organizationId,
      client_id: estimate.clientId,
      project_id: null,
      version: estimate.version,
      created_at: estimate.createdAt,
      updated_at: estimate.updatedAt,
    }),
    `# Preventivo ${estimate.number}`,
    '## Cliente',
    client?.displayName ?? 'Cliente non collegato',
    '## Date',
    `Emissione: ${estimate.issueDate}`,
    `Scadenza: ${estimate.expiryDate ?? 'non impostata'}`,
    '## Servizi',
    linesMarkdown(estimate.items),
    '## Condizioni economiche',
    `Imponibile: ${formatCurrency(totals.subtotal)}`,
    `IVA: ${formatCurrency(totals.vat)}`,
    `Totale: ${formatCurrency(totals.total)}`,
    `Acconto richiesto: ${formatCurrency(totals.deposit)}`,
    '## Note',
    estimate.notes || 'Nessuna nota.',
    '## Termini',
    estimate.terms || 'Non specificati.',
  ].join('\n\n');
}

export function contractMarkdown(contract: Contract, client?: Client | null, project?: Project | null) {
  return [
    frontmatter({
      bns_markdown_version: 1,
      entity_type: 'contract',
      document_title: contract.title,
      document_type: 'contract',
      document_id: contract.id,
      organization_id: contract.organizationId,
      client_id: contract.clientId,
      project_id: contract.projectId,
      version: 1,
      created_at: contract.createdAt,
      updated_at: contract.updatedAt,
    }),
    `# ${contract.title}`,
    '## Cliente',
    client?.displayName ?? 'Cliente non collegato',
    '## Progetto',
    project?.name ?? 'Nessun progetto collegato',
    '## Rapporto contrattuale',
    `Numero: ${contract.number}`,
    `Tipologia: ${contract.type}`,
    `Stato: ${contract.status}`,
    `Inizio: ${contract.startDate ?? 'non impostato'}`,
    `Fine: ${contract.endDate ?? 'non impostata'}`,
    `Ricorrenza: ${contract.recurrence ?? 'one_time'}`,
    `Frequenza economica: ${contract.billingFrequency ?? contract.recurrence ?? 'one_time'}`,
    `Rinnovo: ${contract.renewalType ?? 'none'}`,
    '## Condizioni economiche',
    `Importo: ${formatCurrency(contract.value)}`,
    `Termini pagamento: ${contract.paymentTerms ?? 'non specificati'}`,
    `Revisioni incluse: ${contract.includedRevisions ?? 0}`,
    '## Condizioni',
    contract.terms || 'Non specificate.',
    '## Note',
    contract.notes || 'Nessuna nota.',
  ].join('\n\n');
}

export function invoicePdfBlob(invoice: Invoice, client?: Client | null) {
  return financialDocumentPdfBlob({
    title: 'Fattura',
    number: invoice.number,
    clientName: client?.displayName ?? 'Cliente non collegato',
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    items: invoice.items,
    globalDiscountPct: invoice.globalDiscountPct,
    withholdingPct: invoice.withholdingPct,
    notes: invoice.notes,
  });
}

export function estimatePdfBlob(estimate: Estimate, client?: Client | null) {
  return financialDocumentPdfBlob({
    title: 'Preventivo',
    number: estimate.number,
    clientName: client?.displayName ?? 'Cliente non collegato',
    issueDate: estimate.issueDate,
    dueDate: estimate.expiryDate,
    items: estimate.items,
    globalDiscountPct: estimate.globalDiscountPct,
    depositPct: estimate.depositPct,
    notes: estimate.notes,
  });
}

export function contractPdfBlob(contract: Contract, client?: Client | null, project?: Project | null) {
  const doc = new jsPDF();
  let y = 18;
  const write = (text: string, size = 10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 180);
    doc.text(lines, 15, y);
    y += lines.length * 6;
    if (y > 275) {
      doc.addPage();
      y = 18;
    }
  };
  write(brandConfig.name, 14);
  write(`Contratto ${contract.number}`, 16);
  write(contract.title, 13);
  write(`Cliente: ${client?.displayName ?? 'n/d'}`);
  write(`Progetto: ${project?.name ?? 'n/d'}`);
  write(`Stato: ${contract.status} · Tipo: ${contract.type}`);
  write(`Periodo: ${contract.startDate ?? 'n/d'} - ${contract.endDate ?? 'senza fine'}`);
  write(`Ricorrenza: ${contract.recurrence ?? 'one_time'} · Billing: ${contract.billingFrequency ?? 'one_time'} · Rinnovo: ${contract.renewalType ?? 'none'}`);
  write(`Importo: ${formatCurrency(contract.value)}`);
  write('Condizioni', 12);
  write(contract.terms || 'Non specificate.');
  if (contract.notes) {
    write('Note', 12);
    write(contract.notes);
  }
  return doc.output('blob');
}

function financialDocumentPdfBlob(input: {
  title: string;
  number: string;
  clientName: string;
  issueDate: string;
  dueDate?: string | null;
  items: DocumentLineItem[];
  globalDiscountPct?: number;
  withholdingPct?: number;
  depositPct?: number;
  notes?: string;
}) {
  const doc = new jsPDF();
  const totals = documentTotals(input.items, input);
  let y = 18;
  doc.setFontSize(14);
  doc.text(brandConfig.name, 15, y);
  doc.setFontSize(18);
  doc.text(`${input.title} ${input.number}`, 15, (y += 12));
  doc.setFontSize(10);
  doc.text(`Cliente: ${input.clientName}`, 15, (y += 10));
  doc.text(`Emissione: ${input.issueDate}`, 15, (y += 7));
  if (input.dueDate) doc.text(`Scadenza: ${input.dueDate}`, 15, (y += 7));
  y += 8;
  input.items.forEach((item) => {
    const text = `${item.description} · ${item.quantity} x ${formatCurrency(item.unitPrice)} · IVA ${item.vatRate}%`;
    doc.text(doc.splitTextToSize(text, 180), 15, y);
    y += 8;
  });
  y += 4;
  doc.text(`Imponibile: ${formatCurrency(totals.subtotal)}`, 130, y);
  doc.text(`IVA: ${formatCurrency(totals.vat)}`, 130, (y += 7));
  doc.setFontSize(12);
  doc.text(`Totale: ${formatCurrency(totals.total)}`, 130, (y += 8));
  if (input.depositPct) {
    doc.setFontSize(10);
    doc.text(`Acconto: ${formatCurrency(totals.deposit)}`, 130, (y += 7));
  }
  if (input.notes) {
    doc.setFontSize(10);
    doc.text('Note', 15, (y += 14));
    doc.text(doc.splitTextToSize(input.notes, 180), 15, (y += 7));
  }
  return doc.output('blob');
}

export async function upsertMarkdownDocument(input: {
  title: string;
  type: string;
  markdown: string;
  sourceEntityType: DocItem['sourceEntityType'];
  sourceEntityId: string;
  clientId?: string | null;
  projectId?: string | null;
}) {
  const existing = (await repositories.documents.list()).find(
    (document) =>
      document.sourceEntityType === input.sourceEntityType &&
      document.sourceEntityId === input.sourceEntityId &&
      document.representation === 'markdown',
  );
  const payload = {
    title: input.title,
    type: input.type,
    content: input.markdown,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    representation: 'markdown' as const,
    version: (existing?.version ?? 0) + 1,
    tags: ['ai-ready'],
  };
  if (existing) return repositories.documents.update(existing.id, payload);
  return repositories.documents.create(payload);
}

export async function downloadMarkdown(filename: string, markdown: string) {
  return saveTextFile(filename.endsWith('.md') ? filename : `${filename}.md`, markdown, 'text/markdown;charset=utf-8');
}

export async function downloadPdf(filename: string, blob: Blob) {
  return saveBlobFile(filename.endsWith('.pdf') ? filename : `${filename}.pdf`, blob, 'application/pdf');
}

export async function sharePdf(title: string, filename: string, blob: Blob) {
  return shareDocument({ title, filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`, blob, mime: 'application/pdf' });
}

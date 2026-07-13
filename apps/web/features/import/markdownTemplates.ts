import { saveTextFile } from '@/services/downloadService';
import clientTemplate from '../../../../docs/markdown-templates/client.md?raw';
import projectTemplate from '../../../../docs/markdown-templates/project.md?raw';
import estimateTemplate from '../../../../docs/markdown-templates/estimate.md?raw';
import contractTemplate from '../../../../docs/markdown-templates/contract.md?raw';
import invoiceTemplate from '../../../../docs/markdown-templates/invoice.md?raw';
import paymentTemplate from '../../../../docs/markdown-templates/payment.md?raw';
import bundleTemplate from '../../../../docs/markdown-templates/bundle.md?raw';
import type { ContextualEntityType } from './contextualImport';

export interface MarkdownTemplateOption {
  entityType: ContextualEntityType | 'bundle';
  label: string;
  filename: string;
  content: string;
}

export const MARKDOWN_TEMPLATES: MarkdownTemplateOption[] = [
  { entityType: 'client', label: 'Cliente', filename: 'bns-template-cliente.md', content: clientTemplate },
  { entityType: 'project', label: 'Progetto', filename: 'bns-template-progetto.md', content: projectTemplate },
  { entityType: 'estimate', label: 'Preventivo', filename: 'bns-template-preventivo.md', content: estimateTemplate },
  { entityType: 'contract', label: 'Contratto', filename: 'bns-template-contratto.md', content: contractTemplate },
  { entityType: 'invoice', label: 'Fattura', filename: 'bns-template-fattura.md', content: invoiceTemplate },
  { entityType: 'payment', label: 'Pagamento', filename: 'bns-template-pagamento.md', content: paymentTemplate },
  { entityType: 'bundle', label: 'Documento completo', filename: 'bns-template-documento-completo.md', content: bundleTemplate },
];

export function templateForEntity(entityType: ContextualEntityType) {
  return MARKDOWN_TEMPLATES.find((template) => template.entityType === entityType);
}

export async function downloadMarkdownTemplate(template: MarkdownTemplateOption) {
  await saveTextFile(template.filename, template.content, 'text/markdown;charset=utf-8');
}

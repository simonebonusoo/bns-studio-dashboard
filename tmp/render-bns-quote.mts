import { mkdir, writeFile } from 'node:fs/promises';
import { bnsEstimatePdfBlob, bnsPdfDefaults } from '../apps/web/services/bnsEstimatePdf.ts';

const estimate = {
  id: 'est_4',
  organizationId: 'org_bns',
  number: 'PREV-2026-0004',
  version: 1,
  clientId: 'cli_3',
  status: 'accepted',
  currency: 'EUR',
  issueDate: '2026-05-14',
  expiryDate: '2026-06-15',
  items: [
    {
      id: 'line_1',
      serviceId: 'svc_2',
      description: 'Sito Web Istituzionale',
      quantity: 1,
      unit: 'fixed',
      unitPrice: 3400,
      discountPct: 0,
      vatRate: 22,
    },
  ],
  globalDiscountPct: 8,
  depositPct: 30,
  notes: 'Academy website.',
  acceptedAt: '2026-05-26T00:00:00.000Z',
  createdAt: '2026-05-14T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
};

const client = {
  id: 'cli_3',
  organizationId: 'org_bns',
  type: 'company',
  companyName: 'K9 Security Academy',
  displayName: 'K9 Security Academy',
  email: 'hello@k9securityacademy.it',
  phone: '+39 000 000000',
  status: 'active',
  priority: 'urgent',
  tags: ['academy', 'website'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
};

await mkdir(new URL('../output/pdf/', import.meta.url), { recursive: true });
const document = bnsPdfDefaults(estimate as never, client as never);
const blob = await bnsEstimatePdfBlob(estimate as never, client as never, document);
const buffer = Buffer.from(await blob.arrayBuffer());
await writeFile(new URL(`../output/pdf/preventivo-bnsstudio-${estimate.number}.pdf`, import.meta.url), buffer);
console.log(`Wrote output/pdf/preventivo-bnsstudio-${estimate.number}.pdf`);

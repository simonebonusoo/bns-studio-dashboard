import { describe, expect, it } from 'vitest';
import { bnsPdfDefaults, bnsQuoteWarnings, normalizeBnsQuoteDocument } from '@/services/bnsEstimatePdf';
import type { Client, Estimate } from '@/types';

const client: Client = {
  id: 'cli_test',
  organizationId: 'org_test',
  type: 'company',
  displayName: 'K9 Security Academy',
  status: 'active',
  priority: 'high',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const estimate: Estimate = {
  id: 'est_test',
  organizationId: 'org_test',
  number: 'PREV-2026-0004',
  version: 1,
  clientId: client.id,
  status: 'accepted',
  currency: 'EUR',
  issueDate: '2026-07-04',
  expiryDate: '2026-10-04',
  items: [
    {
      id: 'line_1',
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
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('bnsEstimatePdf', () => {
  it('builds defaults consistent with the quote template', () => {
    const doc = bnsPdfDefaults(estimate, client);
    expect(doc.cover.title).toBe('PREVENTIVO COMPLETO');
    expect(doc.scope.items).toHaveLength(6);
    expect(doc.valueBreakdown.sections).toHaveLength(2);
    expect(doc.offer.reservedPrice).toBeLessThanOrEqual(doc.offer.realValue);
    expect(doc.payment.installments).toHaveLength(3);
  });

  it('normalizes the document to preserve template limits and monetary coherence', () => {
    const normalized = normalizeBnsQuoteDocument({
      ...bnsPdfDefaults(estimate, client),
      scope: {
        intro: 'Intro',
        items: Array.from({ length: 8 }, (_, index) => ({
          id: `scope-${index + 1}`,
          number: String(index + 1),
          title: `Titolo molto lungo ${index + 1}`.repeat(3),
          description: 'Descrizione molto lunga '.repeat(10),
        })),
      },
      offer: {
        ...bnsPdfDefaults(estimate, client).offer,
        reservedPrice: 999999,
      },
    });

    expect(normalized.scope.items).toHaveLength(6);
    expect(normalized.offer.reservedPrice).toBe(normalized.offer.realValue);
    expect(normalized.payment.total).toBeGreaterThan(0);
  });

  it('reports warnings when the input exceeds the template limits', () => {
    const warnings = bnsQuoteWarnings({
      ...bnsPdfDefaults(estimate, client),
      payment: {
        ...bnsPdfDefaults(estimate, client).payment,
        installments: [
          ...bnsPdfDefaults(estimate, client).payment.installments,
          { id: 'extra', title: 'Extra', description: 'Extra', amount: 10 },
        ],
      },
    });

    expect(warnings.some((warning) => warning.id === 'payment-installments')).toBe(true);
  });
});

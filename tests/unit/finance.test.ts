import { describe, it, expect } from 'vitest';
import {
  lineTotals,
  documentTotals,
  invoiceBalance,
  paidAmount,
  projectProfitability,
  round2,
} from '@/lib/finance';
import type { DocumentLineItem, Invoice, Payment, Project, TimeEntry } from '@/types';

const item = (over: Partial<DocumentLineItem> = {}): DocumentLineItem => ({
  id: 'x',
  description: 'Servizio',
  quantity: 1,
  unit: 'fixed',
  unitPrice: 1000,
  discountPct: 0,
  vatRate: 22,
  ...over,
});

describe('lineTotals', () => {
  it('calcola imponibile, IVA e totale di una riga', () => {
    const t = lineTotals(item({ quantity: 2, unitPrice: 500, vatRate: 22 }));
    expect(t.net).toBe(1000);
    expect(t.vat).toBe(220);
    expect(t.gross).toBe(1220);
  });

  it('applica lo sconto di riga prima dell’IVA', () => {
    const t = lineTotals(item({ unitPrice: 1000, discountPct: 10, vatRate: 22 }));
    expect(t.net).toBe(900);
    expect(t.vat).toBe(198);
    expect(t.gross).toBe(1098);
  });
});

describe('documentTotals', () => {
  it('somma le righe e calcola il totale', () => {
    const t = documentTotals([item({ unitPrice: 1000 }), item({ unitPrice: 500 })]);
    expect(t.subtotal).toBe(1500);
    expect(t.vat).toBe(330);
    expect(t.total).toBe(1830);
  });

  it('applica lo sconto globale riducendo imponibile e IVA', () => {
    const t = documentTotals([item({ unitPrice: 1000 })], { globalDiscountPct: 10 });
    expect(t.globalDiscount).toBe(100);
    expect(t.taxable).toBe(900);
    expect(t.vat).toBe(198);
    expect(t.total).toBe(1098);
  });

  it('sottrae la ritenuta d’acconto dal totale', () => {
    const t = documentTotals([item({ unitPrice: 1000, vatRate: 22 })], { withholdingPct: 20 });
    expect(t.withholding).toBe(200);
    expect(t.total).toBe(1020); // 1000 + 220 - 200
  });

  it('calcola l’acconto richiesto sul totale', () => {
    const t = documentTotals([item({ unitPrice: 1000 })], { depositPct: 30 });
    expect(t.deposit).toBe(round2(t.total * 0.3));
  });
});

describe('paidAmount', () => {
  const p = (over: Partial<Payment>): Payment => ({
    id: 'p',
    organizationId: 'o',
    amount: 100,
    status: 'completed',
    currency: 'EUR',
    date: '2026-01-01',
    method: 'cash',
    createdAt: '',
    updatedAt: '',
    ...over,
  });

  it('somma i pagamenti completati e sottrae i rimborsi', () => {
    expect(paidAmount([p({ amount: 500 }), p({ amount: 300 }), p({ amount: 100, status: 'refunded' })])).toBe(700);
  });

  it('ignora i pagamenti pending o falliti', () => {
    expect(paidAmount([p({ amount: 500, status: 'pending' }), p({ amount: 200 })])).toBe(200);
  });
});

describe('invoiceBalance', () => {
  const invoice: Invoice = {
    id: 'inv1',
    organizationId: 'o',
    number: 'FAT-1',
    status: 'issued',
    currency: 'EUR',
    issueDate: '2026-01-01',
    items: [item({ unitPrice: 1000, vatRate: 22 })], // totale 1220
    globalDiscountPct: 0,
    createdAt: '',
    updatedAt: '',
  };
  const pay = (amount: number, status: Payment['status'] = 'completed'): Payment =>
    ({ id: `p${amount}`, organizationId: 'o', invoiceId: 'inv1', amount, status, currency: 'EUR', date: '2026-01-02', method: 'bank_transfer', createdAt: '', updatedAt: '' } as Payment);

  it('è unpaid senza pagamenti', () => {
    const b = invoiceBalance(invoice, []);
    expect(b.total).toBe(1220);
    expect(b.balance).toBe(1220);
    expect(b.status).toBe('unpaid');
  });

  it('è partially_paid con pagamento parziale', () => {
    const b = invoiceBalance(invoice, [pay(500)]);
    expect(b.paid).toBe(500);
    expect(b.balance).toBe(720);
    expect(b.status).toBe('partially_paid');
  });

  it('è paid a saldo coperto', () => {
    const b = invoiceBalance(invoice, [pay(1220)]);
    expect(b.balance).toBe(0);
    expect(b.status).toBe('paid');
  });
});

describe('projectProfitability', () => {
  const project: Project = {
    id: 'prj1',
    organizationId: 'o',
    code: 'PRJ-1',
    name: 'Test',
    memberIds: [],
    status: 'active',
    priority: 'medium',
    health: 'on_track',
    contractValue: 5000,
    budget: 3000,
    estimatedHours: 100,
    progress: 50,
    color: '#000',
    tags: [],
    createdAt: '',
    updatedAt: '',
  };
  const entry = (min: number, cost: number, rate: number): TimeEntry =>
    ({ id: `e${min}`, organizationId: 'o', memberId: 'm', projectId: 'prj1', description: '', date: '2026-01-01', startedAt: '', durationMinutes: min, billable: true, internalCost: cost, hourlyRate: rate, approved: false, running: false, createdAt: '', updatedAt: '' } as TimeEntry);

  it('calcola costo lavoro, margine e scostamento ore', () => {
    // 60min @ costo 30/h = 30 costo; 60min @ rate 70/h = 70 fatturabile
    const prof = projectProfitability(project, [entry(60, 30, 70), entry(120, 30, 70)]);
    expect(prof.loggedHours).toBe(3);
    expect(prof.laborCost).toBe(90); // 3h * 30
    expect(prof.grossMargin).toBe(4910); // 5000 - 90
    expect(prof.hoursVariance).toBe(97); // 100 - 3
    expect(prof.hasEstimates).toBe(true);
  });

  it('esclude i timer ancora in esecuzione', () => {
    const running = { ...entry(60, 30, 70), running: true };
    const prof = projectProfitability(project, [running]);
    expect(prof.loggedHours).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { installmentStatus, installmentSummary } from '@/services/installmentService';
import type { Payment, PaymentInstallment } from '@/types';

/** Data ISO a N giorni da oggi (per test stabili nel tempo). */
const dayOffset = (days: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const inst = (over: Partial<PaymentInstallment>): PaymentInstallment => ({
  id: over.id ?? 'i1',
  organizationId: 'org',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  paymentId: 'pay1',
  installmentNumber: over.installmentNumber ?? 1,
  amount: over.amount ?? 1000,
  dueDate: over.dueDate ?? dayOffset(30),
  status: over.status ?? 'scheduled',
  ...over,
});

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'pay1',
  organizationId: 'org',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  amount: 3000,
  currency: 'EUR',
  date: '2026-01-01',
  method: 'bank_transfer',
  status: 'pending',
  ...over,
});

describe('installmentStatus', () => {
  it('paidAt valorizzato → paid (a prescindere dallo status)', () => {
    expect(installmentStatus({ status: 'scheduled', dueDate: dayOffset(-10), paidAt: dayOffset(-1) })).toBe('paid');
  });
  it('status paid → paid', () => {
    expect(installmentStatus({ status: 'paid', dueDate: dayOffset(-10), paidAt: null })).toBe('paid');
  });
  it('cancelled → cancelled', () => {
    expect(installmentStatus({ status: 'cancelled', dueDate: dayOffset(-10), paidAt: null })).toBe('cancelled');
  });
  it('scadenza passata e non pagata → overdue', () => {
    expect(installmentStatus({ status: 'scheduled', dueDate: dayOffset(-3), paidAt: null })).toBe('overdue');
  });
  it('scadenza entro 7 giorni → due_soon', () => {
    expect(installmentStatus({ status: 'scheduled', dueDate: dayOffset(3), paidAt: null })).toBe('due_soon');
  });
  it('scadenza lontana → scheduled', () => {
    expect(installmentStatus({ status: 'scheduled', dueDate: dayOffset(30), paidAt: null })).toBe('scheduled');
  });
});

describe('installmentSummary', () => {
  it('senza rate: usa l\'importo del pagamento (completed = pagato)', () => {
    const s = installmentSummary(payment({ amount: 2000, status: 'completed' }), []);
    expect(s).toEqual({ total: 2000, paid: 2000, residual: 0, status: 'completed', progress: 100 });
  });

  it('senza rate: pending = non pagato', () => {
    const s = installmentSummary(payment({ amount: 2000, status: 'pending' }), []);
    expect(s.paid).toBe(0);
    expect(s.residual).toBe(2000);
    expect(s.progress).toBe(0);
  });

  it('scenario K9 PRO: 3 rate da 1000, una pagata', () => {
    const s = installmentSummary(payment(), [
      inst({ id: '1', installmentNumber: 1, amount: 1000, status: 'paid' }),
      inst({ id: '2', installmentNumber: 2, amount: 1000, status: 'scheduled' }),
      inst({ id: '3', installmentNumber: 3, amount: 1000, status: 'scheduled' }),
    ]);
    expect(s.total).toBe(3000);
    expect(s.paid).toBe(1000);
    expect(s.residual).toBe(2000);
    expect(s.status).toBe('pending');
    expect(s.progress).toBe(33);
  });

  it('tutte le rate pagate → completed, residuo 0', () => {
    const s = installmentSummary(payment(), [
      inst({ id: '1', amount: 1500, status: 'paid' }),
      inst({ id: '2', amount: 1500, status: 'paid' }),
    ]);
    expect(s.status).toBe('completed');
    expect(s.residual).toBe(0);
    expect(s.progress).toBe(100);
  });

  it('esclude le rate annullate dal totale', () => {
    const s = installmentSummary(payment(), [
      inst({ id: '1', amount: 1000, status: 'paid' }),
      inst({ id: '2', amount: 1000, status: 'cancelled' }),
    ]);
    expect(s.total).toBe(1000);
    expect(s.status).toBe('completed');
  });

  it('non soffre errori di floating point sui centesimi', () => {
    const s = installmentSummary(payment({ amount: 0.3 }), [
      inst({ id: '1', amount: 0.1, status: 'paid' }),
      inst({ id: '2', amount: 0.2, status: 'paid' }),
    ]);
    expect(s.total).toBe(0.3);
    expect(s.residual).toBe(0);
    expect(s.status).toBe('completed');
  });
});

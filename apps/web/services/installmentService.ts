import { round2 } from '@/lib/finance';
import { nowISO } from '@/lib/id';
import { repositories } from '@/services/repository';
import type { InstallmentStatus, Payment, PaymentInstallment } from '@/types';

export interface InstallmentSummary {
  total: number;
  paid: number;
  residual: number;
  status: Payment['status'];
  progress: number;
}

export function installmentStatus(installment: Pick<PaymentInstallment, 'status' | 'dueDate' | 'paidAt'>): InstallmentStatus {
  if (installment.paidAt || installment.status === 'paid') return 'paid';
  if (installment.status === 'cancelled') return 'cancelled';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(installment.dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'overdue';
  if (days <= 7) return 'due_soon';
  return 'scheduled';
}

export function installmentSummary(payment: Payment, installments: PaymentInstallment[]): InstallmentSummary {
  const active = installments.filter((installment) => installment.status !== 'cancelled');
  if (active.length === 0) {
    const paid = payment.status === 'completed' ? payment.amount : 0;
    return {
      total: payment.amount,
      paid,
      residual: round2(payment.amount - paid),
      status: payment.status,
      progress: payment.amount ? Math.round((paid / payment.amount) * 100) : 0,
    };
  }
  const total = round2(active.reduce((sum, installment) => sum + installment.amount, 0));
  const paid = round2(active.filter((installment) => installment.status === 'paid').reduce((sum, installment) => sum + installment.amount, 0));
  const residual = Math.max(0, round2(total - paid));
  const status: Payment['status'] =
    paid <= 0 ? 'pending' : residual <= 0.005 ? 'completed' : 'pending';
  return {
    total,
    paid,
    residual,
    status,
    progress: total ? Math.round((paid / total) * 100) : 0,
  };
}

export async function syncPaymentStatusFromInstallments(paymentId: string) {
  const payment = await repositories.payments.get(paymentId);
  if (!payment) return;
  const installments = await repositories.paymentInstallments.list((installment) => installment.paymentId === paymentId);
  const summary = installmentSummary(payment, installments);
  if (payment.status !== summary.status) {
    await repositories.payments.update(paymentId, { status: summary.status });
  }
}

export async function markInstallmentPaid(installment: PaymentInstallment) {
  await repositories.paymentInstallments.update(installment.id, {
    paidAt: nowISO(),
    status: 'paid',
  });
  await syncPaymentStatusFromInstallments(installment.paymentId);
}

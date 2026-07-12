import { formatCurrency } from '@/lib/format';
import { repositories } from '@/services/repository';
import { getActiveSession } from '@/services/session';
import type { Notification, Payment, PaymentInstallment, Transaction } from '@/types';

type CashflowSourceType = 'payment' | 'payment_installment';

function sourceFilter(sourceType: CashflowSourceType, sourceId: string) {
  return (transaction: Transaction) =>
    transaction.automatic === true &&
    transaction.sourceType === sourceType &&
    transaction.sourceId === sourceId;
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

async function context(payment: Payment) {
  const [client, project] = await Promise.all([
    payment.clientId ? repositories.clients.get(payment.clientId) : Promise.resolve(undefined),
    payment.projectId ? repositories.projects.get(payment.projectId) : Promise.resolve(undefined),
  ]);
  return { client, project };
}

async function autoTransaction(sourceType: CashflowSourceType, sourceId: string) {
  return (await repositories.transactions.list(sourceFilter(sourceType, sourceId)))[0];
}

async function voidAutoTransaction(sourceType: CashflowSourceType, sourceId: string) {
  const existing = await autoTransaction(sourceType, sourceId);
  if (existing) await repositories.transactions.remove(existing.id);
}

async function upsertAutoIncome(input: {
  sourceType: CashflowSourceType;
  sourceId: string;
  amount: number;
  date: string;
  clientId?: string | null;
  projectId?: string | null;
  method?: Payment['method'];
  description: string;
  sourceLabel: string;
}) {
  const payload = {
    type: 'income' as const,
    category: 'Pagamento cliente',
    description: input.description,
    amount: input.amount,
    currency: 'EUR',
    date: input.date,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    method: input.method,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceLabel: input.sourceLabel,
    automatic: true,
  };
  const existing = await autoTransaction(input.sourceType, input.sourceId);
  if (existing) return repositories.transactions.update(existing.id, payload);
  return repositories.transactions.create(payload);
}

async function notifyPaymentReceived(input: {
  entityType: CashflowSourceType;
  entityId: string;
  title: string;
  body: string;
}) {
  const session = getActiveSession();
  if (!session.memberId) return;
  const existing = (await repositories.notifications.list((notification: Notification) =>
    notification.type === 'payment_recorded' &&
    notification.entityType === input.entityType &&
    notification.entityId === input.entityId &&
    notification.userId === session.memberId
  ))[0];
  if (existing) return;
  await repositories.notifications.create({
    userId: session.memberId,
    type: 'payment_recorded',
    title: input.title,
    body: input.body,
    entityType: input.entityType,
    entityId: input.entityId,
    read: false,
  });
}

export async function syncPaymentCashflow(payment: Payment) {
  const installments = await repositories.paymentInstallments.list((installment) => installment.paymentId === payment.id);
  if (installments.length > 0 || payment.status !== 'completed') {
    await voidAutoTransaction('payment', payment.id);
    return;
  }

  const { client, project } = await context(payment);
  const label = [client?.displayName, project?.name].filter(Boolean).join(' · ') || payment.reference || payment.id.slice(0, 8);
  const created = !(await autoTransaction('payment', payment.id));
  await upsertAutoIncome({
    sourceType: 'payment',
    sourceId: payment.id,
    amount: payment.amount,
    date: payment.date,
    clientId: payment.clientId,
    projectId: payment.projectId,
    method: payment.method,
    description: `Pagamento ${label}`,
    sourceLabel: 'Pagamento',
  });
  if (created) {
    await notifyPaymentReceived({
      entityType: 'payment',
      entityId: payment.id,
      title: 'Pagamento ricevuto',
      body: `${label} · ${formatCurrency(payment.amount)}`,
    });
  }
}

export async function syncInstallmentCashflow(installment: PaymentInstallment) {
  const payment = await repositories.payments.get(installment.paymentId);
  if (!payment || installment.status !== 'paid') {
    await voidAutoTransaction('payment_installment', installment.id);
    return;
  }

  const { client, project } = await context(payment);
  const label = [client?.displayName, project?.name].filter(Boolean).join(' · ') || payment.reference || payment.id.slice(0, 8);
  const sourceLabel = `Rata ${installment.installmentNumber}`;
  const created = !(await autoTransaction('payment_installment', installment.id));
  await upsertAutoIncome({
    sourceType: 'payment_installment',
    sourceId: installment.id,
    amount: installment.amount,
    date: dateOnly(installment.paidAt) || payment.date,
    clientId: payment.clientId,
    projectId: payment.projectId,
    method: payment.method,
    description: `Pagamento ${label} · ${sourceLabel}`,
    sourceLabel,
  });
  if (created) {
    await notifyPaymentReceived({
      entityType: 'payment_installment',
      entityId: installment.id,
      title: 'Pagamento ricevuto',
      body: `${label} · ${sourceLabel} · ${formatCurrency(installment.amount)}`,
    });
  }
}

export async function voidPaymentCashflow(paymentId: string) {
  await voidAutoTransaction('payment', paymentId);
  const installments = await repositories.paymentInstallments.list((installment) => installment.paymentId === paymentId);
  await Promise.all(installments.map((installment) => voidAutoTransaction('payment_installment', installment.id)));
}

export async function voidInstallmentCashflow(installmentId: string) {
  await voidAutoTransaction('payment_installment', installmentId);
}
